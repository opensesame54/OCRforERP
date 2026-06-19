const mongoose = require('mongoose');

const AuditTrailSchema = new mongoose.Schema({
  invoiceId: { type: String, default: '' },
  invoiceNumber: { type: String, default: '' },
  action: { type: String, required: true },
  details: { type: String, required: true },
  performedBy: { type: String, required: true },
  role: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AuditTrail', AuditTrailSchema);
