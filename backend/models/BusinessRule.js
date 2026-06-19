const mongoose = require('mongoose');

const BusinessRuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  type: {
    type: String,
    enum: [
      'Duplicate Detection',
      'Amount Threshold Routing',
      'Approval Routing',
      'Vendor Validation',
      'GST Validation',
      'Payment Hold Rules',
      'PO Matching Rules',
      'Tolerance Rules'
    ],
    required: true
  },
  isEnabled: { type: Boolean, default: true },
  parameters: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BusinessRule', BusinessRuleSchema);
