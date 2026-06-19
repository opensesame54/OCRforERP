import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { AlertTriangle, ArrowLeft, Check, Merge, Eye, Trash2 } from 'lucide-react';

const DuplicateDetection = ({ userRole, targetInvoice, onBack, onResolve }) => {
  const [matchingInvoices, setMatchingInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      setLoading(true);
      // Fetch all invoices to locate the duplicate matching candidates
      const data = await apiCall('/invoices', {}, userRole);
      if (data && data.invoices) {
        const candidates = data.invoices.filter(i => 
          i._id !== targetInvoice._id &&
          (i.invoiceNumber === targetInvoice.invoiceNumber || i.totalAmount === targetInvoice.totalAmount)
        );
        setMatchingInvoices(candidates);
      }
      setLoading(false);
    };
    fetchMatches();
  }, [targetInvoice, userRole]);

  const handleAction = async (actionType, matchingInvId) => {
    setLoading(true);
    if (actionType === 'duplicate') {
      // Set status to duplicate
      await apiCall(`/invoices/${targetInvoice._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Duplicate', exceptionType: 'Duplicate Invoice Confirmed' })
      }, userRole);
      alert('Invoice successfully marked as Duplicate and shelved.');
    } else if (actionType === 'merge') {
      // Mark target as duplicate and merge into matching
      await apiCall(`/invoices/${targetInvoice._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Duplicate', exceptionType: `Merged into ${matchingInvId}` })
      }, userRole);
      alert('Invoices merged. Duplicate instance deactivated.');
    } else if (actionType === 'ignore') {
      // Force status back to Needs Review and clear duplicate exception
      await apiCall(`/invoices/${targetInvoice._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Needs Review', exceptionType: '', duplicateScore: 0 })
      }, userRole);
      alert('Similarity warning ignored. Re-entered processing queue.');
    }
    setLoading(false);
    if (onResolve) onResolve();
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading duplicate candidate analysis...</div>;

  const match = matchingInvoices[0] || {
    invoiceNumber: '51109338',
    vendorName: 'Andrews, Kirby and Valdez',
    invoiceDate: '2026-04-13',
    totalAmount: 6204.19,
    currency: 'USD',
    status: 'Posted to ERP',
    erpDocNumber: 'BILL-1002'
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={onBack} className="btn btn-secondary" style={{ padding: '0.4rem' }}><ArrowLeft size={16} /></button>
        <h2>Duplicate Detection Center</h2>
        <span className="status-badge exception" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem', marginLeft: 'auto' }}>
          Similarity Score: {targetInvoice.duplicateScore}%
        </span>
      </div>

      <div className="card" style={{ backgroundColor: 'var(--danger-light)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <AlertTriangle size={24} style={{ color: 'var(--danger-text)', flexShrink: 0 }} />
        <div>
          <h4 style={{ color: 'var(--danger-text)', fontSize: '0.95rem' }}>Potential Duplicate Candidate Identified</h4>
          <p style={{ color: 'var(--danger-text)', fontSize: '0.8rem', opacity: 0.9 }}>
            The uploaded invoice shares matching core properties (Vendor, Number, or Amount) with an active invoice record already staged or posted in the system.
          </p>
        </div>
      </div>

      {/* Side-by-Side Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1.5rem' }}>
        {/* Current Upload */}
        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--primary)' }}>A. Newly Uploaded Invoice</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Invoice Number:</span>
              <span style={{ fontWeight: 600 }}>{targetInvoice.invoiceNumber}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Vendor Name:</span>
              <span>{targetInvoice.vendorName}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Invoice Date:</span>
              <span>{targetInvoice.invoiceDate}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Amount:</span>
              <span style={{ fontWeight: 600 }}>{targetInvoice.currency} {targetInvoice.totalAmount}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
              <span className="status-badge exception">{targetInvoice.status}</span>
            </div>
          </div>
        </div>

        {/* Existing Record */}
        <div className="card">
          <h3 className="card-title" style={{ color: 'var(--success-text)' }}>B. Existing Invoice Record</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Invoice Number:</span>
              <span style={{ fontWeight: 600 }}>{match.invoiceNumber}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Vendor Name:</span>
              <span>{match.vendorName}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Invoice Date:</span>
              <span>{match.invoiceDate}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Amount:</span>
              <span style={{ fontWeight: 600 }}>{match.currency} {match.totalAmount}</span>
            </div>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <span style={{ width: '120px', fontWeight: 600, color: 'var(--text-muted)' }}>ERP Status:</span>
              <span className="status-badge approved">{match.status} {match.erpDocNumber ? `(${match.erpDocNumber})` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decision actions bar */}
      <div className="card" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
        <button onClick={() => handleAction('duplicate', match._id)} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Trash2 size={16} /> Mark as Duplicate (Shelve)
        </button>

        <button onClick={() => handleAction('merge', match._id)} className="btn btn-primary" style={{ backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Merge size={16} /> Merge Records
        </button>

        <button onClick={() => handleAction('ignore', match._id)} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Check size={16} /> Ignore Similarity (Proceed)
        </button>
      </div>
    </div>
  );
};

export default DuplicateDetection;
