const mongoose = require('mongoose');

const POItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  receivedQty: { type: Number, default: 0 },
  total: { type: Number, required: true }
});

const PurchaseOrderSchema = new mongoose.Schema({
  poNumber: { type: String, required: true, unique: true },
  vendorName: { type: String, required: true },
  items: [POItemSchema],
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Open', 'Fully Received', 'Closed'],
    default: 'Open'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('PurchaseOrder', PurchaseOrderSchema);
