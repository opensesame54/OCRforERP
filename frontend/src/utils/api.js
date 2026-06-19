// Cental API handler with local state mock fallbacks if backend is offline.
const BASE_URL = ''; // Hitting proxy / relative paths

export const getHeaders = (role = 'Admin') => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    'X-Mock-Role': role
  };
};

export const apiCall = async (endpoint, options = {}, role = 'Admin') => {
  try {
    const res = await fetch(`${BASE_URL}/api${endpoint}`, {
      ...options,
      headers: {
        ...getHeaders(role),
        ...(options.headers || {})
      }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'API request failed');
    }
    return await res.json();
  } catch (error) {
    console.warn('API error (using fallback mock service):', error.message);
    return mockFallback(endpoint, options, role);
  }
};

// Fallback Mock data store for client-only execution
let mockInvoices = [
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
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    lineItems: [
      { description: 'Dell Desktop Computer PC DUAL CORE', quantity: 3, unitPrice: 209.00, taxPercent: 10, total: 627.00 },
      { description: 'HP T520 Thin Client', quantity: 5, unitPrice: 37.75, taxPercent: 10, total: 188.75 }
    ]
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
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
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
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    lineItems: [
      { description: 'Am Brauhaus Hardware Parts', quantity: 1, unitPrice: 4200, taxPercent: 19, total: 4200 }
    ]
  },
  {
    _id: 'inv4',
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
    createdAt: new Date().toISOString(),
    lineItems: [
      { description: '14 Colors Women Spaghetti Strap Bodycon Mini Dress', quantity: 4, unitPrice: 4.71, taxPercent: 10, total: 18.84 }
    ]
  }
];

let mockVendors = [
  { _id: 'v1', name: 'Cyberport GmbH', gstin: 'DE195033395', bankAccount: 'DE89370400440532013000', ifsc: 'CYBDEUX1FF', paymentTerms: 'Net 30', validationStatus: 'Verified', address: 'Am Brauhaus 5, Dresden, Germany', email: 'ap@cyberport.de', phone: '+49 351 50130' },
  { _id: 'v2', name: 'Adidas AG', gstin: 'DE132496840', bankAccount: 'DE44700800001092843900', ifsc: 'BYDEMNXXX', paymentTerms: 'Net 15', validationStatus: 'Verified', address: 'Adi-Dassler-Strasse 1, Herzogenaurach, Germany', email: 'finance@adidas.com', phone: '+49 9132 840' },
  { _id: 'v3', name: 'Green, Sanchez and Shannon', gstin: '27AAAAA0000A1Z5', bankAccount: 'GB88UACG16491215528907', ifsc: 'UACGGB2L', paymentTerms: 'Net 45', validationStatus: 'Pending', address: '10056 Wright Mission Suite 229, Coleside, CO 49749', email: 'billing@greensanchez.com', phone: '+1 555-0192' }
];

let mockPOs = [
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
];

let mockRules = [
  { _id: 'r1', name: 'Duplicate Detection Rule', description: 'Flags invoices sharing vendor and invoice number, or sharing vendor, date, and amount.', type: 'Duplicate Detection', isEnabled: true, parameters: { thresholdScore: 85 } },
  { _id: 'r2', name: 'Approval Limit Rule', description: 'Route invoices above ₹5,00,000 / $5,000 for multi-manager review.', type: 'Amount Threshold Routing', isEnabled: true, parameters: { thresholdAmount: 5000 } },
  { _id: 'r3', name: 'GSTIN Format Verification', description: 'Ensures vendor GSTIN matches standard state and pan coding format.', type: 'GST Validation', isEnabled: true, parameters: {} },
  { _id: 'r4', name: 'PO Price Tolerance Rule', description: 'Disallow posting if invoice unit price exceeds PO price by more than 5%.', type: 'Tolerance Rules', isEnabled: true, parameters: { pricePercentage: 5 } }
];

let mockAudits = [
  { _id: 'a1', invoiceNumber: '51109338', action: 'Upload', details: 'Invoice 51109338 uploaded successfully to queue.', performedBy: 'John AP Clerk', role: 'AP Clerk', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
  { _id: 'a2', invoiceNumber: '51109338', action: 'Extraction', details: 'OCR extraction parsed successfully (confidence: 98%).', performedBy: 'System OCR', role: 'System', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5000).toISOString() }
];

