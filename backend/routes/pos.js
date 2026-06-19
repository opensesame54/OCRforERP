const express = require('express');
const router = express.Router();
const PurchaseOrder = require('../models/PurchaseOrder');
const memoryStore = require('../config/memoryStore');
const { protect } = require('../middleware/auth');

// @route   GET /api/pos
// @desc    Get all purchase orders
router.get('/', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      return res.json(memoryStore.purchaseOrders);
    }
    const pos = await PurchaseOrder.find({});
    res.json(pos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
