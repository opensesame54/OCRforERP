const User = require('../models/User');
const Invoice = require('../models/Invoice');
const Vendor = require('../models/Vendor');
const PurchaseOrder = require('../models/PurchaseOrder');
const BusinessRule = require('../models/BusinessRule');
const AuditTrail = require('../models/AuditTrail');
const memoryStore = require('./memoryStore');

const mapId = (id) => {
  if (!id || typeof id !== 'string') return id;
  if (id.startsWith('u') && id.length === 2) return '00000000000000000000000' + id[1];
  if (id.startsWith('v') && id.length === 2) return '00000000000000000000010' + id[1];
  if (id.startsWith('po') && id.length === 3) return '00000000000000000000020' + id[2];
  if (id.startsWith('inv') && id.length === 4) return '00000000000000000000030' + id[3];
  if (id.startsWith('r') && id.length === 2) return '00000000000000000000040' + id[1];
  if (id.startsWith('a') && id.length === 2) return '00000000000000000000050' + id[1];
  return id;
};

const seedMongoDatabase = async () => {
  try {
    // 1. Seed/Sync Users
    console.log('🌱 Syncing default users in MongoDB...');
    const emails = memoryStore.users.map(u => u.email);
    await User.deleteMany({ email: { $in: emails } });
    const mapped = memoryStore.users.map(u => ({ ...u, _id: mapId(u._id) }));
    await User.insertMany(mapped);

    // 2. Seed Vendors
    const vendorCount = await Vendor.countDocuments({});
    if (vendorCount === 0) {
      console.log('🌱 Seeding default vendors to MongoDB...');
      const mapped = memoryStore.vendors.map(v => ({ ...v, _id: mapId(v._id) }));
      await Vendor.insertMany(mapped);
    }

    // 3. Seed Purchase Orders
    const poCount = await PurchaseOrder.countDocuments({});
    if (poCount === 0) {
      console.log('🌱 Seeding default POs to MongoDB...');
      const mapped = memoryStore.purchaseOrders.map(p => ({ ...p, _id: mapId(p._id) }));
      await PurchaseOrder.insertMany(mapped);
    }

    // 4. Seed Invoices
    const invoiceCount = await Invoice.countDocuments({});
    if (invoiceCount === 0) {
      console.log('🌱 Seeding default invoices to MongoDB...');
      const mapped = memoryStore.invoices.map(inv => ({ 
        ...inv, 
        _id: mapId(inv._id),
        lineItems: (inv.lineItems || []).map(li => ({
          ...li,
          _id: li._id ? mapId(li._id) : undefined
        }))
      }));
      await Invoice.insertMany(mapped);
    }

    // 5. Seed Business Rules
    const ruleCount = await BusinessRule.countDocuments({});
    if (ruleCount === 0) {
      console.log('🌱 Seeding default rules to MongoDB...');
      const mapped = memoryStore.businessRules.map(r => ({ ...r, _id: mapId(r._id) }));
      await BusinessRule.insertMany(mapped);
    }

    // 6. Seed Audits
    const auditCount = await AuditTrail.countDocuments({});
    if (auditCount === 0) {
      console.log('🌱 Seeding default audits to MongoDB...');
      const mapped = memoryStore.auditTrails.map(a => ({ 
        ...a, 
        _id: mapId(a._id),
        invoiceId: mapId(a.invoiceId)
      }));
      await AuditTrail.insertMany(mapped);
    }

    console.log('✅ MongoDB database seeding complete.');
  } catch (error) {
    console.error('❌ Database Seeding Error:', error.message);
  }
};

module.exports = seedMongoDatabase;
