import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Search, ChevronDown, RefreshCw, Eye } from 'lucide-react';

const StagingQueue = ({ userRole, onSelectInvoice }) => {
  const [invoices, setInvoices] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Filters and Query Params
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [order, setOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const handleSyncOdoo = async () => {
    setSyncing(true);
    try {
      const data = await apiCall('/invoices/sync-odoo', { method: 'POST' }, userRole);
      if (data) {
        alert(`Sync completed! Imported ${data.importedCount} new invoices.`);
        fetchInvoices();
      }
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };



  const fetchInvoices = async () => {
    setLoading(true);
    const query = `?status=${status}&search=${search}&sortBy=${sortBy}&order=${order}&page=${page}&limit=10`;
    const data = await apiCall(`/invoices${query}`, {}, userRole);
    if (data && data.invoices) {
      setInvoices(data.invoices);
      setTotal(data.total);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, [status, sortBy, order, page, userRole]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
    setPage(1);
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(invoices.map(i => i._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (actionType) => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    for (const id of selectedIds) {
      if (actionType === 'approve') {
        await apiCall(`/invoices/${id}/approve`, { method: 'POST' }, userRole);
      } else if (actionType === 'post') {
        await apiCall(`/invoices/${id}/post-erp`, { method: 'POST' }, userRole);
      }
    }
    setSelectedIds([]);
    await fetchInvoices();
    alert(`Bulk ${actionType} action completed successfully on matching items.`);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        {/* Controls Layout */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flexGrow: 1, maxWidth: '400px' }}>
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search vendor name or invoice number..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: '2.25rem', width: '100%' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
            </div>
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>

          {/* Filter dropdowns and refresh */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <select
              className="form-input"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              style={{ minWidth: '150px' }}
            >
              <option value="">All Statuses</option>
              <option value="Needs Review">Needs Review</option>
              <option value="Approved">Approved</option>
              <option value="Exception">Exception</option>
              <option value="Duplicate">Duplicate</option>
              <option value="Posted to ERP">Posted to ERP</option>
            </select>

            <button onClick={fetchInvoices} className="btn btn-secondary" title="Refresh queue">
              <RefreshCw size={16} />
            </button>

            <button 
              onClick={handleSyncOdoo} 
              className="btn btn-primary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} 
              disabled={syncing}
            >
              <RefreshCw size={16} style={{ animation: syncing ? 'spin 1.5s linear infinite' : 'none' }} />
              <span>{syncing ? 'Syncing...' : 'Sync Odoo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.length > 0 && userRole !== 'Reviewer' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', backgroundColor: 'var(--primary-light)', borderRadius: '10px', marginBottom: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>
            {selectedIds.length} invoices selected
          </span>
          <button onClick={() => handleBulkAction('approve')} className="btn btn-success" style={{ padding: '0.45rem 1rem' }}>Bulk Approve</button>
          <button onClick={() => handleBulkAction('post')} className="btn btn-primary" style={{ padding: '0.45rem 1rem' }}>Bulk Post to ERP</button>
          <button onClick={() => setSelectedIds([])} className="btn btn-secondary" style={{ padding: '0.45rem 1rem' }}>Cancel</button>
        </div>
      )}

      {/* Staging queue Table */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading staging invoices...
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-light)' }}>
            No invoices found in staging matching current query.
          </div>
        ) : (
          <div className="table-container">
            <table className="enterprise-table">
              <thead>
                <tr>
                  {userRole !== 'Reviewer' && (
                    <th width="40">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedIds.length === invoices.length && invoices.length > 0}
                      />
                    </th>
                  )}
                  <th onClick={() => handleSort('invoiceNumber')} style={{ cursor: 'pointer' }}>
                    Invoice Number {sortBy === 'invoiceNumber' && (order === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('vendorName')} style={{ cursor: 'pointer' }}>
                    Vendor {sortBy === 'vendorName' && (order === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('invoiceDate')} style={{ cursor: 'pointer' }}>
                    Invoice Date {sortBy === 'invoiceDate' && (order === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('totalAmount')} style={{ cursor: 'pointer' }} style={{ textAlign: 'right' }}>
                    Amount {sortBy === 'totalAmount' && (order === 'asc' ? '▲' : '▼')}
                  </th>
                  <th style={{ textAlign: 'right' }}>GST Amount</th>
                  <th>Status</th>
                  <th onClick={() => handleSort('duplicateScore')} style={{ cursor: 'pointer' }}>
                    Duplicate {sortBy === 'duplicateScore' && (order === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('confidenceScore')} style={{ cursor: 'pointer' }}>
                    Confidence {sortBy === 'confidenceScore' && (order === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Created Date</th>
                  <th width="80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    {userRole !== 'Reviewer' && (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(inv._id)}
                          onChange={() => handleSelectOne(inv._id)}
                        />
                      </td>
                    )}
                    <td style={{ fontWeight: 600 }}>{inv.invoiceNumber}</td>
                    <td>{inv.vendorName}</td>
                    <td>{inv.invoiceDate}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {inv.currency} {inv.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                      {inv.currency} {inv.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`status-badge ${inv.status.toLowerCase().replace(/ /g, '.')}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: inv.duplicateScore > 80 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {inv.duplicateScore}%
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: inv.confidenceScore < 0.75 ? 'var(--warning-text)' : 'var(--success-text)' }}>
                        {Math.round(inv.confidenceScore * 100)}%
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        className="btn btn-secondary btn-small"
                        onClick={() => onSelectInvoice(inv)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.35rem 0.65rem' }}
                      >
                        <Eye size={12} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Total {total} invoices
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            disabled={page === 1}
            onClick={() => setPage(prev => Math.max(1, prev - 1))}
            style={{ padding: '0.4rem 0.85rem' }}
          >
            Previous
          </button>
          <span style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem', fontWeight: 600 }}>
            Page {page} of {Math.max(1, Math.ceil(total / 10))}
          </span>
          <button
            className="btn btn-secondary"
            disabled={page >= Math.ceil(total / 10)}
            onClick={() => setPage(prev => prev + 1)}
            style={{ padding: '0.4rem 0.85rem' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default StagingQueue;
