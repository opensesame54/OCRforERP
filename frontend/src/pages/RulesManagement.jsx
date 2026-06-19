import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { ToggleLeft, ToggleRight, Settings, ShieldCheck, AlertCircle } from 'lucide-react';

const RulesManagement = ({ userRole }) => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = async () => {
    setLoading(true);
    const data = await apiCall('/rules', {}, userRole);
    if (data) {
      setRules(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, [userRole]);

  const toggleRule = async (id, isEnabled) => {
    if (userRole !== 'Admin') return alert('Access Denied. Only system Administrators can toggle business rules.');
    setLoading(true);
    const result = await apiCall(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ isEnabled: !isEnabled })
    }, userRole);
    if (result) {
      await fetchRules();
    }
    setLoading(false);
  };

  const handleParamChange = async (id, fieldName, newVal) => {
    if (userRole !== 'Admin') return alert('Access Denied. Only system Administrators can modify rule parameters.');
    setLoading(true);
    const parsedVal = parseFloat(newVal) || newVal;
    const result = await apiCall(`/rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ parameters: { [fieldName]: parsedVal } })
    }, userRole);
    if (result) {
      await fetchRules();
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="card">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Settings size={20} style={{ color: 'var(--primary)' }} />
          <span>Business Rules Management Switchboard</span>
        </h3>
        
        {userRole !== 'Admin' && (
          <div style={{ padding: '0.75rem 1rem', backgroundColor: 'var(--warning-light)', borderRadius: '8px', border: '1px solid var(--warning)', color: 'var(--warning-text)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
            <AlertCircle size={16} />
            <span>Read-Only Mode: You must switch to Admin role to modify rules or parameters.</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>Loading system rules config...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {rules.map((rule) => (
              <div
                key={rule._id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  backgroundColor: rule.isEnabled ? '#ffffff' : '#f8fafc',
                  transition: 'all 0.2s ease',
                  opacity: rule.isEnabled ? 1 : 0.8
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexGrow: 1 }}>
                  <div style={{ marginTop: '3px', color: rule.isEnabled ? 'var(--primary)' : 'var(--text-light)' }}>
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: rule.isEnabled ? 'var(--text-main)' : 'var(--text-muted)' }}>{rule.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{rule.description}</p>
                    
                    {/* Dynamic parameters edit panel */}
                    {rule.isEnabled && rule.parameters && Object.keys(rule.parameters).length > 0 && (
                      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', marginTop: '0.75rem', backgroundColor: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {Object.entries(rule.parameters).map(([key, val]) => (
                          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-muted)' }}>{key.replace(/([A-Z])/g, ' $1')}:</span>
                            <input
                              type="number"
                              className="form-input"
                              value={val}
                              onChange={(e) => handleParamChange(rule._id, key, e.target.value)}
                              disabled={userRole !== 'Admin'}
                              style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => toggleRule(rule._id, rule.isEnabled)}
                  disabled={userRole !== 'Admin'}
                  style={{ background: 'none', border: 'none', cursor: userRole === 'Admin' ? 'pointer' : 'not-allowed', color: rule.isEnabled ? 'var(--primary)' : 'var(--text-light)' }}
                >
                  {rule.isEnabled ? <ToggleRight size={40} /> : <ToggleLeft size={40} />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RulesManagement;
