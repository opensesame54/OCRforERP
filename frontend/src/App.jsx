import React, { useState } from 'react';
import { 
  BarChart3, UploadCloud, ListCollapse, Eye, AlertOctagon, 
  UserCheck, ShieldCheck, Landmark, ShoppingBag, Settings, 
  History, Bell, User, ChevronDown, LogOut
} from 'lucide-react';

import Dashboard from './pages/Dashboard';
import UploadInvoice from './pages/UploadInvoice';
import StagingQueue from './pages/StagingQueue';
import InvoiceReview from './pages/InvoiceReview';
import DuplicateDetection from './pages/DuplicateDetection';
import ExceptionQueue from './pages/ExceptionQueue';
import ApprovalCenter from './pages/ApprovalCenter';
import ERPPostingCenter from './pages/ERPPostingCenter';
import VendorManagement from './pages/VendorManagement';
import POMatching from './pages/POMatching';
import RulesManagement from './pages/RulesManagement';
import AuditTrail from './pages/AuditTrail';
import Login from './pages/Login';

function App() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });
  const [userRole, setUserRole] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored).role : 'Admin';
    } catch (e) {
      return 'Admin';
    }
  });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [targetDuplicateInvoice, setTargetDuplicateInvoice] = useState(null);
  const [notifications, setNotifications] = useState([
    { id: 1, text: 'New exception: PO Mismatch found on Invoice INV-2026-991.' },
    { id: 2, text: 'High duplicate index score detected on newly staged file.' }
  ]);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);

  const navigateToReview = (invoice) => {
    setSelectedInvoice(invoice);
    setActivePage('InvoiceReview');
  };

  const navigateToDuplicates = (invoice) => {
    setTargetDuplicateInvoice(invoice);
    setActivePage('DuplicateDetection');
  };

  const handleLogin = (userData) => {
    setUser(userData);
    setUserRole(userData.role);
    setActivePage('Dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setUserRole('Admin');
    setSelectedInvoice(null);
    setTargetDuplicateInvoice(null);
  };

  const getAllowedMenuItems = () => {
    if (userRole === 'Reviewer') {
      return menuItems.filter(item => ['Dashboard', 'Staging Queue'].includes(item.name));
    }
    if (userRole === 'AP Clerk') {
      return menuItems.filter(item => 
        ['Dashboard', 'Upload Invoice', 'Staging Queue', 'Exception Queue', 'POMatching', 'Vendor Management'].includes(item.name)
      );
    }
    if (userRole === 'Finance Manager') {
      return menuItems.filter(item => 
        ['Dashboard', 'Staging Queue', 'Exception Queue', 'Approval Center', 'ERP Posting Center', 'POMatching', 'Vendor Management', 'Audit Trail'].includes(item.name)
      );
    }
    return menuItems;
  };

  const menuItems = [
    { name: 'Dashboard', icon: BarChart3 },
    { name: 'Upload Invoice', icon: UploadCloud },
    { name: 'Staging Queue', icon: ListCollapse },
    { name: 'Exception Queue', icon: AlertOctagon },
    { name: 'Approval Center', icon: UserCheck },
    { name: 'ERP Posting Center', icon: ShieldCheck },
    { name: 'POMatching', icon: ShoppingBag },
    { name: 'Vendor Management', icon: Landmark },
    { name: 'Rules Management', icon: Settings },
    { name: 'Audit Trail', icon: History }
  ];

  const renderPage = () => {
    switch (activePage) {
      case 'Dashboard':
        return <Dashboard userRole={userRole} />;
      case 'Upload Invoice':
        return <UploadInvoice userRole={userRole} onInvoiceUploaded={(inv) => navigateToReview(inv)} />;
      case 'Staging Queue':
        return <StagingQueue userRole={userRole} onSelectInvoice={navigateToReview} />;
      case 'InvoiceReview':
        return (
          <InvoiceReview 
            userRole={userRole} 
            selectedInvoice={selectedInvoice} 
            onBack={() => setActivePage('Staging Queue')} 
            onNavigateToDuplicates={navigateToDuplicates}
          />
        );
      case 'DuplicateDetection':
        return (
          <DuplicateDetection 
            userRole={userRole} 
            targetInvoice={targetDuplicateInvoice} 
            onBack={() => navigateToReview(targetDuplicateInvoice)} 
            onResolve={() => setActivePage('Staging Queue')}
          />
        );
      case 'Exception Queue':
        return <ExceptionQueue userRole={userRole} onSelectInvoice={navigateToReview} />;
      case 'Approval Center':
        return <ApprovalCenter userRole={userRole} onSelectInvoice={navigateToReview} />;
      case 'ERP Posting Center':
        return <ERPPostingCenter userRole={userRole} onSelectInvoice={navigateToReview} />;
      case 'Vendor Management':
        return <VendorManagement userRole={userRole} />;
      case 'POMatching':
        return <POMatching userRole={userRole} />;
      case 'Rules Management':
        return <RulesManagement userRole={userRole} />;
      case 'Audit Trail':
        return <AuditTrail userRole={userRole} />;
      default:
        return <Dashboard userRole={userRole} />;
    }
  };

  if (!user) {
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">🧾</div>
          <h2>Accounts Payable</h2>
        </div>

        <nav className="nav-links">
          {getAllowedMenuItems().map((item) => {
            const Icon = item.icon;
            const isPageActive = activePage === item.name || 
              (item.name === 'Staging Queue' && activePage === 'InvoiceReview') ||
              (item.name === 'Staging Queue' && activePage === 'DuplicateDetection');

            return (
              <a
                key={item.name}
                href="#"
                className={`nav-item ${isPageActive ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  setActivePage(item.name);
                }}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </a>
            );
          })}
        </nav>

        {/* Logout Section */}
        <div className="user-selector" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleLogout}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--danger-text)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="main-content">
        <header className="navbar">
          <div className="navbar-title">
            <h1>{activePage === 'InvoiceReview' ? 'Review Extracted Fields' : activePage === 'DuplicateDetection' ? 'Duplicate Analysis' : activePage}</h1>
          </div>

          <div className="navbar-actions">
            {/* Notifications panel */}
            <div style={{ position: 'relative' }}>
              <button 
                className="navbar-btn"
                onClick={() => setShowNotificationPopup(!showNotificationPopup)}
              >
                <Bell size={20} />
                {notifications.length > 0 && <span className="badge-dot"></span>}
              </button>

              {showNotificationPopup && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '30px',
                  width: '320px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: 'var(--shadow-lg)',
                  padding: '1rem',
                  zIndex: 100,
                  animation: 'fadeIn 0.2s ease'
                }}>
                  <h4 style={{ fontSize: '0.85rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>System Notifications</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifications.map(n => (
                      <p key={n.id} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        • {n.text}
                      </p>
                    ))}
                    <button 
                      onClick={() => setNotifications([])}
                      className="btn btn-secondary btn-small"
                      style={{ fontSize: '0.7rem', alignSelf: 'flex-end', padding: '0.25rem 0.5rem' }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar info */}
            <div className="user-profile">
              <div className="avatar" title={user.email}>
                {(user.name || userRole).substring(0, 2).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-name">{user.name || `${userRole} User`}</span>
                <span className="user-role">{userRole} Scope</span>
              </div>
            </div>
          </div>
        </header>

        {/* Rendering current subpage */}
        <section className="page-body">
          {renderPage()}
        </section>
      </main>
    </div>
  );
}

export default App;
