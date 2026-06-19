import React, { useState, useEffect } from 'react';
import { apiCall } from '../utils/api';
import { BarChart, FileText, CheckCircle, AlertTriangle, AlertCircle, Users, Activity } from 'lucide-react';

const formatTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
};

const getActivityColor = (action) => {
  switch (action) {
    case 'Upload': return 'var(--primary)';
    case 'Sync': return 'var(--primary)';
    case 'Deletion': return 'var(--danger)';
    case 'Post': return 'var(--success)';
    case 'Approvals': return 'var(--success)';
    case 'Approval': return 'var(--success)';
    case 'Extraction': return 'var(--warning)';
    default: return 'var(--primary)';
  }
};

const Dashboard = ({ userRole }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const data = await apiCall('/invoices/stats', {}, userRole);
      setStats(data);
      try {
        const auditLogs = await apiCall('/audits', {}, userRole);
        if (auditLogs) {
          setActivities(auditLogs.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load audits:', err);
      }
      setLoading(false);
    };
    fetchStats();
  }, [userRole]);

  if (loading || !stats) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard analytics...</div>;
  }

  const { kpis, exceptionBreakdown, bottleneckList } = stats;

  return (
    <div>
      {/* KPIs Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: '#e0e7ff', color: '#4f46e5' }}>
            <FileText size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Total Invoices</span>
            <span className="kpi-value">{kpis.total}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
            <Activity size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Pending Review</span>
            <span className="kpi-value">{kpis.pending}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: '#d1fae5', color: '#059669' }}>
            <CheckCircle size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Approved</span>
            <span className="kpi-value">{kpis.approved}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}>
            <CheckCircle size={20} style={{ strokeWidth: 2.5 }} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Posted to ERP</span>
            <span className="kpi-value">{kpis.posted}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Exceptions</span>
            <span className="kpi-value">{kpis.exceptions}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-wrapper" style={{ backgroundColor: '#f1f5f9', color: '#475569' }}>
            <AlertCircle size={20} />
          </div>
          <div className="kpi-details">
            <span className="kpi-label">Duplicates</span>
            <span className="kpi-value">{kpis.duplicates}</span>
          </div>
        </div>
      </div>

      {/* Charts section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Exception Breakdown List */}
        <div className="card">
          <h3 className="card-title">Exceptions Breakdown</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {exceptionBreakdown.map((item, idx) => {
              const totalExceptions = exceptionBreakdown.reduce((a, c) => a + c.value, 0) || 1;
              const percent = Math.round((item.value / totalExceptions) * 100);
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 500 }}>{item.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{item.value} ({percent}%)</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: '#f1f5f9', borderRadius: '3px' }}>
                    <div style={{
                      height: '100%',
                      width: `${percent}%`,
                      backgroundColor: idx === 0 ? 'var(--danger)' : idx === 1 ? 'var(--warning)' : 'var(--primary)',
                      borderRadius: '3px'
                    }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid: Bottlenecks & Recent Activities */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <h3 className="card-title">
            <span><Users size={16} style={{ marginRight: '0.5rem' }} /> Approval Bottlenecks</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {bottleneckList.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: '#f8fafc', borderRadius: '10px' }}>
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{item.name}</span>
                <span className="status-badge exception" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}>
                  {item.pendingCount} pending
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Recent System Activity</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
            {activities.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No recent activities recorded.</div>
            ) : (
              activities.map((item, idx) => (
                <div key={idx} style={{ borderLeft: `2px solid ${getActivityColor(item.action)}`, paddingLeft: '1rem', position: 'relative' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{formatTimeAgo(item.timestamp)}</span>
                  <p style={{ fontWeight: 500, margin: '0.15rem 0' }}>{item.details}</p>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>By {item.performedBy} ({item.role})</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
