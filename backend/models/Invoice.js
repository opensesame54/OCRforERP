const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, default: 1 },
  unitPrice: { type: Number, default: 0 },
  taxPercent: { type: Number, default: 0 },
  total: { type: Number, default: 0 }
});

const InvoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true },
  vendorName: { type: String, required: true },
  vendorAddress: { type: String, default: '' },
  invoiceDate: { type: String, required: true },
  paymentTerms: { type: String, default: 'Net 30' },
  currency: { type: String, default: 'INR' },
  subtotalAmount: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  gstin: { type: String, default: '' },
  status: {
    type: String,
    enum: [
      'Uploaded',
      'Extracted',
      'Needs Review',
      'Duplicate',
      'Exception',
      'Approved',
      'Rejected',
      'Posted to ERP',
      'Payment Hold'
    ],
    default: 'Uploaded'
  },
  duplicateScore: { type: Number, default: 0 },
  confidenceScore: { type: Number, default: 1.0 },
  lineItems: [LineItemSchema],
  poNumber: { type: String, default: '' },
  matchingStatus: {
    type: String,
    enum: ['Match Pending', '2-Way Match Passed', '3-Way Match Passed', 'Variance Mismatch', 'Tolerance Mismatch', 'N/A'],
    default: 'Match Pending'
  },
  exceptionType: { type: String, default: '' },
  exceptionSeverity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'None'],
    default: 'None'
  },
  assignedTo: { type: String, default: '' },
  documentUrl: { type: String, default: '' },
  erpDocNumber: { type: String, default: '' },
  postingStatus: {
    type: String,
    enum: ['Pending', 'Posted', 'Failed', 'N/A'],
    default: 'N/A'
  },
  postingLogs: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);
