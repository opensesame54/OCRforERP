import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Send, CheckCircle2, XCircle, RefreshCw, Eye } from 'lucide-react';

const ERPPostingCenter = ({ userRole, onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchERPStatus = async () => {
    setLoading(true);
    const data = await apiCall('/invoices', {}, userRole);
    if (data && data.invoices) {
      // Show posted or failed items, or those approved awaiting posting
      setInvoices(data.invoices.filter(i => ['Posted to ERP', 'Approved', 'Exception'].includes(i.status)));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchERPStatus();
  }, [userRole]);

  const handleRetry = async (id) => {
    setLoading(true);
    const data = await apiCall(`/invoices/${id}/post-erp`, { method: 'POST' }, userRole);
    if (data) {
      alert(data.postingStatus === 'Posted'
        ? `Successfully synced invoice with Odoo! Bill ID: ${data.erpDocNumber}`
        : 'Posting staged but Odoo bill creation failed. Check logs.'
      );
    }
    await fetchERPStatus();
  };

  return (
    <div>
      <div className="card">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Send size={20} style={{ color: 'var(--primary)' }} />
          <span>ERP Posting Console</span>
        </h3>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading ERP sync ledger...</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
            No ERP postings recorded.
          </div>
        ) : (
          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Invoice Number</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                  <th>Posting Status</th>
                  <th>ERP Document Ref</th>
                  <th>Sync Log Preview</th>
                  <th width="220">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td style={{ fontWeight: 600 }}>{inv.vendorName}</td>
                    <td>{inv.invoiceNumber}</td>
                    <td>{inv.currency} {inv.totalAmount}</td>
                    <td>
                      <span className={`status-badge ${inv.status.toLowerCase().replace(/ /g, '.')}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${inv.postingStatus === 'Posted' ? 'approved' : inv.postingStatus === 'Failed' ? 'exception' : 'needs.review'}`}>
                        {inv.postingStatus || 'Awaiting Post'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      {inv.erpDocNumber || '—'}
                    </td>
                    <td style={{ fontSize: '0.75rem', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {inv.postingLogs && inv.postingLogs.length > 0
                        ? inv.postingLogs[inv.postingLogs.length - 1]
                        : 'No posting activities recorded.'
                      }
                    </td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => onSelectInvoice(inv)} className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Eye size={12} /> View
                      </button>

                      {['Finance Manager', 'Admin'].includes(userRole) && inv.status !== 'Posted to ERP' && (
                        <button onClick={() => handleRetry(inv._id)} className="btn btn-primary btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <RefreshCw size={12} /> Post/Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ERPPostingCenter;
