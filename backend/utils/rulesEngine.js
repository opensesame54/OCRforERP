const memoryStore = require('../config/memoryStore');
const BusinessRule = require('../models/BusinessRule');
const PurchaseOrder = require('../models/PurchaseOrder');
const Invoice = require('../models/Invoice');

const runRules = async (invoice) => {
  let activeRules = [];
  if (global.isMockDB) {
    activeRules = memoryStore.businessRules.filter(r => r.isEnabled);
  } else {
    try {
      activeRules = await BusinessRule.find({ isEnabled: true });
    } catch (e) {
      activeRules = memoryStore.businessRules.filter(r => r.isEnabled);
    }
  }

  const errors = [];
  let duplicateScore = 0;
  let exceptionType = '';
  let exceptionSeverity = 'None';
  let matchingStatus = invoice.matchingStatus || 'Match Pending';

  // 1. Duplicate Detection Rule
  const dupRule = activeRules.find(r => r.type === 'Duplicate Detection');
  if (dupRule) {
    let matches = [];
    if (global.isMockDB) {
      matches = memoryStore.invoices.filter(inv => 
        inv._id !== invoice._id && 
        inv.vendorName === invoice.vendorName &&
        (inv.invoiceNumber === invoice.invoiceNumber || 
         (inv.invoiceDate === invoice.invoiceDate && Math.abs(inv.totalAmount - invoice.totalAmount) < 1))
      );
    } else {
      try {
        matches = await Invoice.find({
          _id: { $ne: invoice._id },
          vendorName: invoice.vendorName,
          $or: [
            { invoiceNumber: invoice.invoiceNumber },
            { invoiceDate: invoice.invoiceDate, totalAmount: invoice.totalAmount }
          ]
        });
      } catch (e) {}
    }

    if (matches.length > 0) {
      duplicateScore = 98; // High similarity match
      errors.push('Duplicate invoice candidate detected matching active records.');
      exceptionType = 'Duplicate Invoice';
      exceptionSeverity = 'Medium';
    }
  }

  // 2. GST Validation Rule
  const gstRule = activeRules.find(r => r.type === 'GST Validation');
  if (gstRule && invoice.gstin) {
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(invoice.gstin)) {
      errors.push('Invalid GSTIN structure (Expected standard 15-character format).');
      exceptionType = 'Tax Validation Failure';
      exceptionSeverity = 'Medium';
    }
  }

  // 3. PO Matching Rule & Tolerance Check
  const poRule = activeRules.find(r => r.type === 'PO Matching Rules');
  const toleranceRule = activeRules.find(r => r.type === 'Tolerance Rules');
  if (poRule && invoice.poNumber) {
    let po = null;
    if (global.isMockDB) {
      po = memoryStore.purchaseOrders.find(p => p.poNumber === invoice.poNumber);
    } else {
      try {
        po = await PurchaseOrder.findOne({ poNumber: invoice.poNumber });
      } catch (e) {}
    }

    if (!po) {
      errors.push(`Purchase Order Reference ${invoice.poNumber} not found.`);
      exceptionType = 'PO Mismatch';
      exceptionSeverity = 'High';
      matchingStatus = 'Variance Mismatch';
    } else {
      // Run match check on line items
      let poMismatch = false;
      let toleranceExceeded = false;
      const tolerancePercent = toleranceRule ? (toleranceRule.parameters.pricePercentage || 5) : 5;

      if (!invoice.lineItems || invoice.lineItems.length === 0) {
        poMismatch = true;
      } else {
        invoice.lineItems.forEach(invItem => {
          // Find matching item in PO
          const poItem = po.items.find(pi => 
            pi.description.toLowerCase().includes(invItem.description.toLowerCase()) ||
            invItem.description.toLowerCase().includes(pi.description.toLowerCase())
          );

          if (!poItem) {
            poMismatch = true;
          } else {
            // Check prices/quantities (2-way check: price; 3-way check: qty vs receivedQty)
            const priceDiffPercent = ((invItem.unitPrice - poItem.unitPrice) / poItem.unitPrice) * 100;
            if (priceDiffPercent > tolerancePercent) {
              toleranceExceeded = true;
            }
            if (invItem.quantity > (poItem.quantity - poItem.receivedQty) + 1) {
              poMismatch = true; // Qty variance
            }
          }
        });
      }

      if (poMismatch) {
        errors.push('Line items or quantities do not align with Purchase Order.');
        exceptionType = 'PO Mismatch';
        exceptionSeverity = 'High';
        matchingStatus = 'Variance Mismatch';
      } else if (toleranceExceeded) {
        errors.push(`Invoice unit prices exceed PO tolerances (>${tolerancePercent}%).`);
        exceptionType = 'PO Mismatch';
        exceptionSeverity = 'Medium';
        matchingStatus = 'Tolerance Mismatch';
      } else {
        // 3-way match passed successfully
        matchingStatus = po.status === 'Fully Received' ? '3-Way Match Passed' : '2-Way Match Passed';
      }
    }
  }

  // 4. Amount Threshold Routing Rule
  const amountRule = activeRules.find(r => r.type === 'Amount Threshold Routing');
  if (amountRule && !exceptionType) {
    const limit = amountRule.parameters.thresholdAmount || 5000;
    if (invoice.totalAmount > limit) {
      errors.push(`Invoice total exceeds threshold limit (₹${limit}/$${limit}). Requires manager approval.`);
      // Not a fatal exception but triggers approval hold
    }
  }

  return {
    errors,
    duplicateScore,
    exceptionType,
    exceptionSeverity,
    matchingStatus
  };
};

module.exports = { runRules };