const mockFallback = (endpoint, options, role) => {
  const method = options.method || 'GET';

  if (endpoint.startsWith('/auth/me')) {
    return { name: `${role} User`, email: `${role.toLowerCase()}@ap.com`, role };
  }
  
  if (endpoint.startsWith('/auth/login')) {
    return { name: 'Admin User', email: 'admin@ap.com', role: 'Admin', token: 'mock-token-123' };
  }

  if (endpoint === '/invoices/stats') {
    const total = mockInvoices.length;
    return {
      kpis: {
        total,
        pending: mockInvoices.filter(i => i.status === 'Needs Review').length,
        approved: mockInvoices.filter(i => i.status === 'Approved').length,
        posted: mockInvoices.filter(i => i.status === 'Posted to ERP').length,
        exceptions: mockInvoices.filter(i => i.status === 'Exception').length,
        duplicates: mockInvoices.filter(i => i.status === 'Duplicate').length
      },
      monthlyVolume: [
        { month: 'Jan', volume: 45, value: 125000 },
        { month: 'Feb', volume: 55, value: 168000 },
        { month: 'Mar', volume: 70, value: 245000 },
        { month: 'Apr', volume: 65, value: 210000 },
        { month: 'May', volume: 90, value: 312000 },
        { month: 'Jun', volume: total, value: mockInvoices.reduce((acc, curr) => acc + curr.totalAmount, 0) }
      ],
      exceptionBreakdown: [
        { name: 'PO Mismatch', value: mockInvoices.filter(i => i.exceptionType === 'PO Mismatch').length || 1 },
        { name: 'Duplicate Invoice', value: mockInvoices.filter(i => i.exceptionType === 'Duplicate Invoice').length || 1 },
        { name: 'Tax Mismatch', value: mockInvoices.filter(i => i.exceptionType === 'Tax Validation Failure').length || 0 },
        { name: 'OCR Confidence Fail', value: mockInvoices.filter(i => i.confidenceScore < 0.75).length || 0 }
      ],
      bottleneckList: [
        { name: 'Sarah Reviewer', pendingCount: mockInvoices.filter(i => i.assignedTo === 'Sarah Reviewer').length },
        { name: 'John AP Clerk', pendingCount: mockInvoices.filter(i => i.assignedTo === 'John AP Clerk').length }
      ]
    };
  }

  if (endpoint.startsWith('/invoices')) {
    if (method === 'GET') {
      const match = endpoint.match(/\/invoices\/([a-zA-Z0-9_]+)/);
      if (match) {
        const inv = mockInvoices.find(i => i._id === match[1]);
        return inv || { message: 'Invoice not found' };
      }
      return { invoices: mockInvoices, total: mockInvoices.length, page: 1, pages: 1 };
    }

    if (method === 'PUT') {
      const match = endpoint.match(/\/invoices\/([a-zA-Z0-9_]+)/);
      const idx = mockInvoices.findIndex(i => i._id === match[1]);
      if (idx !== -1) {
        const updated = { ...mockInvoices[idx], ...JSON.parse(options.body) };
        mockInvoices[idx] = updated;
        return updated;
      }
    }

    if (endpoint.endsWith('/approve')) {
      const match = endpoint.match(/\/invoices\/([a-zA-Z0-9_]+)\/approve/);
      const idx = mockInvoices.findIndex(i => i._id === match[1]);
      if (idx !== -1) {
        mockInvoices[idx].status = 'Approved';
        return mockInvoices[idx];
      }
    }

    if (endpoint.endsWith('/reject')) {
      const match = endpoint.match(/\/invoices\/([a-zA-Z0-9_]+)\/reject/);
      const idx = mockInvoices.findIndex(i => i._id === match[1]);
      if (idx !== -1) {
        mockInvoices[idx].status = 'Rejected';
        return mockInvoices[idx];
      }
    }

    if (endpoint.endsWith('/post-erp')) {
      const match = endpoint.match(/\/invoices\/([a-zA-Z0-9_]+)\/post-erp/);
      const idx = mockInvoices.findIndex(i => i._id === match[1]);
      if (idx !== -1) {
        mockInvoices[idx].status = 'Posted to ERP';
        mockInvoices[idx].postingStatus = 'Posted';
        mockInvoices[idx].erpDocNumber = 'BILL-MOCK-' + Math.floor(1000 + Math.random() * 9000);
        return mockInvoices[idx];
      }
    }
  }

  if (endpoint.startsWith('/vendors')) {
    if (method === 'GET') return mockVendors;
    if (method === 'POST') {
      const newV = { _id: 'v_' + Date.now(), ...JSON.parse(options.body), validationStatus: 'Verified' };
      mockVendors.push(newV);
      return newV;
    }
  }

  if (endpoint.startsWith('/pos')) {
    return mockPOs;
  }

  if (endpoint.startsWith('/rules')) {
    if (method === 'GET') return mockRules;
    if (method === 'PUT') {
      const match = endpoint.match(/\/rules\/([a-zA-Z0-9_]+)/);
      const idx = mockRules.findIndex(r => r._id === match[1]);
      if (idx !== -1) {
        mockRules[idx] = { ...mockRules[idx], ...JSON.parse(options.body) };
        return mockRules[idx];
      }
    }
  }

  if (endpoint.startsWith('/audits')) {
    return mockAudits;
  }

  return { message: 'Endpoint fallback not matched' };
};
