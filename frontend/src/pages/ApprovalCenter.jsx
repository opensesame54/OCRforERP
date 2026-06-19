import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { CheckCircle, XCircle, Clock, FileClock, Eye } from 'lucide-react';

const ApprovalCenter = ({ userRole, onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPendingApprovals = async () => {
    setLoading(true);
    // Fetch staging invoices matching review / approved status
    const data = await apiCall('/invoices', {}, userRole);
    if (data && data.invoices) {
      setInvoices(data.invoices.filter(i => ['Needs Review', 'Approved'].includes(i.status)));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPendingApprovals();
  }, [userRole]);

  const handleAction = async (id, actionType) => {
    setLoading(true);
    if (actionType === 'approve') {
      await apiCall(`/invoices/${id}/approve`, { method: 'POST' }, userRole);
      alert('Approval confirmed successfully.');
    } else if (actionType === 'clarify') {
      const notes = prompt('Enter request notes for AP Clerk clarification:');
      if (notes) {
        await apiCall(`/invoices/${id}`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'Needs Review', postingLogs: [`Clarification request: ${notes}`] })
        }, userRole);
        alert('Clarification request recorded.');
      }
    }
    await fetchPendingApprovals();
  };

  return (
    <div>
      <div className="card">
        <h3 className="card-title">Approval & Escalation Dashboard</h3>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading pending approvals...</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
            No invoices currently pending approvals.
          </div>
        ) : (
          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Vendor</th>
                  <th>Total Amount</th>
                  <th>Current Status</th>
                  <th>Assigned Approver</th>
                  <th>Escalation Track</th>
                  <th>OCR Confidence</th>
                  <th width="240">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td>{inv.vendorName}</td>
                    <td style={{ fontWeight: 600 }}>{inv.currency} {inv.totalAmount}</td>
                    <td>
                      <span className={`status-badge ${inv.status.toLowerCase().replace(/ /g, '.')}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>{inv.assignedTo || 'Sarah Reviewer'}</td>
                    <td>
                      <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--text-muted)' }}>
                        <FileClock size={14} /> Level 1 Staging
                      </span>
                    </td>
                    <td>{Math.round(inv.confidenceScore * 100)}%</td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => onSelectInvoice(inv)} className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Eye size={12} /> Review
                      </button>

                      {['Finance Manager', 'Admin'].includes(userRole) && inv.status === 'Needs Review' && (
                        <button onClick={() => handleAction(inv._id, 'approve')} className="btn btn-success btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckCircle size={12} /> Approve
                        </button>
                      )}

                      {['Reviewer', 'Finance Manager', 'Admin'].includes(userRole) && (
                        <button onClick={() => handleAction(inv._id, 'clarify')} className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={12} /> Clarify
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

export default ApprovalCenter;
