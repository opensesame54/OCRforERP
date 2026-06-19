const express = require('express');
const router = express.Router();
const AuditTrail = require('../models/AuditTrail');
const memoryStore = require('../config/memoryStore');
const { protect } = require('../middleware/auth');

// @route   GET /api/audits
// @desc    Get all audit logs
router.get('/', protect, async (req, res) => {
  const { invoiceNumber } = req.query;

  try {
    if (global.isMockDB) {
      let logs = [...memoryStore.auditTrails];
      if (invoiceNumber) {
        logs = logs.filter(l => l.invoiceNumber === invoiceNumber);
      }
      // Sort newest first
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return res.json(logs);
    }

    const query = {};
    if (invoiceNumber) {
      query.invoiceNumber = invoiceNumber;
    }

    const audits = await AuditTrail.find(query).sort({ timestamp: -1 });
    res.json(audits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
