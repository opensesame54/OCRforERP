import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { Landmark, CheckCircle, AlertTriangle, Plus, Mail, Phone, MapPin } from 'lucide-react';

const VendorManagement = ({ userRole }) => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // New vendor form fields
  const [name, setName] = useState('');
  const [gstin, setGstin] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const fetchVendors = async () => {
    setLoading(true);
    const data = await apiCall('/vendors', {}, userRole);
    if (data) {
      setVendors(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVendors();
  }, [userRole]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !gstin) return alert('Name and GSTIN are required fields.');
    setLoading(true);
    const result = await apiCall('/vendors', {
      method: 'POST',
      body: JSON.stringify({ name, gstin, bankAccount, ifsc, paymentTerms, address, email, phone })
    }, userRole);

    if (result) {
      alert('Vendor registered successfully.');
      setShowAddForm(false);
      // Reset form
      setName(''); setGstin(''); setBankAccount(''); setIfsc(''); setPaymentTerms('Net 30'); setAddress(''); setEmail(''); setPhone('');
      await fetchVendors();
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>Registered Vendor Directory</h2>
        {['AP Clerk', 'Admin'].includes(userRole) && (
          <button onClick={() => setShowAddForm(p => !p)} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Plus size={16} /> {showAddForm ? 'Cancel' : 'Register Vendor'}
          </button>
        )}
      </div>

      {/* Add Vendor Form */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', animation: 'fadeIn 0.2s ease' }}>
          <h3 style={{ gridColumn: 'span 2', fontSize: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>New Vendor Registration</h3>
          <div className="form-group">
            <label>Vendor Name *</label>
            <input type="text" className="form-input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>GSTIN / Tax ID *</label>
            <input type="text" className="form-input" value={gstin} onChange={e => setGstin(e.target.value)} placeholder="e.g. 27AAAAA0000A1Z5" required />
          </div>
          <div className="form-group">
            <label>Bank Account IBAN</label>
            <input type="text" className="form-input" value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Bank IFSC / SWIFT Code</label>
            <input type="text" className="form-input" value={ifsc} onChange={e => setIfsc(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Payment Terms</label>
            <select className="form-input" value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30</option>
              <option value="Net 45">Net 45</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" className="form-input" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="form-group" style={{ gridColumn: 'span 2' }}>
            <label>Street Address</label>
            <input type="text" className="form-input" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>Register</button>
            <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* Directory list */}
      <div className="card">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading vendor records...</div>
        ) : vendors.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-light)' }}>
            No registered vendors found.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {vendors.map((vendor) => (
              <div key={vendor._id} className="card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{vendor.name}</h3>
                  <span className={`status-badge ${vendor.validationStatus === 'Verified' ? 'approved' : 'needs.review'}`}>
                    {vendor.validationStatus === 'Verified' ? <CheckCircle size={10} style={{ marginRight: '2px' }} /> : <AlertTriangle size={10} style={{ marginRight: '2px' }} />}
                    {vendor.validationStatus}
                  </span>
                </div>

                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '0.45rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MapPin size={14} /> {vendor.address || 'No address registered.'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={14} /> {vendor.email || 'No email registered.'}</div>
                </div>

                <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>GSTIN / VAT ID:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{vendor.gstin}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Payment Terms:</span>
                    <span>{vendor.paymentTerms}</span>
                  </div>
                </div>

                {vendor.bankAccount && (
                  <div style={{ marginTop: 'auto', backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Landmark size={16} style={{ color: 'var(--text-light)' }} />
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-main)' }}>Bank Account</p>
                      <p style={{ fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>IBAN: {vendor.bankAccount}</p>
                      <p style={{ color: 'var(--text-muted)' }}>IFSC/SWIFT: {vendor.ifsc}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorManagement;
