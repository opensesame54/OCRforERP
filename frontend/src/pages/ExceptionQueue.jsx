import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { ShieldAlert, AlertOctagon, UserCheck, CheckSquare, Eye } from 'lucide-react';

const ExceptionQueue = ({ userRole, onSelectInvoice }) => {
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExceptions = async () => {
    setLoading(true);
    const data = await apiCall('/invoices?status=Exception', {}, userRole);
    if (data && data.invoices) {
      setExceptions(data.invoices);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchExceptions();
  }, [userRole]);

  const handleOverride = async (id) => {
    setLoading(true);
    // Overriding the exceptions by routing status to Needs Review and clearing exception tag
    await apiCall(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'Needs Review', exceptionType: '', exceptionSeverity: 'None', isOverride: true })
    }, userRole);
    alert('Exception override approved. Invoice moved to approval center.');
    await fetchExceptions();
  };

  const reassignUser = async (id) => {
    const newUser = prompt('Enter reviewer username to assign to (e.g. Sarah Reviewer):');
    if (!newUser) return;
    setLoading(true);
    await apiCall(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ assignedTo: newUser })
    }, userRole);
    alert(`Invoice assigned to ${newUser}.`);
    await fetchExceptions();
  };

  return (
    <div>
      <div className="card">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} style={{ color: 'var(--danger)' }} />
          <span>Active Exception Queue</span>
        </h3>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading exception queue...</div>
        ) : exceptions.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
            Great job! Exception queue is currently empty.
          </div>
        ) : (
          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Exception Type</th>
                  <th>Vendor</th>
                  <th>Invoice Number</th>
                  <th>Total Amount</th>
                  <th>Assigned User</th>
                  <th>OCR Match Score</th>
                  <th width="240">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exceptions.map((ex) => (
                  <tr key={ex._id}>
                    <td>
                      <span className="status-badge exception" style={{
                        backgroundColor: ex.exceptionSeverity === 'High' ? 'var(--danger-light)' : 'var(--warning-light)',
                        color: ex.exceptionSeverity === 'High' ? 'var(--danger-text)' : 'var(--warning-text)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <AlertOctagon size={12} />
                        {ex.exceptionSeverity}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{ex.exceptionType || 'OCR Validation Issue'}</td>
                    <td>{ex.vendorName}</td>
                    <td>{ex.invoiceNumber}</td>
                    <td style={{ fontWeight: 600 }}>{ex.currency} {ex.totalAmount}</td>
                    <td>{ex.assignedTo || 'Unassigned'}</td>
                    <td style={{ fontWeight: 600 }}>{Math.round(ex.confidenceScore * 100)}%</td>
                    <td style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => onSelectInvoice(ex)} className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Eye size={12} /> View
                      </button>

                      <button onClick={() => reassignUser(ex._id)} className="btn btn-secondary btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <UserCheck size={12} /> Assign
                      </button>

                      {['Finance Manager', 'Admin'].includes(userRole) && (
                        <button onClick={() => handleOverride(ex._id)} className="btn btn-success btn-small" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <CheckSquare size={12} /> Override
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

export default ExceptionQueue;
