import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Plus, Trash2, FileText, CheckCircle, RefreshCw, Save, ShieldAlert, ArrowRight, Ban, Eye } from 'lucide-react';

const InvoiceReview = ({ userRole, selectedInvoice, onBack, onNavigateToDuplicates }) => {
  const [invoice, setInvoice] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState([]);
  const [validationLogs, setValidationLogs] = useState([]);

  useEffect(() => {
    if (selectedInvoice) {
      setInvoice(JSON.parse(JSON.stringify(selectedInvoice))); // deep clone
      setValidationLogs(selectedInvoice.postingLogs || []);
    }
  }, [selectedInvoice]);

  if (!invoice) return <div>No invoice selected for review.</div>;

  const handleChange = (field, value) => {
    setInvoice(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLineItemChange = (idx, field, val) => {
    const lines = [...invoice.lineItems];
    lines[idx][field] = val;

    // Auto calculate line total
    const qty = parseFloat(lines[idx].quantity) || 0;
    const price = parseFloat(lines[idx].unitPrice) || 0;
    lines[idx].total = parseFloat((qty * price).toFixed(2));

    setInvoice(prev => {
      const subtotal = lines.reduce((acc, curr) => acc + curr.total, 0);
      const tax = parseFloat((subtotal * 0.10).toFixed(2)); // Default 10% tax for calc
      return {
        ...prev,
        lineItems: lines,
        subtotalAmount: parseFloat(subtotal.toFixed(2)),
        taxAmount: tax,
        totalAmount: parseFloat((subtotal + tax).toFixed(2))
      };
    });
  };

  const addLineItem = () => {
    setInvoice(prev => ({
      ...prev,
      lineItems: [...prev.lineItems, { description: '', quantity: 1, unitPrice: 0, taxPercent: 10, total: 0 }]
    }));
  };

  const deleteLineItem = (idx) => {
    const lines = invoice.lineItems.filter((_, i) => i !== idx);
    setInvoice(prev => {
      const subtotal = lines.reduce((acc, curr) => acc + curr.total, 0);
      const tax = parseFloat((subtotal * 0.10).toFixed(2));
      return {
        ...prev,
        lineItems: lines,
        subtotalAmount: parseFloat(subtotal.toFixed(2)),
        taxAmount: tax,
        totalAmount: parseFloat((subtotal + tax).toFixed(2))
      };
    });
  };

  const handleSave = async () => {
    setLoading(true);
    const updated = await apiCall(`/invoices/${invoice._id}`, {
      method: 'PUT',
      body: JSON.stringify(invoice)
    }, userRole);
    if (updated) {
      setInvoice(updated);
      setValidationLogs(updated.postingLogs || []);
      alert('Changes saved successfully. Business validation rules executed.');
    }
    setLoading(false);
  };

  const handleValidate = async () => {
    setLoading(true);
    const data = await apiCall(`/invoices/${invoice._id}/validate`, { method: 'POST' }, userRole);
    if (data && data.invoice) {
      setInvoice(data.invoice);
      setErrors(data.errors);
      setValidationLogs(data.invoice.postingLogs || []);
      alert(data.passed ? 'All business rules passed successfully!' : 'Validation failed. Check logs.');
    }
    setLoading(false);
  };

  const handleApprove = async () => {
    setLoading(true);
    const updated = await apiCall(`/invoices/${invoice._id}/approve`, { method: 'POST' }, userRole);
    if (updated) {
      setInvoice(updated);
      alert('Invoice status approved. Awaiting ERP posting.');
    }
    setLoading(false);
  };

  const handleReject = async () => {
    const comment = prompt('Enter rejection reason:');
    if (comment === null) return;
    setLoading(true);
    const updated = await apiCall(`/invoices/${invoice._id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comment })
    }, userRole);
    if (updated) {
      setInvoice(updated);
      alert('Invoice rejected.');
    }
    setLoading(false);
  };

  const handlePostERP = async () => {
    setLoading(true);
    const updated = await apiCall(`/invoices/${invoice._id}/post-erp`, { method: 'POST' }, userRole);
    if (updated) {
      setInvoice(updated);
      setValidationLogs(updated.postingLogs || []);
      alert(updated.postingStatus === 'Posted' 
        ? `Invoice posted successfully to Odoo! Doc: ${updated.erpDocNumber}`
        : 'Invoice staged but bill creation failed. Check Odoo log.'
      );
    }
    setLoading(false);
  };

  const checkDuplicates = () => {
    if (invoice.duplicateScore > 40) {
      onNavigateToDuplicates(invoice);
    } else {
      alert('No duplicate candidates found. Similarity index is low.');
    }
  };

  // Determine button accessibility based on roles
  const isReviewer = userRole === 'Reviewer';
  const isReadOnly = isReviewer;
  const canApprove = ['Finance Manager', 'Admin'].includes(userRole) && invoice.status !== 'Posted to ERP';
  const canPost = ['Finance Manager', 'Admin'].includes(userRole) && invoice.status === 'Approved';
  const isAPClerk = userRole === 'AP Clerk';

  return (
    <div>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={onBack} className="btn btn-secondary">← Back to Queue</button>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span className="status-badge" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 }}>
            Confidence: {Math.round(invoice.confidenceScore * 100)}%
          </span>
          <span className={`status-badge ${invoice.status.toLowerCase().replace(/ /g, '.')}`}>
            Status: {invoice.status}
          </span>
        </div>
      </div>

      {isReviewer && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          color: '#0369a1',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem'
        }}>
          <Eye size={16} />
          <span><strong>Reviewer Mode:</strong> You are logged in as a Reviewer. You can inspect the OCR extraction details, but editing fields, manual validations, and approvals are restricted.</span>
        </div>
      )}

      <div className="review-split">
        {/* Left pane: Image viewer */}
        <div className="review-left">
          <div className="pdf-viewport">
            {invoice.documentUrl && invoice.documentUrl.toLowerCase().includes('.pdf') && !invoice.documentUrl.toLowerCase().includes('cloudinary.com') ? (
              <object
                data={invoice.documentUrl}
                type="application/pdf"
                width="100%"
                height="100%"
              >
                <p>Alternative PDF link: <a href={invoice.documentUrl} target="_blank" rel="noopener noreferrer">View PDF</a></p>
              </object>
            ) : (
              <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <img
                  src={invoice.documentUrl && invoice.documentUrl.toLowerCase().includes('cloudinary.com') && invoice.documentUrl.toLowerCase().includes('.pdf')
                    ? invoice.documentUrl.replace(/\.pdf$/i, '.jpg')
                    : (invoice.documentUrl || 'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=60')
                  }
                  alt="Invoice preview"
                  className="pdf-image"
                  style={{ transform: `scale(${zoom})`, maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
                {invoice.documentUrl && invoice.documentUrl.toLowerCase().includes('cloudinary.com') && invoice.documentUrl.toLowerCase().includes('.pdf') && (
                  <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(255, 255, 255, 0.9)', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <a href={invoice.documentUrl.replace(/\.pdf$/i, '.jpg')} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                      Open Document Image ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="pdf-controls">
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.15))} className="btn btn-secondary" style={{ padding: '0.4rem' }}><ZoomOut size={16} /></button>
              <button onClick={() => setZoom(z => Math.min(2.5, z + 0.15))} className="btn btn-secondary" style={{ padding: '0.4rem' }}><ZoomIn size={16} /></button>
              <button onClick={() => setZoom(1)} className="btn btn-secondary" style={{ padding: '0.4rem' }}><RotateCcw size={16} /></button>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Page 1 of 1</span>
          </div>

          {/* Validation Logs Box */}
          <div className="card" style={{ padding: '1rem', flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldAlert size={16} style={{ color: 'var(--warning-text)' }} /> Validation & ERP Logs
            </h4>
            <div style={{ flexGrow: 1, overflowY: 'auto', maxHeight: '160px', fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              {validationLogs.length === 0 ? (
                <p>No active errors. Business rules passed.</p>
              ) : (
                validationLogs.map((log, i) => (
                  <p key={i} style={{ marginBottom: '0.25rem', color: log.includes('Error') ? 'var(--danger-text)' : 'inherit' }}>
                    • {log}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right pane: Form editor */}
        <div className="review-right">
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Invoice Metadata</h3>
            
            <fieldset disabled={isReadOnly || loading} style={{ border: 'none', padding: 0, margin: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Vendor Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoice.vendorName}
                    onChange={(e) => handleChange('vendorName', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>GSTIN / Tax ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoice.gstin}
                    onChange={(e) => handleChange('gstin', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Vendor Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoice.vendorAddress}
                    onChange={(e) => handleChange('vendorAddress', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Invoice Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoice.invoiceNumber}
                    onChange={(e) => handleChange('invoiceNumber', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Invoice Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={invoice.invoiceDate}
                    onChange={(e) => handleChange('invoiceDate', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Payment Terms</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoice.paymentTerms}
                    onChange={(e) => handleChange('paymentTerms', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Currency</label>
                  <input
                    type="text"
                    className="form-input"
                    value={invoice.currency}
                    onChange={(e) => handleChange('currency', e.target.value)}
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label>Tax Amount (10%)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={invoice.taxAmount}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label>Total Invoice Amount</label>
                  <input
                    type="text"
                    className="form-input"
                    value={`${invoice.currency} ${invoice.totalAmount}`}
                    disabled
                    style={{ fontWeight: 600, color: 'var(--primary)' }}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Purchase Order Number</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. PO-2026-0002"
                    value={invoice.poNumber}
                    onChange={(e) => handleChange('poNumber', e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            </fieldset>
          </div>

          {/* Line Items Card */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <fieldset disabled={isReadOnly || loading} style={{ border: 'none', padding: 0, margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.95rem' }}>Line Items Breakdown</h4>
                <button onClick={addLineItem} className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }} disabled={loading}>
                  <Plus size={14} /> Add Item
                </button>
              </div>

              <div className="table-container">
                <table className="enterprise-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th width="70">Qty</th>
                      <th width="90">Price</th>
                      <th width="90">Total</th>
                      <th width="40"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.lineItems || []).map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            type="text"
                            className="form-input"
                            value={item.description}
                            onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                            style={{ padding: '0.25rem', fontSize: '0.8rem', width: '100%' }}
                            disabled={loading}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                            style={{ padding: '0.25rem', fontSize: '0.8rem', width: '100%', textAlign: 'right' }}
                            disabled={loading}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            className="form-input"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            style={{ padding: '0.25rem', fontSize: '0.8rem', width: '100%', textAlign: 'right' }}
                            disabled={loading}
                          />
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {invoice.currency} {item.total}
                        </td>
                        <td>
                          <button onClick={() => deleteLineItem(idx)} className="btn-text-danger" style={{ padding: '0.15rem' }} disabled={loading}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </fieldset>
          </div>

          {/* Action Toolbar */}
          <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {!isReadOnly && (
              <>
                <button onClick={handleSave} className="btn btn-primary" disabled={loading}>
                  <Save size={14} /> Save Changes
                </button>

                <button onClick={handleValidate} className="btn btn-secondary" disabled={loading}>
                  <RefreshCw size={14} /> Run Validation
                </button>
              </>
            )}

            {invoice.duplicateScore > 40 && (
              <button onClick={checkDuplicates} className="btn btn-danger" disabled={loading}>
                <AlertTriangle size={14} /> Duplicate Candidates
              </button>
            )}

            {canApprove && (
              <>
                <button onClick={handleApprove} className="btn btn-success" disabled={loading}>
                  <CheckCircle size={14} /> Approve
                </button>
                <button onClick={handleReject} className="btn btn-danger" disabled={loading}>
                  <Ban size={14} /> Reject
                </button>
              </>
            )}

            {canPost && (
              <button onClick={handlePostERP} className="btn btn-primary" style={{ backgroundColor: '#0284c7' }} disabled={loading}>
                <ArrowRight size={14} /> Post to Odoo ERP
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceReview;
