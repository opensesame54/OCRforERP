const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const users = [];
const invoices = [];
const vendors = [];
const purchaseOrders = [];
const businessRules = [];
const auditTrails = [];

// Seed default users (with hashed passwords)
const seedUsers = () => {
  const seededUsersPath = path.join(__dirname, 'seeded_users.json');
  let loadedUsers = [];
  const salt = bcrypt.genSaltSync(10);

  if (fs.existsSync(seededUsersPath)) {
    try {
      loadedUsers = JSON.parse(fs.readFileSync(seededUsersPath, 'utf8'));
    } catch (e) {
      console.error('Failed to parse seeded_users.json, regenerating...', e.message);
    }
  }

  if (loadedUsers.length === 0) {
    const generatePassword = (rolePrefix) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let pass = '';
      for (let i = 0; i < 8; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `${rolePrefix}_${pass}`;
    };

    loadedUsers = [
      {
        _id: 'u1',
        name: 'John AP Clerk',
        email: 'clerk@ap.com',
        password: generatePassword('clerk'),
        role: 'AP Clerk'
      },
      {
        _id: 'u2',
        name: 'Sarah Reviewer',
        email: 'reviewer@ap.com',
        password: generatePassword('reviewer'),
        role: 'Reviewer'
      },
      {
        _id: 'u3',
        name: 'Michael Manager',
        email: 'manager@ap.com',
        password: generatePassword('manager'),
        role: 'Finance Manager'
      },
      {
        _id: 'u4',
        name: 'Admin User',
        email: 'admin@ap.com',
        password: generatePassword('admin'),
        role: 'Admin'
      }
    ];

    try {
      fs.writeFileSync(seededUsersPath, JSON.stringify(loadedUsers, null, 2), 'utf8');
      console.log('🌱 Generated random passwords and wrote to seeded_users.json');
    } catch (err) {
      console.error('Failed to write seeded_users.json:', err.message);
    }
  }

  loadedUsers.forEach(u => {
    users.push({
      _id: u._id,
      name: u.name,
      email: u.email,
      password: bcrypt.hashSync(u.password, salt),
      role: u.role,
      createdAt: new Date()
    });
  });
};

// Seed default rules
const seedRules = () => {
  businessRules.push(
    {
      _id: 'r1',
      name: 'Duplicate Detection Rule',
      description: 'Flags invoices sharing vendor and invoice number, or sharing vendor, date, and amount.',
      type: 'Duplicate Detection',
      isEnabled: true,
      parameters: { thresholdScore: 85 }
    },
    {
      _id: 'r2',
      name: 'Approval Limit Rule',
      description: 'Route invoices above ₹5,00,000 / $5,000 for multi-manager review.',
      type: 'Amount Threshold Routing',
      isEnabled: true,
      parameters: { thresholdAmount: 5000 }
    },
    {
      _id: 'r3',
      name: 'GSTIN Format Verification',
      description: 'Ensures vendor GSTIN matches standard state and pan coding format.',
      type: 'GST Validation',
      isEnabled: true,
      parameters: {}
    },
    {
      _id: 'r4',
      name: 'PO Price Tolerance Rule',
      description: 'Disallow posting if invoice unit price exceeds PO price by more than 5%.',
      type: 'Tolerance Rules',
      isEnabled: true,
      parameters: { pricePercentage: 5 }
    }
  );
};

// Seed default vendors
const seedVendors = () => {
  vendors.push(
    {
      _id: 'v1',
      name: 'Cyberport GmbH',
      gstin: 'DE195033395',
      bankAccount: 'DE89370400440532013000',
      ifsc: 'CYBDEUX1FF',
      paymentTerms: 'Net 30',
      validationStatus: 'Verified',
      address: 'Am Brauhaus 5, Dresden, Germany',
      email: 'ap@cyberport.de',
      phone: '+49 351 50130'
    },
    {
      _id: 'v2',
      name: 'Adidas AG',
      gstin: 'DE132496840',
      bankAccount: 'DE44700800001092843900',
      ifsc: 'BYDEMNXXX',
      paymentTerms: 'Net 15',
      validationStatus: 'Verified',
      address: 'Adi-Dassler-Strasse 1, Herzogenaurach, Germany',
      email: 'finance@adidas.com',
      phone: '+49 9132 840'
    },
    {
      _id: 'v3',
      name: 'Green, Sanchez and Shannon',
      gstin: '27AAAAA0000A1Z5',
      bankAccount: 'GB88UACG16491215528907',
      ifsc: 'UACGGB2L',
      paymentTerms: 'Net 45',
      validationStatus: 'Pending',
      address: '10056 Wright Mission Suite 229, Coleside, CO 49749',
      email: 'billing@greensanchez.com',
      phone: '+1 555-0192'
    }
  );
};

// Seed default POs
const seedPOs = () => {
  purchaseOrders.push(
    {
      _id: 'po1',
      poNumber: 'PO-2026-0001',
      vendorName: 'Adidas AG',
      items: [
        { description: 'Ultraboost Running Shoes', quantity: 50, unitPrice: 120, receivedQty: 50, total: 6000 },
        { description: 'Sports Jackets XXL', quantity: 20, unitPrice: 80, receivedQty: 18, total: 1600 }
      ],
      totalAmount: 7600,
      status: 'Open'
    },
    {
      _id: 'po2',
      poNumber: 'PO-2026-0002',
      vendorName: 'Green, Sanchez and Shannon',
      items: [
        { description: '14 Colors Women Spaghetti Strap Bodycon Mini Dress Sexy Party Club Wear Dresses', quantity: 4, unitPrice: 4.71, receivedQty: 4, total: 18.84 }
      ],
      totalAmount: 18.84,
      status: 'Fully Received'
    }
  );
};

