const express = require('express');
const router = express.Router();
const BusinessRule = require('../models/BusinessRule');
const memoryStore = require('../config/memoryStore');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/rules
// @desc    Get all business rules
router.get('/', protect, async (req, res) => {
  try {
    if (global.isMockDB) {
      return res.json(memoryStore.businessRules);
    }
    const rules = await BusinessRule.find({});
    res.json(rules);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/rules/:id
// @desc    Update a business rule (toggle enable/disable or change parameters)
router.put('/:id', protect, authorize('Admin'), async (req, res) => {
  const { isEnabled, parameters } = req.body;

  try {
    if (global.isMockDB) {
      const idx = memoryStore.businessRules.findIndex(r => r._id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: 'Rule not found' });
      
      memoryStore.businessRules[idx].isEnabled = isEnabled !== undefined ? isEnabled : memoryStore.businessRules[idx].isEnabled;
      if (parameters) {
        memoryStore.businessRules[idx].parameters = { ...memoryStore.businessRules[idx].parameters, ...parameters };
      }
      memoryStore.businessRules[idx].updatedAt = new Date();
      return res.json(memoryStore.businessRules[idx]);
    }

    const rule = await BusinessRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });

    if (isEnabled !== undefined) rule.isEnabled = isEnabled;
    if (parameters) rule.parameters = parameters;
    rule.updatedAt = Date.now();

    await rule.save();
    res.json(rule);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
