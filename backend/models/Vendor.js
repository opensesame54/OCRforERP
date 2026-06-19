const mongoose = require('mongoose');

const VendorSchema = new mongoose.Schema({
  name: { type: String, required: true },
  gstin: { type: String, required: true, unique: true },
  bankAccount: { type: String, default: '' },
  ifsc: { type: String, default: '' },
  paymentTerms: { type: String, default: 'Net 30' },
  validationStatus: {
    type: String,
    enum: ['Verified', 'Pending', 'Suspended'],
    default: 'Pending'
  },
  address: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vendor', VendorSchema);