// Seed default Invoices
const seedInvoices = () => {
  invoices.push(
    {
      _id: 'inv1',
      invoiceNumber: '51109338',
      vendorName: 'Andrews, Kirby and Valdez',
      vendorAddress: '945 Ortiz Plaza, Suite 12',
      invoiceDate: '2026-04-13',
      paymentTerms: 'Net 30',
      currency: 'USD',
      subtotalAmount: 5640.17,
      taxAmount: 564.02,
      totalAmount: 6204.19,
      gstin: '945-82-2137',
      status: 'Approved',
      duplicateScore: 12,
      confidenceScore: 0.98,
      poNumber: '',
      matchingStatus: 'N/A',
      exceptionType: '',
      exceptionSeverity: 'None',
      assignedTo: '',
      documentUrl: 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      postingStatus: 'Pending',
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
    },
    {
      _id: 'inv2',
      invoiceNumber: '26388025',
      vendorName: 'Green, Sanchez and Shannon',
      vendorAddress: '10056 Wright Mission Suite 229, Coleside, CO 49749',
      invoiceDate: '2026-06-01',
      paymentTerms: 'Net 45',
      currency: 'USD',
      subtotalAmount: 18.84,
      taxAmount: 1.88,
      totalAmount: 20.72,
      gstin: '27AAAAA0000A1Z5',
      status: 'Needs Review',
      duplicateScore: 5,
      confidenceScore: 0.92,
      poNumber: 'PO-2026-0002',
      matchingStatus: '3-Way Match Passed',
      exceptionType: '',
      exceptionSeverity: 'None',
      assignedTo: 'Sarah Reviewer',
      documentUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      postingStatus: 'N/A',
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      lineItems: [
        {
          description: '14 Colors Women Spaghetti Strap Bodycon Mini Dress Sexy Party Club Wear Dresses',
          quantity: 4,
          unitPrice: 4.71,
          taxPercent: 10,
          total: 18.84
        }
      ]
    },
    {
      _id: 'inv3',
      invoiceNumber: 'INV-2026-991',
      vendorName: 'Cyberport GmbH',
      vendorAddress: 'Am Brauhaus 5, Dresden, Germany',
      invoiceDate: '2026-05-19',
      paymentTerms: 'Net 30',
      currency: 'EUR',
      subtotalAmount: 4200.00,
      taxAmount: 800.00,
      totalAmount: 5000.00,
      gstin: 'DE195033395',
      status: 'Exception',
      duplicateScore: 20,
      confidenceScore: 0.65,
      poNumber: 'PO-2026-0005',
      matchingStatus: 'Variance Mismatch',
      exceptionType: 'PO Mismatch',
      exceptionSeverity: 'High',
      assignedTo: 'Sarah Reviewer',
      documentUrl: 'https://images.unsplash.com/photo-1586486855514-8c633cc6fa98?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      postingStatus: 'Failed',
      postingLogs: ['Error: Reference PO-2026-0005 cannot be found in Odoo stage ERP system.'],
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
    },
    {
      _id: 'inv4',
      invoiceNumber: '26388025', // Duplicate of inv2
      vendorName: 'Green, Sanchez and Shannon',
      vendorAddress: '10056 Wright Mission Suite 229, Coleside, CO 49749',
      invoiceDate: '2026-06-01',
      paymentTerms: 'Net 45',
      currency: 'USD',
      subtotalAmount: 18.84,
      taxAmount: 1.88,
      totalAmount: 20.72,
      gstin: '27AAAAA0000A1Z5',
      status: 'Duplicate',
      duplicateScore: 98,
      confidenceScore: 0.99,
      poNumber: '',
      matchingStatus: 'N/A',
      exceptionType: 'Duplicate Invoice Detected',
      exceptionSeverity: 'Medium',
      assignedTo: 'John AP Clerk',
      documentUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      postingStatus: 'N/A',
      createdAt: new Date()
    }
  );
};

// Seed default audits
const seedAudits = () => {
  auditTrails.push(
    {
      _id: 'a1',
      invoiceNumber: '51109338',
      invoiceId: 'inv1',
      action: 'Upload',
      details: 'Invoice 51109338 uploaded successfully to queue.',
      performedBy: 'John AP Clerk',
      role: 'AP Clerk',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      _id: 'a2',
      invoiceNumber: '51109338',
      invoiceId: 'inv1',
      action: 'Extraction',
      details: 'OCR extraction parsed successfully (confidence: 98%).',
      performedBy: 'System OCR',
      role: 'System',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5000)
    },
    {
      _id: 'a3',
      invoiceNumber: '51109338',
      invoiceId: 'inv1',
      action: 'Approvals',
      details: 'Invoice approved by finance manager.',
      performedBy: 'Michael Manager',
      role: 'Finance Manager',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  );
};

// Run seeders immediately
seedUsers();
seedRules();
seedVendors();
seedPOs();
seedInvoices();
seedAudits();

module.exports = {
  users,
  invoices,
  vendors,
  purchaseOrders,
  businessRules,
  auditTrails
};
