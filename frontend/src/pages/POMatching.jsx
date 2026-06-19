import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { ShoppingCart, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

const POMatching = ({ userRole }) => {
  const [invoices, setInvoices] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInv, setSelectedInv] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const invData = await apiCall('/invoices', {}, userRole);
      const poData = await apiCall('/pos', {}, userRole);
      
      if (invData && invData.invoices) {
        setInvoices(invData.invoices.filter(i => i.poNumber));
      }
      if (poData) {
        setPurchaseOrders(poData);
      }
      setLoading(false);
    };
    fetchData();
  }, [userRole]);

  const activePO = selectedInv 
    ? purchaseOrders.find(p => p.poNumber === selectedInv.poNumber) 
    : null;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        {/* Left Side: Staged Invoices list with PO References */}
        <div className="card">
          <h3 className="card-title">Select Staged Invoice</h3>
          {loading ? (
            <p>Loading records...</p>
          ) : invoices.length === 0 ? (
            <p style={{ color: 'var(--text-light)', fontSize: '0.85rem' }}>No staged invoices reference purchase orders.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {invoices.map((inv) => (
                <div
                  key={inv._id}
                  onClick={() => setSelectedInv(inv)}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: selectedInv?._id === inv._id ? 'var(--primary-light)' : '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: selectedInv?._id === inv._id ? 'var(--primary)' : 'var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Invoice: {inv.invoiceNumber}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PO Ref: {inv.poNumber}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{inv.currency} {inv.totalAmount}</span>
                    <span className={`status-badge ${inv.matchingStatus.toLowerCase().replace(/ /g, '.')}`} style={{ fontSize: '0.7rem' }}>
                      {inv.matchingStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: POMatch comparison board */}
        <div className="card">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={18} style={{ color: 'var(--primary)' }} />
            <span>3-Way Matching Dashboard</span>
          </h3>

          {!selectedInv ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-light)' }}>
              Select a staged invoice from the left panel to inspect matching matrix.
            </div>
          ) : !activePO ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-light)' }}>
              Purchase Order Reference "{selectedInv.poNumber}" cannot be found in the database.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Match Header KPI details */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>2-Way Match (Price)</p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: selectedInv.matchingStatus.includes('Variance') ? 'var(--danger-text)' : 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                    {selectedInv.matchingStatus.includes('Variance') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    {selectedInv.matchingStatus.includes('Variance') ? 'Failed' : 'Passed'}
                  </p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>3-Way Match (Goods Rec)</p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: selectedInv.matchingStatus.includes('Passed') ? 'var(--success-text)' : 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                    {selectedInv.matchingStatus.includes('3-Way') ? <ShieldCheck size={16} /> : <AlertTriangle size={16} />}
                    {selectedInv.matchingStatus.includes('3-Way') ? 'Passed' : 'Pending/Failed'}
                  </p>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Price Tolerance Rule</p>
                  <p style={{ fontSize: '1.05rem', fontWeight: 700, color: selectedInv.matchingStatus.includes('Tolerance') ? 'var(--danger-text)' : 'var(--success-text)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.15rem' }}>
                    {selectedInv.matchingStatus.includes('Tolerance') ? <AlertTriangle size={16} /> : <CheckCircle size={16} />}
                    {selectedInv.matchingStatus.includes('Tolerance') ? 'Exceeded' : 'Within Limits'}
                  </p>
                </div>
              </div>

              {/* Items Alignment Matrix */}
              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>Items Alignment Matrix (Invoice vs PO)</h4>
                <div className="table-container">
                  <table className="enterprise-table" style={{ fontSize: '0.8rem' }}>
                    <thead>
                      <tr>
                        <th>Invoice Item Description</th>
                        <th style={{ textAlign: 'right' }}>Inv Qty</th>
                        <th style={{ textAlign: 'right' }}>Inv Unit Price</th>
                        <th style={{ textAlign: 'right' }}>PO Qty</th>
                        <th style={{ textAlign: 'right' }}>PO Rec Qty</th>
                        <th style={{ textAlign: 'right' }}>PO Unit Price</th>
                        <th style={{ textAlign: 'right' }}>Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInv.lineItems.map((invItem, idx) => {
                        const poItem = activePO.items.find(pi => 
                          pi.description.toLowerCase().includes(invItem.description.toLowerCase()) ||
                          invItem.description.toLowerCase().includes(pi.description.toLowerCase())
                        ) || { quantity: '—', receivedQty: '—', unitPrice: 0 };
                        
                        const priceDiff = poItem.unitPrice ? (((invItem.unitPrice - poItem.unitPrice) / poItem.unitPrice) * 100) : 0;

                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 500 }}>{invItem.description}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{invItem.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{selectedInv.currency} {invItem.unitPrice}</td>
                            <td style={{ textAlign: 'right' }}>{poItem.quantity}</td>
                            <td style={{ textAlign: 'right', color: 'var(--success-text)' }}>{poItem.receivedQty}</td>
                            <td style={{ textAlign: 'right' }}>{selectedInv.currency} {poItem.unitPrice || '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: priceDiff > 5 ? 'var(--danger-text)' : priceDiff > 0 ? 'var(--warning-text)' : 'var(--success-text)' }}>
                              {priceDiff > 0 ? `+${priceDiff.toFixed(1)}%` : priceDiff < 0 ? `${priceDiff.toFixed(1)}%` : '0.0%'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POMatching;
