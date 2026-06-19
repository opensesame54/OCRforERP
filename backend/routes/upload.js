const express = require('express');
const router = express.Router();
const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const AuditTrail = require('../models/AuditTrail');
const memoryStore = require('../config/memoryStore');
const { protect } = require('../middleware/auth');
const { runRules } = require('../utils/rulesEngine');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ dest: path.join(__dirname, '../temp/') });

// @route   POST /api/upload
// @desc    Upload file and trigger local Python PaddleOCR + Mistral extraction
router.post('/', protect, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  const tempFilePath = req.file.path + ext;

  try {
    fs.renameSync(req.file.path, tempFilePath);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to prepare upload file', error: err.message });
  }

  // Upload to Cloudinary
  let documentUrl = '';
  try {
    const uploadResult = await cloudinary.uploader.upload(tempFilePath, {
      resource_type: 'auto',
      folder: 'ap_invoices'
    });
    documentUrl = uploadResult.secure_url;
    console.log('Cloudinary Upload Success:', documentUrl);
  } catch (cloudinaryErr) {
    console.warn('Cloudinary upload failed, using fallback empty URL:', cloudinaryErr.message);
  }

  const tempJsonPath = path.join(__dirname, `../temp/extracted_${Date.now()}.json`);

  const workspaceDir = path.join(__dirname, '../../');
  const venvPython = path.join(workspaceDir, '.venv/bin/python');
  const extractorScript = path.join(workspaceDir, 'extractor.py');

  // Build command to execute Python OCR script
  const cmd = `PYTHONPATH="${workspaceDir}" "${venvPython}" "${extractorScript}" "${tempFilePath}" -o "${tempJsonPath}" --debug`;
  console.log('Executing OCR subprocess:', cmd);

  exec(cmd, { cwd: workspaceDir }, async (error, stdout, stderr) => {
    // Delete uploaded temporary file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {}

    if (error) {
      console.error('OCR Subprocess Execution Error:', stderr || error.message);
      // Clean up JSON if any
      try { if (fs.existsSync(tempJsonPath)) fs.unlinkSync(tempJsonPath); } catch (e) {}
      
      return res.status(500).json({ 
        message: 'Extraction subprocess failed', 
        error: stderr || error.message 
      });
    }

    try {
      if (!fs.existsSync(tempJsonPath)) {
        throw new Error('Extraction output JSON file not found');
      }

      // Read extracted JSON
      const extractedContent = fs.readFileSync(tempJsonPath, 'utf-8');
      const data = JSON.parse(extractedContent);

      // Clean up temp JSON file
      try { fs.unlinkSync(tempJsonPath); } catch (e) {}

      // Automatically register vendor if not present in directory
      const vendorName = (data.vendor_name || '').trim();
      const vendorGstin = (data.tax_id || '').trim();

      if (vendorName && vendorName.toUpperCase() !== 'UNKNOWN VENDOR') {
        let vendorExists = false;
        if (global.isMockDB) {
          vendorExists = memoryStore.vendors.some(v => 
            (vendorGstin && v.gstin.toLowerCase() === vendorGstin.toLowerCase()) || 
            (v.name.toLowerCase() === vendorName.toLowerCase())
          );
        } else {
          const query = [];
          if (vendorGstin) query.push({ gstin: vendorGstin });
          query.push({ name: new RegExp('^' + vendorName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') });
          const existing = await Vendor.findOne({ $or: query });
          vendorExists = !!existing;
        }

        if (!vendorExists) {
          const finalGstin = vendorGstin || 'GEN-' + Math.random().toString(36).substring(2, 9).toUpperCase();
          const newVendor = {
            _id: new mongoose.Types.ObjectId().toString(),
            name: vendorName,
            gstin: finalGstin,
            bankAccount: '',
            ifsc: '',
            paymentTerms: 'Net 30',
            validationStatus: 'Verified',
            address: data.vendor_address || '',
            email: '',
            phone: '',
            createdAt: new Date()
          };

          if (global.isMockDB) {
            memoryStore.vendors.push(newVendor);
          } else {
            await Vendor.create(newVendor);
          }
          console.log(`Automatically registered new vendor: ${vendorName} (GSTIN: ${finalGstin})`);
        }
      }

      // Create new invoice record in MERN system
      const newInvoice = {
        _id: new mongoose.Types.ObjectId().toString(),
        invoiceNumber: data.invoice_number || 'UNKNOWN-' + Math.floor(Math.random() * 1000),
        vendorName: data.vendor_name || 'UNKNOWN VENDOR',
        vendorAddress: data.vendor_address || '',
        invoiceDate: data.invoice_date || new Date().toISOString().split('T')[0],
        currency: data.currency || 'INR',
        subtotalAmount: data.subtotal_amount || 0,
        taxAmount: data.tax_amount || 0,
        totalAmount: data.total_amount || 0,
        gstin: data.tax_id || '',
        confidenceScore: data.ocr_confidence || 0.85,
        lineItems: (data.line_items || []).map(li => ({
          description: li.description || '',
          quantity: li.quantity || 1,
          unitPrice: li.unit_price || 0,
          taxPercent: li.vat || 10,
          total: li.total || 0
        })),
        poNumber: '',
        matchingStatus: 'Match Pending',
        status: 'Extracted',
        documentUrl: documentUrl || '',
        createdAt: new Date()
      };

      // Run business rules on the newly extracted invoice
      const ruleResult = await runRules(newInvoice);
      newInvoice.duplicateScore = ruleResult.duplicateScore;
      newInvoice.exceptionType = ruleResult.exceptionType;
      newInvoice.exceptionSeverity = ruleResult.exceptionSeverity;
      newInvoice.matchingStatus = ruleResult.matchingStatus;

      if (ruleResult.errors.length > 0) {
        newInvoice.status = 'Exception';
        newInvoice.postingLogs = ruleResult.errors;
      } else {
        newInvoice.status = 'Needs Review';
        newInvoice.postingLogs = [];
      }

      // Save to database/memory store
      if (global.isMockDB) {
        memoryStore.invoices.push(newInvoice);
      } else {
        await Invoice.create(newInvoice);
      }

      // Register audit action
      const newAudit = {
        _id: new mongoose.Types.ObjectId().toString(),
        invoiceId: newInvoice._id,
        invoiceNumber: newInvoice.invoiceNumber,
        action: 'Upload',
        details: `Invoice PDF/Image uploaded. OCR parsed (Confidence: ${Math.round(newInvoice.confidenceScore * 100)}%). Status: ${newInvoice.status}.`,
        performedBy: req.user.name,
        role: req.user.role,
        timestamp: new Date()
      };
      memoryStore.auditTrails.push(newAudit);
      if (!global.isMockDB) {
        await AuditTrail.create(newAudit);
      }

      res.status(201).json(newInvoice);

    } catch (parseError) {
      console.error('OCR Output Parsing Error:', parseError.message);
      res.status(500).json({ 
        message: 'Failed to process extracted invoice data', 
        error: parseError.message 
      });
    }
  });
});

module.exports = router;
