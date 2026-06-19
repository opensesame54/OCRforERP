import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Search, History, Calendar, User } from 'lucide-react';

const AuditTrail = ({ userRole }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const fetchAudits = async () => {
    setLoading(true);
    const query = invoiceSearch ? `?invoiceNumber=${invoiceSearch}` : '';
    const data = await apiCall(`/audits${query}`, {}, userRole);
    if (data) {
      setLogs(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAudits();
  }, [userRole]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchAudits();
  };

  return (
    <div>
      <div className="card">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <History size={20} style={{ color: 'var(--primary)' }} />
          <span>System Action Ledger (Audit Trail)</span>
        </h3>

        {/* Filters */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', maxWidth: '400px' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Filter by invoice number (e.g. 51109338)..."
            value={invoiceSearch}
            onChange={(e) => setInvoiceSearch(e.target.value)}
            style={{ width: '100%' }}
          />
          <button type="submit" className="btn btn-secondary">Filter</button>
        </form>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading system activity logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
            No matching audit trails logged.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {logs.map((log) => (
              <div
                key={log._id}
                style={{
                  padding: '1rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '10px',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1.5rem'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="status-badge" style={{
                      backgroundColor: log.action === 'Upload' || log.action === 'Extraction' ? 'var(--primary-light)' : log.action === 'Approvals' || log.action === 'ERP Posting' ? 'var(--success-light)' : 'var(--danger-light)',
                      color: log.action === 'Upload' || log.action === 'Extraction' ? 'var(--primary)' : log.action === 'Approvals' || log.action === 'ERP Posting' ? 'var(--success-text)' : 'var(--danger-text)',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      {log.action}
                    </span>
                    {log.invoiceNumber && (
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        Invoice: {log.invoiceNumber}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginTop: '0.35rem' }}>{log.details}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', minWidth: '160px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 500 }}>
                    <User size={12} /> {log.performedBy} ({log.role})
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Calendar size={12} /> {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditTrail;
