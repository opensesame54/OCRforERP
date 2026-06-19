const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Vendor = require('../models/Vendor');
const memoryStore = require('../config/memoryStore');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/vendors
// @desc    Get all vendors
router.get('/', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      return res.json(memoryStore.vendors);
    }
    const vendors = await Vendor.find({});
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/vendors
// @desc    Create a new vendor
router.post('/', protect, authorize('AP Clerk', 'Admin'), async (req, res) => {
  const { name, gstin, bankAccount, ifsc, paymentTerms, address, email, phone } = req.body;

  try {
    if (global.isMockDB) {
      const newVendor = {
        _id: new mongoose.Types.ObjectId().toString(),
        name,
        gstin,
        bankAccount,
        ifsc,
        paymentTerms,
        validationStatus: 'Verified',
        address,
        email,
        phone,
        createdAt: new Date()
      };
      memoryStore.vendors.push(newVendor);
      return res.status(201).json(newVendor);
    }

    const vendorExists = await Vendor.findOne({ gstin });
    if (vendorExists) {
      return res.status(400).json({ message: 'Vendor with this GSTIN already exists' });
    }

    const vendor = await Vendor.create({
      name,
      gstin,
      bankAccount,
      ifsc,
      paymentTerms,
      validationStatus: 'Verified',
      address,
      email,
      phone
    });

    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/vendors/:id
// @desc    Update a vendor
router.put('/:id', protect, authorize('Admin', 'Finance Manager'), async (req, res) => {
  try {
    if (global.isMockDB) {
      const index = memoryStore.vendors.findIndex(v => v._id === req.params.id);
      if (index === -1) return res.status(404).json({ message: 'Vendor not found' });
      memoryStore.vendors[index] = { ...memoryStore.vendors[index], ...req.body };
      return res.json(memoryStore.vendors[index]);
    }

    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
