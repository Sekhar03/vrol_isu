import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CLIENT_DEMO } from './demoFallback.js';

// API BASE URL
const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const isInitialized = useRef(false);

  // Navigation: 'selector' | 'merchant' | 'admin' | 'partner'
  const [view, setView] = useState(() => {
    try {
      const storedUser = localStorage.getItem('isu_currentUser');
      const storedView = localStorage.getItem('isu_view');
      // Only restore non-selector views if we also have a valid stored user
      if (storedView && storedView !== 'selector' && storedUser) {
        JSON.parse(storedUser); // validate JSON
        return storedView;
      }
    } catch { /* ignore */ }
    return 'selector';
  });
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('isu_dark_mode') === 'true');
  
  // Shared States (synchronized with Express + MongoDB)
  const [users, setUsers] = useState([]);
  const [chargebacks, setChargebacks] = useState([]);
  const [ledger, setLedger] = useState([]);
  
  // Active User State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('isu_currentUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('isu_currentUser');
      localStorage.removeItem('isu_view');
      return null;
    }
  });

  // Safety: if currentUser becomes null but view is a portal, reset to selector
  // Use isInitialized to avoid triggering on the very first render
  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      return;
    }
    if (!currentUser && view !== 'selector') {
      setView('selector');
      localStorage.setItem('isu_view', 'selector');
    }
  }, [currentUser, view]);
  
  // Toast state
  const [toastMsg, setToastMsg] = useState({ text: '', type: '' });
  
  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  const toggleTheme = () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);
    localStorage.setItem('isu_dark_mode', newTheme);
  };

  const refreshAllData = useCallback(async (userOverride) => {
    try {
      const activeUser = userOverride || currentUser;
      const headers = {};
      if (activeUser) {
        headers['x-user-role'] = activeUser.role;
        headers['x-user-name'] = activeUser.username;
        if (activeUser.role === 'partner') {
          headers['x-partner-id'] = activeUser.username;
        }
      }

      const resUsers = await fetch(`${API_URL}/users`, { headers });
      if (!resUsers.ok) throw new Error('Users fetch failed');
      const dataUsers = await resUsers.json();
      if (Array.isArray(dataUsers)) setUsers(dataUsers);

      const resDisputes = await fetch(`${API_URL}/disputes`, { headers });
      if (!resDisputes.ok) throw new Error('Disputes fetch failed');
      const dataDisputes = await resDisputes.json();
      if (Array.isArray(dataDisputes)) setChargebacks(dataDisputes);

      const resLedger = await fetch(`${API_URL}/ledger`, { headers }).catch(() => null);
      if (resLedger && resLedger.ok) {
        const dataLedger = await resLedger.json();
        if (Array.isArray(dataLedger)) setLedger(dataLedger);
      }

      // Keep current user session synced with updated database balance
      if (activeUser && Array.isArray(dataUsers)) {
        const found = dataUsers.find(u => u.username === activeUser.username);
        if (found) {
          setCurrentUser(prev => prev ? ({ ...prev, walletBalance: found.walletBalance }) : null);
        }
      }
    } catch (err) {
      console.error("Sync failed:", err);
      // Don't crash - keep existing data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const hydrateDemoBundle = useCallback((bundle, user) => {
    if (Array.isArray(bundle.users)) setUsers(bundle.users);
    if (Array.isArray(bundle.chargebacks)) setChargebacks(bundle.chargebacks);
    if (Array.isArray(bundle.ledger)) setLedger(bundle.ledger);
    if (user && Array.isArray(bundle.users)) {
      const found = bundle.users.find((u) => u.username === user.username);
      if (found) {
        setCurrentUser((prev) => (prev ? { ...prev, walletBalance: found.walletBalance } : null));
      }
    }
  }, []);

  const applyClientDemoFallback = useCallback((user) => {
    hydrateDemoBundle(CLIENT_DEMO, user || currentUser);
    return CLIENT_DEMO.chargebacks.length > 0;
  }, [currentUser, hydrateDemoBundle]);

  const fetchDemoBundle = useCallback(async () => {
    await fetch(`${API_URL}/users/seed`, { method: 'POST' }).catch(() => null);
    await fetch(`${API_URL}/users/demo`, { method: 'POST' }).catch(() => null);
    const bootRes = await fetch(`${API_URL}/users/bootstrap`);
    if (!bootRes.ok) {
      const err = await bootRes.json().catch(() => ({}));
      throw new Error(err.message || `Bootstrap failed (${bootRes.status})`);
    }
    return bootRes.json();
  }, []);

  const ensureDemoDataLoaded = useCallback(async (user) => {
    try {
      const bundle = await fetchDemoBundle();
      if (!bundle.chargebacks?.length) {
        throw new Error('No chargeback records in database');
      }
      hydrateDemoBundle(bundle, user);
      return true;
    } catch (err) {
      console.error('ensureDemoDataLoaded failed:', err);
      return applyClientDemoFallback(user);
    }
  }, [fetchDemoBundle, hydrateDemoBundle, applyClientDemoFallback]);

  // Seed demo data on launch then fetch
  useEffect(() => {
    ensureDemoDataLoaded(null);
  }, [ensureDemoDataLoaded]);

  // If logged into a portal with no rows, reload demo data
  useEffect(() => {
    if (view === 'selector' || !currentUser) return;
    if (chargebacks.length === 0) {
      ensureDemoDataLoaded(currentUser);
    }
  }, [view, currentUser, chargebacks.length, ensureDemoDataLoaded]);

  // Poll database every 3 seconds to synchronize states in real-time across tabs/roles
  useEffect(() => {
    const interval = setInterval(() => {
      if (view !== 'selector') {
        refreshAllData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [view, refreshAllData]);

  const showToast = (text, type = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg({ text: '', type: '' }), 3400);
  };

  const loadDemoData = async () => {
    try {
      const bundle = await fetchDemoBundle();
      if (!bundle.chargebacks?.length) {
        throw new Error('Server returned empty chargeback list');
      }
      hydrateDemoBundle(bundle, currentUser);
      showToast(`Demo loaded: ${bundle.chargebacks.length} chargebacks, ${bundle.users?.length || 0} users`);
      return true;
    } catch (err) {
      console.error('Demo data load failed:', err);
      if (applyClientDemoFallback(currentUser)) {
        showToast(`Demo loaded offline: ${CLIENT_DEMO.chargebacks.length} chargebacks (start server for full dataset)`);
        return true;
      }
      showToast(`Failed to load demo data: ${err.message}. Is the server running on port 5000?`, 'error');
      return false;
    }
  };

  // Format currencies and date utils
  const formatINR = (val) => {
    const num = parseFloat(val) || 0;
    return '₹ ' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const formatDateDisp = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.getDate().toString().padStart(2, '0') + '-' + 
           (d.getMonth() + 1).toString().padStart(2, '0') + '-' + 
           d.getFullYear();
  };

  const handleLogin = async (e, username, password) => {
    e.preventDefault();
    const u = users.find(x => x.username === username && x.password === password);
    let loggedUser = null;
    let loggedView = 'selector';

    if (u) {
      loggedUser = { username: u.username, name: u.name, role: u.role, walletBalance: u.walletBalance };
      loggedView = u.role;
      showToast(`Logged in as ${u.name} (${u.role})`);
    } else {
      // Fallback credentials (used when API is slow or unavailable)
      const fallbacks = {
        'masteruser':  { pw: 'Test@2026', user: { username: 'masteruser',  name: 'masteruser',            role: 'merchant', walletBalance: 964.35 } },
        'Test@isu':    { pw: 'Test@2026', user: { username: 'Test@isu',    name: 'Test@isu',              role: 'merchant', walletBalance: 12450.75 } },
        'Test@Ad':     { pw: 'Test@2027', user: { username: 'Test@Ad',     name: 'Krishna Das',           role: 'admin', walletBalance: 245800 } },
        'partneruser': { pw: 'Test@2028', user: { username: 'partneruser', name: 'Arjun Mehta (Partner)', role: 'partner', walletBalance: 0 } },
      };
      const match = fallbacks[username];
      if (match && match.pw === password) {
        loggedUser = match.user;
        loggedView = match.user.role;
        showToast(`Logged in as ${match.user.name} (${match.user.role})`);
      } else {
        showToast('Invalid username or password', 'error');
        return;
      }
    }

    setCurrentUser(loggedUser);
    setView(loggedView);
    localStorage.setItem('isu_currentUser', JSON.stringify(loggedUser));
    localStorage.setItem('isu_view', loggedView);

    await ensureDemoDataLoaded(loggedUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setView('selector');
    localStorage.removeItem('isu_currentUser');
    localStorage.removeItem('isu_view');
    showToast('Logged out successfully');
  };

  const resetAllSessions = async () => {
    if (confirm('Reset all demo data? Users, chargebacks, and ledger will be restored to defaults.')) {
      try {
        const ok = await loadDemoData();
        if (!ok) return;
        localStorage.removeItem('isu_session');
        localStorage.removeItem('isu_currentUser');
        localStorage.removeItem('isu_view');
        setCurrentUser(null);
        setView('selector');
      } catch (err) {
        console.error("Reset error:", err);
        showToast('Failed to reset', 'error');
      }
    }
  };

  return (
    <>
      {/* Show login only when view is selector */}
      {view === 'selector' && (
        <LoginForm handleLogin={handleLogin} toggleTheme={toggleTheme} darkMode={darkMode} onLoadDemo={loadDemoData} />
      )}
      
      {view === 'merchant' && currentUser && (
        <MerchantPortal 
          currentUser={currentUser} 
          chargebacks={chargebacks} 
          users={users}
          setView={setView} 
          toggleTheme={toggleTheme} 
          darkMode={darkMode}
          formatINR={formatINR}
          formatDateDisp={formatDateDisp}
          showToast={showToast}
          refreshAllData={refreshAllData}
          resetAllSessions={resetAllSessions}
          handleLogout={handleLogout}
        />
      )}
      
      {view === 'admin' && currentUser && (
        <AdminPortal 
          currentUser={currentUser} 
          chargebacks={chargebacks} 
          users={users}
          ledger={ledger}
          setView={setView} 
          toggleTheme={toggleTheme} 
          darkMode={darkMode}
          formatINR={formatINR}
          formatDateDisp={formatDateDisp}
          showToast={showToast}
          refreshAllData={refreshAllData}
          resetAllSessions={resetAllSessions}
          handleLogout={handleLogout}
        />
      )}

      {view === 'partner' && currentUser && (
        <PartnerPortal 
          currentUser={currentUser} 
          users={users}
          chargebacks={chargebacks}
          setView={setView} 
          toggleTheme={toggleTheme} 
          darkMode={darkMode}
          formatINR={formatINR}
          formatDateDisp={formatDateDisp}
          showToast={showToast}
          refreshAllData={refreshAllData}
          resetAllSessions={resetAllSessions}
          handleLogout={handleLogout}
        />
      )}

      {/* Toast Alert Component */}
      {toastMsg.text && (
        <div className={`toast show ${toastMsg.type}`}>
          <span style={{ marginRight: '8px' }}>
            {toastMsg.type === 'success' ? '✅' : toastMsg.type === 'error' ? '❌' : '⚠️'}
          </span>
          <span>{toastMsg.text}</span>
        </div>
      )}
    </>
  );
}

// ═════════════════════════════════════════════
// PORTAL SELECTOR PAGE
// ═════════════════════════════════════════════
function LoginForm({ handleLogin, toggleTheme, darkMode, onLoadDemo }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleLoadDemo = async () => {
    if (!onLoadDemo || loadingDemo) return;
    setLoadingDemo(true);
    await onLoadDemo();
    setLoadingDemo(false);
  };

  return (
    <div style={{ 
      display: 'flex', minHeight: '100vh', 
      background: darkMode ? 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' : 'linear-gradient(135deg, #e0e7ff 0%, #f8fafc 100%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <div style={{ 
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px'
      }}>
        <div style={{
          width: '100%', maxWidth: '440px', 
          background: darkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.6)',
          borderRadius: '24px', padding: '48px',
          boxShadow: darkMode ? '0 25px 50px -12px rgba(0,0,0,0.5)' : '0 25px 50px -12px rgba(14,165,233,0.15)'
        }}>
          <button 
            onClick={toggleTheme} 
            title="Toggle Theme"
            style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--brand)', letterSpacing: '-1px', marginBottom: '8px' }}>
              iServeU<span style={{ fontSize: '16px', verticalAlign: 'super' }}>®</span>
            </div>
            <p style={{ fontSize: '15px', color: 'var(--text-muted)', fontWeight: '500' }}>Chargeback & Dispute Resolution</p>
          </div>
          
          <form onSubmit={(e) => handleLogin(e, username, password)} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Username or Email</label>
              <input 
                type="text" 
                placeholder="Enter username" 
                value={username} onChange={e => setUsername(e.target.value)} required 
                style={{ 
                  width: '100%', padding: '16px', fontSize: '15px', 
                  background: darkMode ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                  border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1',
                  borderRadius: '12px', color: 'var(--text)', outline: 'none', transition: 'all 0.2s ease',
                  boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.2)'; }}
                onBlur={(e) => { e.target.style.borderColor = darkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1'; e.target.style.boxShadow = 'inset 0 2px 4px 0 rgba(0,0,0,0.02)'; }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
              <input 
                type="password" 
                placeholder="Enter password" 
                value={password} onChange={e => setPassword(e.target.value)} required 
                style={{ 
                  width: '100%', padding: '16px', fontSize: '15px', 
                  background: darkMode ? 'rgba(15, 23, 42, 0.5)' : '#fff',
                  border: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #cbd5e1',
                  borderRadius: '12px', color: 'var(--text)', outline: 'none', transition: 'all 0.2s ease',
                  boxShadow: 'inset 0 2px 4px 0 rgba(0,0,0,0.02)'
                }}
                onFocus={(e) => { e.target.style.borderColor = 'var(--brand)'; e.target.style.boxShadow = '0 0 0 3px rgba(14,165,233,0.2)'; }}
                onBlur={(e) => { e.target.style.borderColor = darkMode ? 'rgba(255,255,255,0.1)' : '#cbd5e1'; e.target.style.boxShadow = 'inset 0 2px 4px 0 rgba(0,0,0,0.02)'; }}
              />
            </div>
            <button 
              type="submit" 
              style={{ 
                width: '100%', marginTop: '8px', padding: '16px', fontSize: '16px', fontWeight: '600', 
                background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#fff', 
                border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: '0 4px 14px 0 rgba(14, 165, 233, 0.39)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(14, 165, 233, 0.5)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(14, 165, 233, 0.39)'; }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
            >
              Secure Login
            </button>
          </form>
          <button
            type="button"
            onClick={handleLoadDemo}
            disabled={loadingDemo}
            style={{
              width: '100%', marginTop: '12px', padding: '12px', fontSize: '14px', fontWeight: '600',
              background: 'transparent', color: 'var(--brand)',
              border: `1.5px solid ${darkMode ? 'rgba(59,130,246,0.4)' : 'var(--brand-border)'}`,
              borderRadius: '12px', cursor: loadingDemo ? 'wait' : 'pointer'
            }}
          >
            {loadingDemo ? 'Loading demo data…' : '↻ Load / Reset All Demo Data'}
          </button>
          
          <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: darkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0', fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: '1.8' }}>
            <strong style={{ color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: '11px' }}>Demo Access Details</strong><br />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '16px', textAlign: 'left', background: darkMode ? 'rgba(0,0,0,0.2)' : '#f1f5f9', padding: '16px', borderRadius: '12px' }}>
              <div style={{ fontWeight: '600' }}>Merchant</div><div>masteruser <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>/ Test@2026</span></div>
              <div style={{ fontWeight: '600' }}>Admin</div><div>Test@Ad <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>/ Test@2027</span></div>
              <div style={{ fontWeight: '600' }}>Partner</div><div>partneruser <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>/ Test@2028</span></div>
            </div>
          </div>
        </div>
        
        <div style={{ marginTop: '40px', color: darkMode ? 'rgba(255,255,255,0.4)' : '#64748b', fontSize: '12px', textAlign: 'center', lineHeight: '1.6' }}>
          &copy; 2026 iServeU Technology Pvt Ltd. All rights reserved.<br/>
          Protected by AES-256 encryption.
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════
// MERCHANT DASHBOARD PORTAL
// ═════════════════════════════════════════════
function MerchantPortal({
  currentUser, chargebacks, setView, toggleTheme, darkMode, formatINR, formatDateDisp, showToast, refreshAllData, resetAllSessions, handleLogout
}) {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'reports' | 'raised' | 'respond' | 'detail'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [disputeMenuOpen, setDisputeMenuOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  
  // Detail disputes states (Removed)

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // null | 'action1' | 'action2' | 'contest' | 'successAccept' | 'successEvidence'
  const [targetDisputeId, setTargetDisputeId] = useState(null);
  
  // Accepting remarks
  const [acceptRemarks, setAcceptRemarks] = useState('');
  const [acceptResponseSelect, setAcceptResponseSelect] = useState('');
  const [contestRemarks, setContestRemarks] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState({
    1: null,
    2: null,
    3: null
  });

  // Filters State
  const TODAY_STR = new Date().toISOString().split('T')[0];
  const DEFAULT_FROM = (() => {
    let d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })();

  const [dashDateRangeType, setDashDateRangeType] = useState('7days');
  const [dashFilterFrom, setDashFilterFrom] = useState(() => { let d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [dashFilterTo, setDashFilterTo] = useState(TODAY_STR);
  const [respondFilter, setRespondFilter] = useState({ from: DEFAULT_FROM, to: TODAY_STR, rrn: '', txnId: '', status: '', subStatus: '', disputeType: '', scheme: '' });
  const [raisedFilter, setRaisedFilter] = useState({ from: DEFAULT_FROM, to: TODAY_STR, rrn: '', txnId: '', status: '', subStatus: '', disputeType: '', scheme: '' });
  const [reportFilter, setReportFilter] = useState({ from: DEFAULT_FROM, to: TODAY_STR, provider: '', disputeType: '', scheme: '', disputeStatus: '', searchBy: '', searchText: '' });
  const [reportTab, setReportTab] = useState('dispute-mgmt'); // 'dispute-mgmt' | 'doc-pending' | 'doc-verification'

  // Pagination states
  const [respondPage, setRespondPage] = useState(1);
  const [respondLimit, setRespondLimit] = useState(10);
  const [raisedPage, setRaisedPage] = useState(1);
  const [raisedLimit, setRaisedLimit] = useState(10);

  // Search filter inputs inside table toolbar
  const [respondSearchInput, setRespondSearchInput] = useState('');
  const [raisedSearchInput, setRaisedSearchInput] = useState('');

  // Compute Merchant Disputes
  // Compute Merchant Disputes
  const merchantDisputes = chargebacks.filter(cb => cb.userName === currentUser.username);
  
  const actionRequiredDisputes = merchantDisputes.filter(cb => 
    !cb.merchantAction || 
    cb.merchantAction === 'rejected' || 
    cb.merchantAction === 'additional_evidence'
  );
  
  const pendingVerificationDisputes = merchantDisputes.filter(cb => 
    (cb.merchantAction === 'evidence' || cb.merchantAction === 'accepted_admin' || cb.merchantAction === 'rejected_admin') && 
    (cb.acquirerAction === null || cb.acquirerAction === 'evidence_uploaded')
  );

  // Dashboard calculations
  const getFilteredDashboardDisputes = () => {
    return merchantDisputes.filter(cb => {
      if (dashFilterFrom && cb.createdDate && cb.createdDate < dashFilterFrom) return false;
      if (dashFilterTo && cb.createdDate && cb.createdDate > dashFilterTo) return false;
      return true;
    });
  };

  const getDashboardStats = () => {
    const list = getFilteredDashboardDisputes();
    const totalAmt = list.reduce((sum, c) => sum + c.txnAmt, 0);
    const totalCount = list.length;
    
    const openList = list.filter(cb => cb.mSubStatus.includes('New') || cb.mSubStatus.includes('Progress') || cb.mSubStatus.includes('Resubmit') || cb.mSubStatus.includes('Hold'));
    const openAmt = openList.reduce((sum, c) => sum + c.txnAmt, 0);
    
    const lostList = list.filter(cb => cb.mSubStatus.includes('Lost'));
    const lostAmt = lostList.reduce((sum, c) => sum + c.txnAmt, 0);
    
    const wonList = list.filter(cb => cb.mSubStatus.includes('Won') || cb.mSubStatus.includes('Success'));
    const wonAmt = wonList.reduce((sum, c) => sum + c.txnAmt, 0);

    const wonPct = totalCount > 0 ? Math.round((wonList.length / totalCount) * 100) : 0;
    const lostPct = totalCount > 0 ? Math.round((lostList.length / totalCount) * 100) : 0;
    const openPct = totalCount > 0 ? Math.round((openList.length / totalCount) * 100) : 0;

    return {
      totalAmt, totalCount,
      openAmt, openCount: openList.length, openPct,
      lostAmt, lostCount: lostList.length, lostPct,
      wonAmt, wonCount: wonList.length, wonPct
    };
  };

  const stats = getDashboardStats();

  // Filters respond table
  const getFilteredRespond = () => {
    let list = merchantDisputes.filter(cb => {
      if (respondFilter.from && cb.respondByDate && cb.respondByDate < respondFilter.from) return false;
      if (respondFilter.to && cb.respondByDate && cb.respondByDate > respondFilter.to) return false;
      if (respondFilter.rrn && !cb.rrn.includes(respondFilter.rrn)) return false;
      if (respondFilter.txnId && !cb.txnId.includes(respondFilter.txnId)) return false;
      if (respondFilter.status && cb.mStatus !== respondFilter.status) return false;
      if (respondFilter.subStatus && cb.mSubStatus !== respondFilter.subStatus) return false;
      return true;
    });

    if (respondSearchInput) {
      const q = respondSearchInput.toLowerCase();
      list = list.filter(cb => cb.rrn.includes(q) || cb.txnId.includes(q) || cb.mStatus.toLowerCase().includes(q));
    }
    return list;
  };

  const filteredRespond = getFilteredRespond();

  // Filters raised table
  const getFilteredRaised = () => {
    let list = merchantDisputes.filter(cb => {
      if (raisedFilter.from && cb.createdDate && cb.createdDate < raisedFilter.from) return false;
      if (raisedFilter.to && cb.createdDate && cb.createdDate > raisedFilter.to) return false;
      if (raisedFilter.rrn && !cb.rrn.includes(raisedFilter.rrn)) return false;
      if (raisedFilter.txnId && !cb.txnId.includes(raisedFilter.txnId)) return false;
      if (raisedFilter.status && cb.mStatus !== raisedFilter.status) return false;
      if (raisedFilter.subStatus && cb.mSubStatus !== raisedFilter.subStatus) return false;
      return true;
    });

    if (raisedSearchInput) {
      const q = raisedSearchInput.toLowerCase();
      list = list.filter(cb => cb.rrn.includes(q) || cb.txnId.includes(q) || cb.mStatus.toLowerCase().includes(q));
    }
    return list;
  };

  const filteredRaised = getFilteredRaised();

  // Paging handlers
  const paginateList = (list, page, limit) => {
    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    let curr = page;
    if (curr > totalPages) curr = totalPages;
    if (curr < 1) curr = 1;
    const start = (curr - 1) * limit;
    const end = Math.min(start + limit, total);
    const paginated = list.slice(start, end);
    return { paginated, startRecord: total === 0 ? 0 : start + 1, endRecord: end, total, totalPages, curr };
  };

  const respondPaging = paginateList(filteredRespond, respondPage, respondLimit);
  const raisedPaging = paginateList(filteredRaised, raisedPage, raisedLimit);

  // Status Badge Builder
  const renderStatusBadge = (s) => {
    const m = {
      'Chargeback Raise': 'badge-cb',
      'Pre-Arbitration Raise': 'badge-prearb',
      'Pre-Arbitration Raised': 'badge-prearb',
      'Arbitration Raise': 'badge-arb',
      'Arbitration Raised': 'badge-arb',
      'Fraud Chargeback Raise': 'badge-fraud',
      'Differed Chargeback Raise': 'badge-deferred',
      'VROL Inquiry': 'badge-pending',
      'VROL Chargeback': 'badge-cb',
      'VROL Pre-Arbitration': 'badge-prearb',
      'VROL Arbitration': 'badge-arb'
    };
    return <span className={`badge ${m[s] || 'badge-new'}`}>{s}</span>;
  };

  const renderSubBadge = (s) => {
    const m = {
      'Chargeback New': 'badge-new',
      'Chargeback Lost': 'badge-lost',
      'Chargeback in Progress': 'badge-progress',
      'Chargeback Resubmit': 'badge-resubmit',
      'Chargeback Won': 'badge-won',
      'Refund Success': 'badge-won',
      'Refund On Hold': 'badge-progress'
    };
    return <span className={`badge ${m[s] || 'badge-pending'}`}>{s}</span>;
  };

  const getActionBtn = (cb) => {
    if (cb.visaPending || cb.mSubStatus === 'Submitted to Visa') return <span className="badge badge-won" style={{background: '#e3f2fd', color: '#1976d2'}}>Submitted to Visa</span>;
    if (cb.resolution === 'Lost' || cb.mSubStatus === 'Chargeback Lost') return <span className="badge badge-resubmit">Accepted (Lost)</span>;
    if (cb.mSubStatus === 'Document Pending Verification') return <span className="badge badge-progress">Pending Admin Verification</span>;
    if (cb.mSubStatus === 'Document Pending from Merchant' || cb.mSubStatus === 'Pending') {
      return (
        <button className="ta-btn" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>
          Take Action
        </button>
      );
    }
    return <span className="badge" style={{background: '#f5f5f5', color: '#757575'}}>{cb.mSubStatus}</span>;
  };

  // Post remarks reply
  const sendReply = async () => {
    // This function is kept stubbed in case it's used elsewhere, but ideally it should be removed if completely unused.
    // Actually wait, let's just leave it for now in case another part of the UI depends on it to prevent errors.
    console.log('sendReply stub');
  };


  // Confirm Accept Dispute Action
  const confirmAccept = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentUser) {
        headers['x-user-role'] = currentUser.role;
        headers['x-user-name'] = currentUser.username;
      }

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}/action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'accept',
          comments: acceptRemarks || 'Accepted'
        })
      });

      if (response.ok) {
        setAcceptRemarks('');
        setActiveModal('successAccept');
        await refreshAllData();
      } else {
        showToast('Acceptance failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  // Submit Evidence Contest Action — also marks visaPending for Visa review
  const submitContestEvidence = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentUser) {
        headers['x-user-role'] = currentUser.role;
        headers['x-user-name'] = currentUser.username;
      }

      const uploadedDocs = [];
      if (evidenceFiles[1]) uploadedDocs.push(evidenceFiles[1].name || evidenceFiles[1]);
      if (evidenceFiles[2]) uploadedDocs.push(evidenceFiles[2].name || evidenceFiles[2]);
      if (evidenceFiles[3]) uploadedDocs.push(evidenceFiles[3].name || evidenceFiles[3]);
      if (uploadedDocs.length === 0) uploadedDocs.push('EvidenceSubmitted.pdf');

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}/action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'contest',
          comments: (contestRemarks || 'Contested') + ' — Evidence forwarded to Acquirer on behalf of Partner for Visa consideration.',
          evidence: uploadedDocs
        })
      });

      if (response.ok) {
        setContestRemarks('');
        setEvidenceFiles({ 1: null, 2: null, 3: null });
        setActiveModal('successEvidence');
        await refreshAllData();
      } else {
        showToast('Evidence submit failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  const handleEscalate = async (id) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (currentUser) {
        headers['x-user-role'] = currentUser.role;
        headers['x-user-name'] = currentUser.username;
      }
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'escalate' })
      });
      if (response.ok) {
        showToast('Escalated to Pre-Arb successfully');
        await refreshAllData();
      } else {
        showToast('Escalation failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  const handleEvidenceFileChange = (slot, file) => {
    if (file) {
      setEvidenceFiles(prev => ({ ...prev, [slot]: file.name }));
    }
  };

  const removeEvidenceFile = (slot) => {
    setEvidenceFiles(prev => ({ ...prev, [slot]: null }));
  };

  const handleResponseSelect = (val) => {
    setAcceptResponseSelect(val);
    if (val === 'contest') {
      setActiveModal('contest');
    }
  };

  // Exports data to CSV
  const exportToCSV = (src) => {
    const list = src === 'respond' ? filteredRespond : filteredRaised;
    if (!list.length) {
      showToast('No data to export', 'error');
      return;
    }
    const headers = ['RRN', 'Case ID', 'Txn ID', 'Merchant', 'Status', 'Sub Status', 'Amount', 'Date', 'Product'];
    const rows = list.map(cb => [
      cb.rrn, cb.caseId, cb.txnId, cb.userName, cb.mStatus, cb.mSubStatus, cb.txnAmt, cb.createdDate, cb.product
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `chargebacks_${src}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Export successful!');
  };

  // Draw Reports charts
  const getReportChartData = () => {
    const filtered = merchantDisputes.filter(cb => {
      if (reportFilter.searchText) {
        const q = reportFilter.searchText.toLowerCase();
        if (reportFilter.searchBy === 'Txn ID' && !cb.txnId?.toLowerCase().includes(q)) return false;
        if (reportFilter.searchBy === 'RRN' && !cb.rrn?.toLowerCase().includes(q)) return false;
        if (reportFilter.searchBy === 'TID' && !cb.tid?.toLowerCase().includes(q)) return false;
        if (reportFilter.searchBy === 'MID' && !cb.userId?.toLowerCase().includes(q)) return false;
        if (reportFilter.searchBy === 'Case ID' && !cb.caseId?.toLowerCase().includes(q) && !cb.id?.toLowerCase().includes(q)) return false;
        if (!reportFilter.searchBy && !cb.rrn?.toLowerCase().includes(q) && !cb.txnId?.toLowerCase().includes(q) && !cb.userId?.toLowerCase().includes(q) && !cb.id?.toLowerCase().includes(q)) return false;
      }
      if (reportFilter.disputeStatus && cb.mStatus !== reportFilter.disputeStatus) return false;
      if (reportFilter.disputeType && cb.mSubStatus !== reportFilter.disputeType) return false;
      if (reportFilter.from && cb.createdDate && cb.createdDate < reportFilter.from) return false;
      if (reportFilter.to && cb.createdDate && cb.createdDate > reportFilter.to) return false;
      return true;
    });

    const upiCount = filtered.filter(cb => cb.product === 'VISA').length;
    const visaCount = filtered.filter(cb => cb.product === 'VISA').length;
    const mcCount = filtered.filter(cb => cb.product === 'Mastercard').length;
    const rupayCount = filtered.filter(cb => cb.product === 'Rupay').length;

    const wonCount = filtered.filter(cb => cb.mSubStatus.includes('Won') || cb.mSubStatus.includes('Success')).length;
    const lostCount = filtered.filter(cb => cb.mSubStatus.includes('Lost')).length;
    const openCount = filtered.filter(cb => cb.mSubStatus.includes('New') || cb.mSubStatus.includes('Progress') || cb.mSubStatus.includes('Resubmit') || cb.mSubStatus.includes('Hold')).length;

    const totalAmt = filtered.reduce((sum, c) => sum + c.txnAmt, 0);
    const openAmt = filtered.filter(cb => cb.mSubStatus.includes('New') || cb.mSubStatus.includes('Progress') || cb.mSubStatus.includes('Resubmit') || cb.mSubStatus.includes('Hold')).reduce((sum, c) => sum + c.txnAmt, 0);
    const wonAmt = filtered.filter(cb => cb.mSubStatus.includes('Won') || cb.mSubStatus.includes('Success')).reduce((sum, c) => sum + c.txnAmt, 0);
    const lostAmt = filtered.filter(cb => cb.mSubStatus.includes('Lost')).reduce((sum, c) => sum + c.txnAmt, 0);

    return {
      filtered,
      totalCount: filtered.length, totalAmt,
      openCount, openAmt,
      wonCount, wonAmt,
      lostCount, lostAmt,
      providers: [
        { label: 'VISA', value: upiCount, color: '#1d4ed8' },
        { label: 'VISA', value: visaCount, color: '#ca8a04' },
        { label: 'Mastercard', value: mcCount, color: '#dc2626' },
        { label: 'Rupay', value: rupayCount, color: '#7c3aed' }
      ],
      outcomes: [
        { label: 'Won', value: wonCount, color: '#16a34a' },
        { label: 'Lost', value: lostCount, color: '#dc2626' },
        { label: 'Open', value: openCount, color: '#1d4ed8' }
      ]
    };
  };

  const reportData = getReportChartData();

  return (
    <div className="app" id="merchantApp">
      <header className="app-header">
        <button className="hdr-hamburger" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>☰</button>
        <div className="hdr-logo"><div className="hl-text">iServeU<sup>®</sup></div></div>
        <div className="hdr-space"></div>

        <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="hdr-bell">🔔<span className="notif-dot"></span></button>
        <div 
          className="hdr-user" 
          title={currentUser.name}
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          <div className="avatar">🌐</div>
          <div>
            <div className="hdr-uname">{currentUser.name}</div>
            <div className="hdr-urole">Merchant</div>
          </div>
          {profileMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #ddd)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '160px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', color: 'var(--text-main, #333)', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--border-color, #eee)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background='var(--bg-body, #f9f9f9)'} onMouseLeave={(e) => e.target.style.background='transparent'} onClick={(e) => { e.stopPropagation(); showToast('Change password functionality not implemented'); setProfileMenuOpen(false); }}>Change Password</div>
              <div style={{ padding: '12px 16px', color: 'var(--red, #d32f2f)', fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background='var(--bg-body, #f9f9f9)'} onMouseLeave={(e) => e.target.style.background='transparent'} onClick={(e) => { e.stopPropagation(); handleLogout(); }}>Logout</div>
            </div>
          )}
        </div>
      </header>

      <div className="app-body">
        <nav className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} id="mSidebar">
          <div className="sb-welcome">Welcome, masteruser</div>
          <div className="sb-section">
            <div 
              className={`sb-item ${activePage === 'dashboard' ? 'active' : ''}`} 
              onClick={() => setActivePage('dashboard')}
            >
              <span className="si">⊞</span> Dashboard
            </div>
            <div 
              className={`sb-item ${activePage === 'reports' ? 'active' : ''}`} 
              onClick={() => setActivePage('reports')}
            >
              <span className="si">📋</span> Dispute Management
            </div>



          </div>
        </nav>

        <main className="main">
          {/* Dashboard Page */}
          {activePage === 'dashboard' && (
            <div className="page active" id="m-dashboard">
              <div className="page-inner">
                <div className="welcome-bar">
                  <div>
                    <div className="wb-title">Welcome, Merchant Dispute Dashboard 👋</div>
                    <div className="wb-sub">Manage and represent customer payment disputes</div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select
                      style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }}
                      value={dashDateRangeType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDashDateRangeType(val);
                        const today = new Date();
                        const todayStr = today.toISOString().split('T')[0];
                        if (val === 'today') {
                          setDashFilterFrom(todayStr);
                          setDashFilterTo(todayStr);
                        } else if (val === 'yesterday') {
                          const y = new Date(today);
                          y.setDate(y.getDate() - 1);
                          setDashFilterFrom(y.toISOString().split('T')[0]);
                          setDashFilterTo(y.toISOString().split('T')[0]);
                        } else if (val === '7days') {
                          const d7 = new Date(today);
                          d7.setDate(d7.getDate() - 7);
                          setDashFilterFrom(d7.toISOString().split('T')[0]);
                          setDashFilterTo(todayStr);
                        } else if (val === 'lastmonth') {
                          const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                          const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                          setDashFilterFrom(lmStart.toISOString().split('T')[0]);
                          setDashFilterTo(lmEnd.toISOString().split('T')[0]);
                        }
                      }}
                    >
                      <option value="today">Today</option>
                      <option value="custom">Custom Date Range</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="lastmonth">Last Month</option>
                    </select>
                    {dashDateRangeType === 'custom' && (
                      <>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '8px', color: '#50BDC9', fontSize: '14px' }}>📅</span>
                          <input type="date" style={{ padding: '8px 12px 8px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }} value={dashFilterFrom} onChange={(e) => setDashFilterFrom(e.target.value)} />
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>to</span>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '8px', color: '#50BDC9', fontSize: '14px' }}>📅</span>
                          <input type="date" style={{ padding: '8px 12px 8px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }} value={dashFilterTo} onChange={(e) => setDashFilterTo(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="stats-grid">
                  {/* Total Disputes Card */}
                  <div className="stat-card received">
                    <div className="stat-icon">📥</div>
                    <div className="stat-content">
                      <div className="stat-val">{formatINR(stats.totalAmt)}</div>
                      <div className="stat-lbl">Disputes Received</div>
                      <div className="stat-meta-row">
                        <span className="stat-cnt">{stats.totalCount} cases</span>
                      </div>
                    </div>
                  </div>

                  {/* Open Disputes Card */}
                  <div className="stat-card open">
                    <div className="stat-icon">🔄</div>
                    <div className="stat-content">
                      <div className="stat-val">{formatINR(stats.openAmt)}</div>
                      <div className="stat-lbl">Open Disputes</div>
                      <div className="stat-meta-row">
                        <span className="stat-cnt">{stats.openCount} cases</span>
                        <span className="stat-pct-badge open-pct">{stats.openPct}%</span>
                      </div>
                      <div className="stat-progress-bar">
                        <div className="stat-progress-fill open-fill" style={{ width: `${stats.openPct}%` }}></div>
                      </div>
                    </div>
                  </div>

                  {/* Disputes Lost Card */}
                  <div className="stat-card lost">
                    <div className="stat-icon">❌</div>
                    <div className="stat-content">
                      <div className="stat-val">{formatINR(stats.lostAmt)}</div>
                      <div className="stat-lbl">Disputes Lost</div>
                      <div className="stat-meta-row">
                        <span className="stat-cnt">{stats.lostCount} cases</span>
                        <span className="stat-pct-badge lost-pct">{stats.lostPct}%</span>
                      </div>
                      <div className="stat-progress-bar">
                        <div className="stat-progress-fill lost-fill" style={{ width: `${stats.lostPct}%` }}></div>
                      </div>
                      <div className="stat-outcome-label lost-label">📉 Loss Rate</div>
                    </div>
                  </div>

                  {/* Disputes Won Card */}
                  <div className="stat-card won">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <div className="stat-val">{formatINR(stats.wonAmt)}</div>
                      <div className="stat-lbl">Disputes Won</div>
                      <div className="stat-meta-row">
                        <span className="stat-cnt">{stats.wonCount} cases</span>
                        <span className="stat-pct-badge won-pct">{stats.wonPct}%</span>
                      </div>
                      <div className="stat-progress-bar">
                        <div className="stat-progress-fill won-fill" style={{ width: `${stats.wonPct}%` }}></div>
                      </div>
                      <div className="stat-outcome-label won-label">📈 Win Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Respond By Date Page */}
          {activePage === 'respond' && (
            <div className="page active" id="m-respond">
              <div className="progress-tabs">
                <div className="pt-seg" style={{ background: '#FFD700', width: '25%' }}></div>
                <div className="pt-seg" style={{ background: '#22c55e', width: '35%' }}></div>
                <div className="pt-seg" style={{ background: '#22c55e', width: '10%' }}></div>
                <div className="pt-seg" style={{ background: '#e5e7eb', flex: '1' }}></div>
              </div>
              <div className="page-inner">
                <div className="page-hdr">
                  <div>
                    <h1>Disputes by Respond By Date</h1>
                    <p>Represent your dispute cases before the response deadlines</p>
                  </div>
                </div>
                <div className="filter-card">
                  <div className="filter-row">
                    <div className="filter-group">
                      <label>From Date <span className="req">*</span></label>
                      <input 
                        type="date" 
                        className="fi-date" 
                        value={respondFilter.from} 
                        onChange={(e) => setRespondFilter(prev => ({ ...prev, from: e.target.value }))} 
                      />
                    </div>
                    <div className="filter-group">
                      <label>To Date <span className="req">*</span></label>
                      <input 
                        type="date" 
                        className="fi-date" 
                        value={respondFilter.to} 
                        onChange={(e) => setRespondFilter(prev => ({ ...prev, to: e.target.value }))} 
                      />
                    </div>
                    <div className="filter-group">
                      <label>RRN Number</label>
                      <input 
                        type="text" 
                        className="fi-text" 
                        placeholder="RRN Number" 
                        value={respondFilter.rrn}
                        onChange={(e) => setRespondFilter(prev => ({ ...prev, rrn: e.target.value }))}
                      />
                    </div>
                    <div className="filter-group">
                      <label>Transaction ID</label>
                      <input 
                        type="text" 
                        className="fi-text" 
                        placeholder="Transaction ID" 
                        value={respondFilter.txnId}
                        onChange={(e) => setRespondFilter(prev => ({ ...prev, txnId: e.target.value }))}
                      />
                    </div>
                    <div className="filter-group">
                      <label>Status</label>
                      <select 
                        className="fi-sel" 
                        value={respondFilter.status}
                        onChange={(e) => setRespondFilter(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="">Status</option>
                        <option>Chargeback Raise</option>
                        <option>Differed Chargeback Raise</option>
                        <option>Fraud Chargeback Raise</option>
                        <option>Pre-Arbitration Raise</option>
                        <option>Arbitration Raise</option>
                        <option>VROL Inquiry</option>
                        <option>VROL Chargeback</option>
                        <option>VROL Pre-Arbitration</option>
                        <option>VROL Arbitration</option>
                      </select>
                    </div>
                    <div className="filter-group">
                      <label>Sub Status</label>
                      <select 
                        className="fi-sel" 
                        value={respondFilter.subStatus}
                        onChange={(e) => setRespondFilter(prev => ({ ...prev, subStatus: e.target.value }))}
                      >
                        <option value="">Sub Status</option>
                        <option>Chargeback New</option>
                        <option>Chargeback Lost</option>
                        <option>Chargeback in Progress</option>
                        <option>Chargeback Resubmit</option>
                        <option>Chargeback Won</option>
                      </select>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setRespondFilter({ from: DEFAULT_FROM, to: TODAY_STR, rrn: '', txnId: '', status: '', subStatus: '' })}>Reset</button>
                  </div>
                </div>

                {filteredRespond.length > 0 ? (
                  <div>
                    <div className="respond-bar">
                      <span>Response Action Needed</span>
                      <span style={{ marginLeft: 'auto', color: '#92400e', fontSize: '12px' }}>
                        ⚠ Respond before target dates to protect dispute representations
                      </span>
                    </div>
                    <div className="tbl-card" style={{ borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
                      <div className="tbl-toolbar">
                        <div className="search-wrap">
                          <span className="si">🔍</span>
                          <input 
                            type="text" 
                            className="tbl-search" 
                            placeholder="Fuzzy Search RRN/Txn" 
                            value={respondSearchInput}
                            onChange={(e) => { setRespondPage(1); setRespondSearchInput(e.target.value); }}
                          />
                        </div>
                        <div className="tbl-space"></div>
                        <button className="btn btn-primary btn-sm" onClick={() => exportToCSV('respond')}>
                          ⬇ Export CSV
                        </button>
                      </div>
                      <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>User Name</th>
                              <th>RRN</th>
                              <th>Txn ID</th>
                              <th>Status</th>
                              <th>Sub Status</th>
                              <th>Adj Amount</th>
                              <th>Respond By</th>
                              <th>Type</th>
                              <th>Details</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {respondPaging.paginated.map(cb => (
                              <tr key={cb.id}>
                                <td>{cb.userName}</td>
                                <td className="mono">{cb.rrn}</td>
                                <td className="mono">{cb.txnId}</td>
                                <td>{renderStatusBadge(cb.mStatus)}</td>
                                <td>{renderSubBadge(cb.mSubStatus)}</td>
                                <td><strong>{formatINR(cb.adjAmt)}</strong></td>
                                <td>{formatDateDisp(cb.respondByDate)}</td>
                                <td>{cb.adjType}</td>
                                <td>
                                  <button className="info-btn" onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>ℹ</button>
                                </td>
                                <td>{getActionBtn(cb)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="tbl-footer">
                        <div className="rpp">
                          Rows per page: 
                          <select value={respondLimit} onChange={(e) => { setRespondPage(1); setRespondLimit(parseInt(e.target.value)); }}>
                            <option value="5">5</option>
                            <option value="10">10</option>
                            <option value="25">25</option>
                          </select>
                        </div>
                        <div className="pagination">
                          <span style={{ marginRight: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                            {respondPaging.startRecord}–{respondPaging.endRecord} of {respondPaging.total} records
                          </span>
                          <button 
                            className="pg-btn" 
                            disabled={respondPage === 1}
                            onClick={() => setRespondPage(respondPage - 1)}
                          >
                            ‹
                          </button>
                          {Array.from({ length: respondPaging.totalPages }, (_, idx) => idx + 1).map(p => (
                            <button 
                              key={p} 
                              className={`pg-btn ${respondPage === p ? 'active' : ''}`}
                              onClick={() => setRespondPage(p)}
                            >
                              {p}
                            </button>
                          ))}
                          <button 
                            className="pg-btn" 
                            disabled={respondPage === respondPaging.totalPages}
                            onClick={() => setRespondPage(respondPage + 1)}
                          >
                            ›
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-data">
                    <div className="nd-svg">📁</div>
                    <h3>No Data Found!</h3>
                    <p>Try adjusting your search criteria or date ranges.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Raised Date Page */}
          {activePage === 'raised' && (
            <div className="page active" id="m-raised">
              <div className="progress-tabs">
                <div className="pt-seg" style={{ background: '#FFD700', width: '25%' }}></div>
                <div className="pt-seg" style={{ background: '#22c55e', width: '35%' }}></div>
                <div className="pt-seg" style={{ background: '#22c55e', width: '10%' }}></div>
                <div className="pt-seg" style={{ background: '#e5e7eb', flex: '1' }}></div>
              </div>
              <div className="page-inner">
                <div className="page-hdr">
                  <div>
                    <h1>Disputes by Raised Date</h1>
                    <p>Audit historical disputes sorted by the date they were raised</p>
                  </div>
                </div>
                <div className="filter-card">
                  <div className="filter-row">
                    <div className="filter-group">
                      <label>From Date <span className="req">*</span></label>
                      <input 
                        type="date" 
                        className="fi-date" 
                        value={raisedFilter.from} 
                        onChange={(e) => setRaisedFilter(prev => ({ ...prev, from: e.target.value }))} 
                      />
                    </div>
                    <div className="filter-group">
                      <label>To Date <span className="req">*</span></label>
                      <input 
                        type="date" 
                        className="fi-date" 
                        value={raisedFilter.to} 
                        onChange={(e) => setRaisedFilter(prev => ({ ...prev, to: e.target.value }))} 
                      />
                    </div>
                    <div className="filter-group">
                      <label>RRN Number</label>
                      <input 
                        type="text" 
                        className="fi-text" 
                        placeholder="RRN Number" 
                        value={raisedFilter.rrn}
                        onChange={(e) => setRaisedFilter(prev => ({ ...prev, rrn: e.target.value }))}
                      />
                    </div>
                    <div className="filter-group">
                      <label>Transaction ID</label>
                      <input 
                        type="text" 
                        className="fi-text" 
                        placeholder="Transaction ID" 
                        value={raisedFilter.txnId}
                        onChange={(e) => setRaisedFilter(prev => ({ ...prev, txnId: e.target.value }))}
                      />
                    </div>
                    <div className="filter-group">
                      <label>Status</label>
                      <select 
                        className="fi-sel" 
                        value={raisedFilter.status}
                        onChange={(e) => setRaisedFilter(prev => ({ ...prev, status: e.target.value }))}
                      >
                        <option value="">Status</option>
                        <option>Chargeback Raise</option>
                        <option>Differed Chargeback Raise</option>
                        <option>Fraud Chargeback Raise</option>
                        <option>Pre-Arbitration Raise</option>
                        <option>Arbitration Raise</option>
                        <option>VROL Inquiry</option>
                        <option>VROL Chargeback</option>
                        <option>VROL Pre-Arbitration</option>
                        <option>VROL Arbitration</option>
                      </select>
                    </div>
                    <div className="filter-group">
                      <label>Sub Status</label>
                      <select 
                        className="fi-sel" 
                        value={raisedFilter.subStatus}
                        onChange={(e) => setRaisedFilter(prev => ({ ...prev, subStatus: e.target.value }))}
                      >
                        <option value="">Sub Status</option>
                        <option>Chargeback New</option>
                        <option>Chargeback Lost</option>
                        <option>Chargeback in Progress</option>
                        <option>Chargeback Resubmit</option>
                        <option>Chargeback Won</option>
                      </select>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setRaisedFilter({ from: DEFAULT_FROM, to: TODAY_STR, rrn: '', txnId: '', status: '', subStatus: '' })}>Reset</button>
                  </div>
                </div>

                {filteredRaised.length > 0 ? (
                  <div className="tbl-card">
                    <div className="tbl-toolbar">
                      <div className="search-wrap">
                        <span className="si">🔍</span>
                        <input 
                          type="text" 
                          className="tbl-search" 
                          placeholder="Fuzzy Search..." 
                          value={raisedSearchInput}
                          onChange={(e) => { setRaisedPage(1); setRaisedSearchInput(e.target.value); }}
                        />
                      </div>
                      <div className="tbl-space"></div>
                      <button className="btn btn-primary btn-sm" onClick={() => exportToCSV('raised')}>
                        ⬇ Export CSV
                      </button>
                    </div>
                    <div className="tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>User Name</th>
                            <th>RRN</th>
                            <th>Txn ID</th>
                            <th>Status</th>
                            <th>Sub Status</th>
                            <th>Adj Amount</th>
                            <th>Raised Date</th>
                            <th>Type</th>
                            <th>Details</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {raisedPaging.paginated.map(cb => (
                            <tr key={cb.id}>
                              <td>{cb.userName}</td>
                              <td className="mono">{cb.rrn}</td>
                              <td className="mono">{cb.txnId}</td>
                              <td>{renderStatusBadge(cb.mStatus)}</td>
                              <td>{renderSubBadge(cb.mSubStatus)}</td>
                              <td><strong>{formatINR(cb.adjAmt)}</strong></td>
                              <td>{formatDateDisp(cb.createdDate)}</td>
                              <td>{cb.adjType}</td>
                              <td>
                                <button className="info-btn" onClick={() => openDetail(cb.id, 'raised')}>ℹ</button>
                              </td>
                              <td>{getActionBtn(cb)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="tbl-footer">
                      <div className="rpp">
                        Rows per page: 
                        <select value={raisedLimit} onChange={(e) => { setRaisedPage(1); setRaisedLimit(parseInt(e.target.value)); }}>
                          <option value="5">5</option>
                          <option value="10">10</option>
                          <option value="25">25</option>
                        </select>
                      </div>
                      <div className="pagination">
                        <span style={{ marginRight: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {raisedPaging.startRecord}–{raisedPaging.endRecord} of {raisedPaging.total} records
                        </span>
                        <button 
                          className="pg-btn" 
                          disabled={raisedPage === 1}
                          onClick={() => setRaisedPage(raisedPage - 1)}
                        >
                          ‹
                        </button>
                        {Array.from({ length: raisedPaging.totalPages }, (_, idx) => idx + 1).map(p => (
                          <button 
                            key={p} 
                            className={`pg-btn ${raisedPage === p ? 'active' : ''}`}
                            onClick={() => setRaisedPage(p)}
                          >
                            {p}
                          </button>
                        ))}
                        <button 
                          className="pg-btn" 
                          disabled={raisedPage === raisedPaging.totalPages}
                          onClick={() => setRaisedPage(raisedPage + 1)}
                        >
                          ›
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-data">
                    <div className="nd-svg">📁</div>
                    <h3>No Data Found!</h3>
                    <p>Try adjusting your search criteria or date ranges.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dispute Detail Page */}
          {activePage === 'detail' && activeDetailDispute && (
            <div className="page active" id="m-dispute-detail">
              <div className="page-inner">
                <div style={{ marginBottom: '16px' }}>
                  <span 
                    style={{ fontSize: '14px', color: 'var(--brand)', cursor: 'pointer', fontWeight: '500' }} 
                    onClick={() => setActivePage(detailSourcePage)}
                  >
                    ← Back to List
                  </span>
                </div>
                <div className="dispute-hdr">
                  <h2>Dispute Case ID: {activeDetailDispute.caseId}</h2>
                  {getActionBtn(activeDetailDispute)}
                </div>
                <div className="dd-section">
                  <h3>Dispute Properties</h3>
                  <div className="dd-grid">
                    <div className="dd-item"><span className="dk">Order Case ID</span><span className="dv">{activeDetailDispute.caseId}</span></div>
                    <div className="dd-item"><span className="dk">Transaction Reference ID</span><span className="dv">{activeDetailDispute.txnId}</span></div>
                    <div className="dd-item"><span className="dk">Transaction Value</span><span className="dv">{formatINR(activeDetailDispute.txnAmt)}</span></div>
                    <div className="dd-item"><span className="dk">Disputed Ledger Amount</span><span className="dv">{formatINR(activeDetailDispute.adjAmt)}</span></div>
                    <div className="dd-item"><span className="dk">Payment Product</span><span className="dv">{activeDetailDispute.product || 'VISA'}</span></div>
                    <div className="dd-item"><span className="dk">Chargeback RRN</span><span className="dv">{activeDetailDispute.rrn}</span></div>
                    <div className="dd-item"><span className="dk">Dispute Type</span><span className="dv">{activeDetailDispute.adjType}</span></div>
                    <div className="dd-item"><span className="dk">Representation Deadline</span><span className="dv">{formatDateDisp(activeDetailDispute.respondByDate)}</span></div>
                    {activeDetailDispute.product === 'VISA' && (
                      <>
                        <div className="dd-item"><span className="dk">VROL Case ID</span><span className="dv">{activeDetailDispute.caseId}</span></div>
                        <div className="dd-item"><span className="dk">Visa Reason Code</span><span className="dv">{activeDetailDispute.reasonCode || '10.4'}</span></div>
                      </>
                    )}
                  </div>
                </div>

                <div className="dd-section">
                  <div className="timeline-hdr">
                    <h3 style={{ margin: 0 }}>Audit Timeline Log</h3>
                  </div>
                  
                  {activeDetailDispute.timeline && activeDetailDispute.timeline.length > 0 ? (
                    <div id="ddTimeline">
                      {activeDetailDispute.timeline.map((entry, idx) => (
                        <div className="tl-entry" key={idx}>
                          <div><div className="tl-icon">✓</div></div>
                          <div style={{ flex: 1 }}>
                            <div className="tl-title">{entry.title}</div>
                            <div className="tl-time">{entry.time}</div>
                            {entry.remarks && <div className="tl-meta"><span>Remarks:</span> <strong>{entry.remarks}</strong></div>}
                            {entry.file && <div className="tl-file">📄 {entry.file}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', padding: '16px 0' }}>No audits logged.</p>
                  )}

                  <div style={{ marginTop: '16px' }}>
                    <div className="reply-box">
                      <input 
                        type="text" 
                        placeholder="Add timelines remark / message..." 
                        value={timelineRemark}
                        onChange={(e) => setTimelineRemark(e.target.value)}
                        onKeyPress={(e) => { if (e.key === 'Enter') sendReply(); }}
                      />
                      <button className="rb-attach" onClick={() => showToast('Documents should be uploaded inside the contest action window', 'warning')}>📎</button>
                      <button className="rb-send" onClick={sendReply}>➤</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reports and Analytics Page */}
          {activePage === 'reports' && (
            <div className="page active" id="m-reports">
              <div className="page-inner">
                <div className="page-hdr">
                  <div>
                    <h1>📋 Dispute Management</h1>
                    <p>Monitor, respond to, and resolve your dispute cases</p>
                  </div>
                </div>

                {/* Search Panel — matches reference image */}
                <div className="search-panel">
                  <div className="search-panel-title">🔍 Search — Dispute Management</div>
                  <div className="search-panel-grid">
                    <div className="sp-field">
                      <label>📅 From Date</label>
                      <input type="date" className="sp-input" value={reportFilter.from}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, from: e.target.value }))} />
                    </div>
                    <div className="sp-field">
                      <label>📅 To Date</label>
                      <input type="date" className="sp-input" value={reportFilter.to}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, to: e.target.value }))} />
                    </div>
                    <div className="sp-field">
                      <label>Dispute Type</label>
                      <select className="sp-input" value={reportFilter.disputeType}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, disputeType: e.target.value }))}>
                        <option value="">Dispute Type</option>
                        <option value="Chargeback">Chargeback</option>
                        <option value="Pre-Arbitration">Pre-Arbitration</option>
                        <option value="Retrieval Request">Retrieval Request</option>
                        <option value="Arbitration">Arbitration</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Aggregator</label>
                      <select className="sp-input" value={reportFilter.provider}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, provider: e.target.value }))}>
                        <option value="ISU">ISU</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Scheme</label>
                      <select className="sp-input" value={reportFilter.scheme}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, scheme: e.target.value }))}>
                        <option value="Visa">Visa</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Dispute Status</label>
                      <select className="sp-input" value={reportFilter.disputeStatus}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, disputeStatus: e.target.value }))}>
                        <option value="">Dispute Status</option>
                        <option value="Dispute Won Partially">Dispute Won Partially</option>
                        <option value="Dispute Won Fully">Dispute Won Fully</option>
                        <option value="Dispute Lost – TAT Expired">Dispute Lost – TAT Expired</option>
                        <option value="Dispute Lost – Accepted">Dispute Lost – Accepted</option>
                        <option value="Document Rejected">Document Rejected</option>
                        <option value="Document Pending Verification">Document Pending Verification</option>
                        <option value="Document Pending from Merchant">Document Pending from Merchant</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input" value={reportFilter.searchBy}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, searchBy: e.target.value }))}>
                        <option value="">Search By</option>
                        <option value="Txn ID">Transaction ID (Txn ID)</option>
                        <option value="RRN">RRN</option>
                        <option value="TID">TID</option>
                        <option value="MID">MID</option>
                        <option value="Case ID">Case ID</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Search</label>
                      <input type="text" className="sp-input" placeholder="Search..."
                        value={reportFilter.searchText}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, searchText: e.target.value }))} />
                    </div>
                    <div className="sp-field" style={{ visibility: 'hidden' }}></div>
                  </div>
                  <div className="search-panel-actions">
                    <button className="btn btn-secondary" onClick={() => setReportFilter({ from: DEFAULT_FROM, to: TODAY_STR, provider: '', disputeType: '', scheme: '', disputeStatus: '', searchBy: '', searchText: '' })}>
                      Reset
                    </button>
                    <button className="btn btn-primary" onClick={() => showToast('Reports filtered!')}>
                      Search
                    </button>
                  </div>
                </div>

                {/* Tab navigation */}
                <div className="tbl-card" style={{ overflow: 'visible' }}>
                  <div className="report-tabs" style={{ padding: '0 16px' }}>
                    <div className={`report-tab ${reportTab === 'dispute-mgmt' ? 'active' : ''}`} onClick={() => setReportTab('dispute-mgmt')}>
                      All Disputes
                    </div>
                    <div className={`report-tab ${reportTab === 'doc-pending' ? 'active' : ''}`} onClick={() => setReportTab('doc-pending')}>
                      Action Required
                    </div>
                    <div className={`report-tab ${reportTab === 'doc-verification' ? 'active' : ''}`} onClick={() => setReportTab('doc-verification')}>
                      Pending Verification
                    </div>
                  </div>

                  {/* Tab: Dispute Management */}
                  {reportTab === 'dispute-mgmt' && (
                    <div>
                      <div className="tbl-toolbar">
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{reportData.filtered.length} records</span>
                        <div className="tbl-space"></div>
                        <button className="btn btn-outline btn-sm" onClick={() => exportToCSV('raised')}>⬇ Export CSV</button>
                      </div>
                      <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Case ID</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>AR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>RR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Transaction Date & Time</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Dispute Date</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Txn Currency</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Amount</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Current Status</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>TAT</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.filtered.slice(0, 10).map(cb => (
                              <tr key={cb.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px 16px', color: '#50BDC9', fontWeight: '600' }}>{cb.caseId}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.txnDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.createdDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>INR</td>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{cb.txnAmt}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.mStatus}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ color: cb.aging > 5 ? 'var(--red)' : 'var(--yellow)', fontWeight: '600' }}>
                                    {cb.aging}d
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#50BDC9', fontSize: '16px' }} onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>
                                    👁
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab: Document Pending from Merchant */}
                  {reportTab === 'doc-pending' && (
                    <div>
                      <div className="tbl-toolbar">
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {actionRequiredDisputes.length} pending
                        </span>
                      </div>
                      <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Case ID</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>AR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>RR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Transaction Date & Time</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Dispute Date</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Txn Currency</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Amount</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Current Status</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>TAT</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {actionRequiredDisputes.map(cb => (
                              <tr key={cb.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px 16px', color: '#50BDC9', fontWeight: '600' }}>{cb.caseId}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.txnDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.createdDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>INR</td>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{cb.txnAmt}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.mStatus}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ color: cb.aging > 5 ? 'var(--red)' : 'var(--yellow)', fontWeight: '600' }}>
                                    {cb.aging}d
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#50BDC9', fontSize: '16px' }} onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>
                                    👁
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {actionRequiredDisputes.length === 0 && (
                              <tr><td colSpan="10" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>✅ No pending documents</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab: Document Pending for Verification */}
                  {reportTab === 'doc-verification' && (
                    <div>
                      <div className="tbl-toolbar">
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {pendingVerificationDisputes.length} awaiting verification
                        </span>
                      </div>
                      <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Case ID</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>AR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>RR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Transaction Date & Time</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Dispute Date</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Txn Currency</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Amount</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Current Status</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>TAT</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingVerificationDisputes.map(cb => (
                              <tr key={cb.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px 16px', color: '#50BDC9', fontWeight: '600' }}>{cb.caseId}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.txnDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.createdDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>INR</td>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{cb.txnAmt}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.mStatus}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ color: cb.aging > 5 ? 'var(--red)' : 'var(--yellow)', fontWeight: '600' }}>
                                    {cb.aging}d
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#50BDC9', fontSize: '16px' }} onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>
                                    👁
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {pendingVerificationDisputes.length === 0 && (
                              <tr><td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No documents pending verification</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>


              </div>
            </div>
          )}


        </main>
      </div>

      {activeModal === 'disputeDetails' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(c => c.id === targetDisputeId) || {};
            return (
              <div className="modal" style={{ width: '90%', maxWidth: '1100px', padding: '0', borderRadius: '4px', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#000' }}>{cb.id}</h2>
                  <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9e9e9e' }}>&times;</button>
                </div>
                
                <div style={{ padding: '0', overflowY: 'auto', flex: 1 }}>
                  {/* Original Transaction Details */}
                  <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                    <span>Original Transaction Details</span>
                    <span style={{ fontWeight: 'normal', color: '#757575' }}>Transaction Date & Time <span style={{color:'red'}}>*</span> : <span style={{color:'#333', fontWeight:'bold'}}>{formatDateDisp(cb.txnDate)}</span></span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                    {/* Col 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Case ID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.id}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>AR Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.rrn}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>RR Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.rrn}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Txn Currency <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Location <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>India</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Country <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>India</strong></div>
                    </div>
                    {/* Col 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Transaction Ref. Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnId}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>MID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.userId}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Card Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>457704******3989</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>City <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Zip code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                    </div>
                    {/* Col 3 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Merchant Name <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.userName}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>TID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>10515104</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Approval Code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>021838</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Address <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>State <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Request ID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                    </div>
                  </div>

                  {/* Dispute Details */}
                  <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                    <span>Dispute Details</span>
                    <span style={{ fontWeight: 'normal', color: '#757575' }}>Dispute Date <span style={{color:'red'}}>*</span> : <span style={{color:'#333', fontWeight:'bold'}}>{formatDateDisp(cb.txnDate)}</span></span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Scheme <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>VISA</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Reason Code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>13.1</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}><span style={{ color: '#9e9e9e' }}>Source Currency Code (Alpha) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Destination Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Remaining Days <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.aging}</strong></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Type <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px', textTransform: 'uppercase'}}>{cb.mSubStatus || cb.mStatus}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Description <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>13.1-Services Not Provided or Merchandise Not Received</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}><span style={{ color: '#9e9e9e' }}>Source Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Re-presentment Received Date Credit <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Amount (INR) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Current Status <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.mStatus}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '40px' }}><span style={{ color: '#9e9e9e' }}>Destination Currency Code (Alpha) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Admin Remarks <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.rejectReason || '-'}</strong></div>
                    </div>
                  </div>

                  {/* Previous Documents */}
                  <>
                      <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000' }}>
                        <span>Previous Documents</span>
                        <button style={{ background: '#50BDC9', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Download All Docs</button>
                      </div>
                      
                      <div style={{ padding: '20px', display: 'flex', gap: '16px', overflowX: 'auto', background: '#fff' }}>
                        {(cb.documents && cb.documents.length > 0) ? cb.documents.map(doc => (
                          <div key={doc.id} style={{ width: '220px', padding: '12px', border: '2px solid', borderColor: doc.status === 'Rejected' ? '#ff4d4f' : doc.status === 'Accepted' ? '#52c41a' : '#d1c4e9', borderTop: `4px solid ${doc.status === 'Rejected' ? '#ff4d4f' : doc.status === 'Accepted' ? '#52c41a' : '#d1c4e9'}`, borderRadius: '4px', flexShrink: 0, display: 'flex', flexDirection: 'column', color: '#333', background: '#fafafa' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', wordBreak: 'break-all' }}>📄 {doc.filename}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status: <strong style={{ color: doc.status === 'Rejected' ? '#ff4d4f' : doc.status === 'Accepted' ? '#52c41a' : '#faad14' }}>{doc.status}</strong></div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Date: {new Date(doc.uploadedAt).toLocaleDateString()}</div>
                            {doc.status === 'Rejected' && (
                              <div style={{ fontSize: '11px', color: '#ff4d4f', marginTop: '6px', padding: '6px', background: '#fff1f0', borderRadius: '4px' }}>
                                <strong>Remarks:</strong> {doc.rejectionRemarks}
                                <div style={{ marginTop: '8px' }}>
                                  <button style={{ fontSize: '11px', background: '#ff4d4f', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }} onClick={() => setActiveModal('contest')}>
                                    Re-upload
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No previous evidence uploaded.</div>
                        )}
                      </div>
                  </>
                </div>
                
                <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#fff', flexShrink: 0, zIndex: 10 }}>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button onClick={() => setActiveModal(null)} style={{ padding: '6px 16px', border: '1px solid #50BDC9', background: '#fff', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                    {reportTab === 'doc-pending' && (
                      <>
                        <button className="btn btn-outline" style={{ padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => { setActiveModal('action2'); }}>Accept Loss</button>
                        <button className="btn btn-primary" style={{ padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', background: '#1890ff', color: '#fff', border: 'none' }} onClick={() => { setActiveModal('contest'); }}>Upload Evidence</button>
                      </>
                    )}
                    {reportTab === 'doc-verification' && (cb.acquirerAction === 'evidence_uploaded' || (cb.documents && cb.documents.some(d => d.uploadedBy === 'Admin' && d.status === 'Pending Review'))) && (
                      <>
                        <button className="btn btn-danger" style={{ padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => handleMerchantRejectAdminClick(cb.id)}>Reject Admin Evidence</button>
                        <button className="btn btn-outline" style={{ padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => { setActiveModal('contest'); }}>Upload Additional Evidence</button>
                        <button className="btn btn-primary" style={{ padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', background: '#52c41a', color: '#fff', border: 'none' }} onClick={() => submitMerchantAcceptAdmin(cb.id)}>Accept Admin Evidence</button>
                      </>
                    )}
                    {reportTab === 'doc-verification' && cb.acquirerAction !== 'evidence_uploaded' && !(cb.documents && cb.documents.some(d => d.uploadedBy === 'Admin' && d.status === 'Pending Review')) && (
                      <span className="badge badge-progress" style={{ padding: '6px 16px', borderRadius: '4px', fontSize: '12px' }}>Pending Admin Verification</span>
                    )}
                    {reportTab !== 'doc-pending' && reportTab !== 'doc-verification' && getActionBtn(cb)}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Action Modals */}
      {activeModal === 'action1' && (
        <div className="overlay open">
          <div className="modal modal-sm">
            <button className="modal-close" style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--text-muted)' }} onClick={() => setActiveModal(null)}>✕</button>
            <div style={{ padding: '32px 28px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '10px' }}>Take Action For Dispute!</h2>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: '1.6' }}>
                Kindly represent the case before the deadline. If no response is logged, NPCI rule defaults to ticket debit adjustment.
              </p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginBottom: '12px', height: '46px', fontSize: '15px' }} 
                onClick={() => { setAcceptResponseSelect(''); setActiveModal('action2'); }}
              >
                Accept Liability (Close as Lost)
              </button>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', height: '46px', fontSize: '15px' }} 
                onClick={() => setActiveModal('contest')}
              >
                Fight Dispute &amp; Upload Evidence
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'action2' && (
        <div className="overlay open">
          <div className="modal">
            <div className="modal-hdr"><h3>Ticket Representation Action</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>Choose Action</div>
              <div style={{ position: 'relative', marginBottom: '16px' }}>
                <select className="mf-sel-box" value={acceptResponseSelect} onChange={(e) => handleResponseSelect(e.target.value)}>
                  <option value="">Choose Response</option>
                  <option value="accept">Accept Liability (Close as Lost)</option>
                  <option value="contest">Fight Dispute and Submit Evidence</option>
                </select>
              </div>
              {acceptResponseSelect === 'accept' && (
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '14px', lineHeight: '1.6' }}>
                    Accepting this dispute will refund the dispute amount to the customer. This action is final and closes the dispute ticket.
                  </p>
                  <div className="mf">
                    <label>Remarks</label>
                    <textarea 
                      className="mfi mfi-area" 
                      placeholder="Add accepting remarks..." 
                      value={acceptRemarks}
                      onChange={(e) => setAcceptRemarks(e.target.value)}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                    <button className="btn btn-primary" onClick={confirmAccept}>Accept Liability</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeModal === 'contest' && (
        <div className="overlay open">
          <div className="modal modal-lg">
            <div className="modal-hdr"><h3>Represent Dispute &amp; Submit Evidence</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Selected Action</div>
              <div className="radio-opts" style={{ marginBottom: '16px' }}>
                <label className="radio-opt">
                  <input type="radio" name="contestOpt" checked={false} onChange={() => setActiveModal('action2')} /> Accept Liability
                </label>
                <label className="radio-opt">
                  <input type="radio" name="contestOpt" checked={true} readOnly /> Contest Dispute &amp; Upload Proofs
                </label>
              </div>
              <div style={{ fontSize: '15px', fontWeight: '700', marginBottom: '6px' }}>Evidence Documents</div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
                The proof you upload will be reviewed by the card scheme network/NPCI review team. Max 20MB (.png, .jpeg, .pdf supported).
              </p>
              
              <div id="evidenceList">
                <div className="ev-row">
                  <label>ℹ Delivery/Service Proof</label>
                  <div>
                    {evidenceFiles[1] ? (
                      <div className="ev-uploaded">
                        📄 {evidenceFiles[1]} 
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', marginLeft: '8px' }} onClick={() => removeEvidenceFile(1)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <label className="ev-upload-btn" htmlFor="evInput1">☁ Choose proof file</label>
                        <input type="file" id="evInput1" style={{ display: 'none' }} onChange={(e) => handleEvidenceFileChange(1, e.target.files[0])} />
                      </>
                    )}
                  </div>
                </div>
                <div className="ev-row">
                  <label>ℹ Statement of Service</label>
                  <div>
                    {evidenceFiles[2] ? (
                      <div className="ev-uploaded">
                        📄 {evidenceFiles[2]} 
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', marginLeft: '8px' }} onClick={() => removeEvidenceFile(2)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <label className="ev-upload-btn" htmlFor="evInput2">☁ Choose file</label>
                        <input type="file" id="evInput2" style={{ display: 'none' }} onChange={(e) => handleEvidenceFileChange(2, e.target.files[0])} />
                      </>
                    )}
                  </div>
                </div>
                <div className="ev-row">
                  <label>ℹ Refund Invoice (Optional)</label>
                  <div>
                    {evidenceFiles[3] ? (
                      <div className="ev-uploaded">
                        📄 {evidenceFiles[3]} 
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)', marginLeft: '8px' }} onClick={() => removeEvidenceFile(3)}>✕</button>
                      </div>
                    ) : (
                      <>
                        <label className="ev-upload-btn" htmlFor="evInput3">☁ Choose file</label>
                        <input type="file" id="evInput3" style={{ display: 'none' }} onChange={(e) => handleEvidenceFileChange(3, e.target.files[0])} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="mf" style={{ marginTop: '14px' }}>
                <label>Justification Remarks</label>
                <input 
                  type="text" 
                  className="mfi" 
                  placeholder="Summarize your representation case (Max 500 chars)" 
                  value={contestRemarks}
                  onChange={(e) => setContestRemarks(e.target.value)}
                  maxLength={500} 
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitContestEvidence}>Submit Representation</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'successAccept' && (
        <div className="overlay open">
          <div className="modal modal-sm" style={{ textAlign: 'center', padding: '30px' }}>
            <button className="modal-close" style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--text-muted)' }} onClick={() => setActiveModal(null)}>✕</button>
            <div className="modal-success">
              <div className="ms-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>🔴</div>
              <h3>Dispute Deemed Accepted</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                The dispute has been marked accepted. Adjustment debit has been processed against your wallet balance.
              </p>
              <button className="btn btn-primary" style={{ marginTop: '20px', width: '100%' }} onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'successEvidence' && (
        <div className="overlay open">
          <div className="modal modal-sm" style={{ textAlign: 'center', padding: '30px' }}>
            <button className="modal-close" style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--text-muted)' }} onClick={() => setActiveModal(null)}>✕</button>
            <div className="modal-success">
              <div className="ms-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>🟢</div>
              <h3>Evidence Logs Received</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Dispute represented successfully. The settlement network team will evaluate and update statuses.
              </p>
              <button className="btn btn-primary" style={{ marginTop: '20px', width: '100%' }} onClick={() => setActiveModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════
// ADMIN PORTAL DASHBOARD
// ═════════════════════════════════════════════
const webhookData = [
  { id: 'WH-VISA-551029', event: 'DisputeCreatedEvent', time: '2024-05-26 10:14:02', typeLabel: 'Chargeback', typeColor: '#f57c00', typeBg: '#fff3e0', merchant: 'Nike India', amount: 'INR 14,999', status: '200 OK', statusColor: '#4caf50' },
  { id: 'WH-VISA-551030', event: 'PreArbitrationFili...', time: '2024-05-15 10:15:02', typeLabel: 'Pre-Arbitration', typeColor: '#00acc1', typeBg: '#e0f7fa', merchant: 'Steam Games', amount: 'INR 3,250', status: '201 OK', statusColor: '#4caf50' },
  { id: 'WH-VISA-551031', event: 'ArbitrationCaseFil...', time: '2024-05-02 10:10:01', typeLabel: 'Arbitration', typeColor: '#8e24aa', typeBg: '#f3e5f5', merchant: 'Reliance Retail', amount: 'INR 22,450', status: '200 OK', statusColor: '#4caf50' },
  { id: 'WH-VISA-551032', event: 'RetrievalRequestIn...', time: '2024-05-01 10:00:03', typeLabel: 'Retrieval Request', typeColor: '#00897b', typeBg: '#e0f2f1', merchant: 'Nike India', amount: 'INR 8,599', status: '200 OK', statusColor: '#4caf50' },
  { id: 'WH-VISA-551033', event: 'FraudAlertNotificati...', time: '2026-05-28 08:30:01', typeLabel: 'Fraud Alert', typeColor: '#c62828', typeBg: '#ffebee', merchant: 'masteruser', amount: 'INR 18,500', status: '200 OK', statusColor: '#4caf50' },
  { id: 'WH-VISA-551034', event: 'DisputeResolvedEvent', time: '2026-05-27 14:22:11', typeLabel: 'Won', typeColor: '#2e7d32', typeBg: '#e8f5e9', merchant: 'Zomato Services', amount: 'INR 6,200', status: '201 OK', statusColor: '#4caf50' },
  { id: 'WH-VISA-551035', event: 'ArbitrationOutcomeFil...', time: '2026-05-26 16:45:09', typeLabel: 'Arbitration', typeColor: '#8e24aa', typeBg: '#f3e5f5', merchant: 'masteruser', amount: 'INR 25,000', status: '⚠️ 408 Timeout', statusColor: '#ff9800' },
  { id: 'WH-VISA-551036', event: 'PreArbitrationRespDue...', time: '2026-05-25 09:10:00', typeLabel: 'Pre-Arbitration', typeColor: '#00acc1', typeBg: '#e0f7fa', merchant: 'Paytm Mall', amount: 'INR 11,200', status: '❌ 500 Error', statusColor: '#f44336' },
  { id: 'WH-VISA-551037', event: 'VROLInquiryReceived...', time: '2026-05-24 11:00:44', typeLabel: 'VROL Inquiry', typeColor: '#f57c00', typeBg: '#fff3e0', merchant: 'Test@isu', amount: 'INR 7,500', status: '200 OK', statusColor: '#4caf50' },
  { id: 'WH-VISA-551038', event: 'DisputeStatusUpdate...', time: '2026-06-01 07:00:12', typeLabel: 'Status Update', typeColor: '#00897b', typeBg: '#e0f2f1', merchant: 'Myntra Fashion', amount: 'INR 9,200', status: '200 OK', statusColor: '#4caf50' }
];

function AdminPortal({
  currentUser, chargebacks, users, ledger, setView, toggleTheme, darkMode, formatINR, formatDateDisp, showToast, refreshAllData, resetAllSessions, handleLogout
}) {
  const [activePage, setActivePage] = useState('a-dashboard'); // 'a-dashboard' | 'a-chargeback' | 'a-raise-cb' | 'a-view-cb' | 'a-lein' | 'a-credit'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [disputeMenuOpen, setDisputeMenuOpen] = useState(true);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  // Modal active
  const [activeModal, setActiveModal] = useState(null); // null | 'remarks' | 'arbitration' | 'refund' | 'visaRuling' | 'acceptPartially'
  const [targetWebhook, setTargetWebhook] = useState(null);
  const [targetDisputeId, setTargetDisputeId] = useState(null);
  const [visaAcceptedAmount, setVisaAcceptedAmount] = useState('');
  const [visaRemarks, setVisaRemarks] = useState('');
  const [visaEvidenceFile, setVisaEvidenceFile] = useState(null);
  
  // Document rejection state
  const [selectedDocsToReject, setSelectedDocsToReject] = useState([]);
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [adminDisputeAction, setAdminDisputeAction] = useState('full');

  // Form states
  const [selectedProvider, setSelectedProvider] = useState('');
  const [bulkFileContent, setBulkFileContent] = useState('');
  const [bulkFileName, setBulkFileName] = useState('');
  const [uploadResult, setUploadResult] = useState(null); // null | { total, success, fail }

  // Credit adjustment states
  const [adjMerchant, setAdjMerchant] = useState('');
  const [adjType, setAdjType] = useState('Credit');
  const [adjAmount, setAdjAmount] = useState('');
  const [adjRemarks, setAdjRemarks] = useState('');

  // Search Filter View Chargebacks
  const [filterRrn, setFilterRrn] = useState('');
  const [filterMid, setFilterMid] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSubStatus, setFilterSubStatus] = useState('');
  
  const TODAY_STR = new Date().toISOString().split('T')[0];
  const DEFAULT_FROM = (() => {
    let d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0];
  })();
  const [filterFrom, setFilterFrom] = useState(DEFAULT_FROM);
  const [filterTo, setFilterTo] = useState(TODAY_STR);
  
  // Dashboard date filters
  const [dashDateRangeType, setDashDateRangeType] = useState('7days');
  const [dashFilterFrom, setDashFilterFrom] = useState(() => { let d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [dashFilterTo, setDashFilterTo] = useState(TODAY_STR);

  const [filterSearchBy, setFilterSearchBy] = useState('');
  const [aVcSearchInput, setAVcSearchInput] = useState('');

  // Pagination view chargebacks
  const [aVcPage, setAVcPage] = useState(1);
  const [aVcLimit, setAVcLimit] = useState(5);
  const [adminTab, setAdminTab] = useState('management');

  // Expanded row IDs
  const [expandedRowIds, setExpandedRowIds] = useState({});
  const [evidenceFiles, setEvidenceFiles] = useState({ adminUpload: null });

  const isPendingVerification = (cb) =>
    cb && (cb.merchantAction === 'evidence' || cb.merchantAction === 'rejected' || cb.merchantAction === 'additional_evidence') && !cb.acquirerAction && !cb.visaPending;

  const handleAdminEscalate = async (id) => {
    try {
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin', 'x-user-name': currentUser?.username || 'Test@Ad' },
        body: JSON.stringify({ action: 'escalate' })
      });
      if (response.ok) {
        setActiveModal(null);
        showToast('Escalated to Pre-Arbitration successfully');
        await refreshAllData();
      } else {
        showToast('Escalation failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  const selectProvider = (p) => {
    setSelectedProvider(p);
  };

  const changeProvider = () => {
    setSelectedProvider('');
    setBulkFileName('');
    setBulkFileContent('');
    setUploadResult(null);
  };

  const filterAdminCb = () => {
    setAVcPage(1);
  };

  const resetAdminCb = () => {
    setFilterRrn('');
    setFilterMid('');
    setFilterStatus('');
    setFilterSubStatus('');
    setFilterSearchBy('');
    setFilterFrom(DEFAULT_FROM);
    setFilterTo(TODAY_STR);
    setAVcSearchInput('');
    setAVcPage(1);
  };

  // Compute stats
  const getAdminDashboardStats = () => {
    let list = chargebacks;
    if (dashFilterFrom) {
      list = list.filter(cb => cb.createdDate >= dashFilterFrom);
    }
    if (dashFilterTo) {
      list = list.filter(cb => cb.createdDate <= dashFilterTo);
    }

    const totalCount = list.length;
    const totalAmt = list.reduce((sum, c) => sum + c.txnAmt, 0);

    const openList = list.filter(cb => cb.mSubStatus.includes('New') || cb.mSubStatus.includes('Progress') || cb.mSubStatus.includes('Resubmit') || cb.mSubStatus.includes('Hold'));
    const openAmt = openList.reduce((sum, c) => sum + c.txnAmt, 0);

    const lostList = list.filter(cb => cb.mSubStatus.includes('Lost'));
    const lostAmt = lostList.reduce((sum, c) => sum + c.txnAmt, 0);

    const wonList = list.filter(cb => cb.mSubStatus.includes('Won') || cb.mSubStatus.includes('Success'));
    const wonAmt = wonList.reduce((sum, c) => sum + c.txnAmt, 0);

    return {
      totalCount, totalAmt,
      openCount: openList.length, openAmt,
      lostCount: lostList.length, lostAmt,
      wonCount: wonList.length, wonAmt
    };
  };

  const stats = getAdminDashboardStats();

  // Pending representations
  const pendingReviews = chargebacks.filter(cb => cb.merchantAction === 'rejected' && cb.acquirerAction === null);

  // Filters admin disputes list
  const getFilteredAdmin = () => {
    let list = chargebacks.filter(cb => {
      if (filterRrn) {
        if (filterSearchBy === 'Txn ID' && !cb.txnId.includes(filterRrn)) return false;
        if (filterSearchBy === 'RRN' && !cb.rrn.includes(filterRrn)) return false;
        if (filterSearchBy === 'TID' && !cb.tid?.includes(filterRrn)) return false;
        if (filterSearchBy === 'MID' && !cb.userId.includes(filterRrn)) return false;
        if (filterSearchBy === 'Case ID' && !cb.caseId?.includes(filterRrn) && !cb.id?.includes(filterRrn)) return false;
        if (filterSearchBy === 'Merchant Name' && !cb.userName?.toLowerCase().includes(filterRrn.toLowerCase())) return false;
        if (!filterSearchBy && !cb.rrn.includes(filterRrn) && !cb.txnId.includes(filterRrn) && !cb.userId.includes(filterRrn) && !cb.id?.includes(filterRrn) && !cb.userName?.toLowerCase().includes(filterRrn.toLowerCase())) return false;
      }
      if (filterStatus && cb.mStatus !== filterStatus) return false;
      if (filterSubStatus && cb.mSubStatus !== filterSubStatus) return false;
      if (filterFrom && cb.createdDate && cb.createdDate < filterFrom) return false;
      if (filterTo && cb.createdDate && cb.createdDate > filterTo) return false;
      return true;
    });

    if (adminTab === 'merchant-pending') {
      list = list.filter(cb => !cb.merchantAction || cb.merchantAction === 'additional_evidence');
    } else if (adminTab === 'verification-pending') {
      list = list.filter(cb => (cb.merchantAction === 'evidence' || cb.merchantAction === 'rejected') && cb.acquirerAction === null);
    }

    if (aVcSearchInput) {
      const q = aVcSearchInput.toLowerCase();
      list = list.filter(cb => cb.rrn.includes(q) || cb.txnId.includes(q) || cb.userName.toLowerCase().includes(q));
    }
    return list;
  };

  const filteredAdminList = getFilteredAdmin();

  const exportExcel = (src) => {
    const dataToExport = src === 'admin' ? filteredAdminList : chargebacks;
    const filename = src === 'admin' ? 'chargebacks_admin_view.csv' : 'chargeback_export.csv';
    
    if (!dataToExport.length) {
      showToast('No data to export', 'error');
      return;
    }
    
    const headers = ['RRN', 'Case ID', 'Txn ID', 'Merchant', 'Status', 'Sub Status', 'Amount', 'Date', 'Product'];
    const rows = dataToExport.map(cb => [
      cb.rrn,
      cb.caseId,
      cb.txnId,
      cb.userName,
      cb.mStatus,
      cb.mSubStatus,
      cb.txnAmt,
      cb.createdDate,
      cb.product
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV Export completed');
  };

  // Paginated list
  const paginateList = (list, page, limit) => {
    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    let curr = page;
    if (curr > totalPages) curr = totalPages;
    if (curr < 1) curr = 1;
    const start = (curr - 1) * limit;
    const end = Math.min(start + limit, total);
    const paginated = list.slice(start, end);
    return { paginated, startRecord: total === 0 ? 0 : start + 1, endRecord: end, total, totalPages, curr };
  };

  const adminPaging = paginateList(filteredAdminList, aVcPage, aVcLimit);

  // Status Badge Builder
  const renderStatusBadge = (s) => {
    const m = {
      'Chargeback Raise': 'badge-cb',
      'Pre-Arbitration Raise': 'badge-prearb',
      'Pre-Arbitration Raised': 'badge-prearb',
      'Arbitration Raise': 'badge-arb',
      'Arbitration Raised': 'badge-arb',
      'Fraud Chargeback Raise': 'badge-fraud',
      'Differed Chargeback Raise': 'badge-deferred',
      'VROL Inquiry': 'badge-pending',
      'VROL Chargeback': 'badge-cb',
      'VROL Pre-Arbitration': 'badge-prearb',
      'VROL Arbitration': 'badge-arb'
    };
    return <span className={`badge ${m[s] || 'badge-new'}`}>{s}</span>;
  };

  const renderSubBadge = (s) => {
    const m = {
      'Chargeback New': 'badge-new',
      'Chargeback Lost': 'badge-lost',
      'Chargeback in Progress': 'badge-progress',
      'Chargeback Resubmit': 'badge-resubmit',
      'Chargeback Won': 'badge-won',
      'Refund Success': 'badge-won',
      'Refund On Hold': 'badge-progress'
    };
    return <span className={`badge ${m[s] || 'badge-pending'}`}>{s}</span>;
  };

  const toggleRowExpand = (id) => {
    setExpandedRowIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Review consider representment
  const handleConsider = async (disputeId) => {
    const id = disputeId || targetDisputeId;
    if (!id) return;
    try {
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Internal Team Considered – Represented NPCI UDIR',
        remarks: 'Merchant representations verified. Routing represented claim to Visa VROL.',
        file: evidenceFiles?.adminUpload?.name || null
      };

      const response = await fetch(`${API_URL}/disputes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acquirerAction: 'considered',
          mSubStatus: 'Chargeback in Progress',
          timelineEntry: entry
        })
      });

      if (response.ok) {
        setActiveModal(null);
        showToast('Representment filed with NPCI successfully');
        await refreshAllData();
      } else {
        showToast('Consider action failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  const handleAdminUploadClick = (disputeId) => {
    setTargetDisputeId(disputeId);
    setEvidenceFiles({ 1: null });
    setActiveModal('adminUploadEvidence');
  };

  const submitAdminUploadEvidence = async () => {
    if (!evidenceFiles[1]) {
      showToast('Please select a file to upload', 'error');
      return;
    }
    const id = targetDisputeId;
    if (!id) return;

    try {
      const evidenceName = evidenceFiles[1].name;
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin', 'x-user-name': currentUser?.username || 'nsdladmin' },
        body: JSON.stringify({
          action: 'admin_upload_evidence',
          evidence: evidenceName
        })
      });

      if (response.ok) {
        setActiveModal(null);
        showToast('Evidence uploaded to merchant successfully', 'success');
        refreshAllData();
      } else {
        const errorData = await response.json();
        showToast(errorData.message || 'Action failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  const submitMerchantAcceptAdmin = async (id) => {
    try {
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'merchant', 'x-user-name': currentUser?.username },
        body: JSON.stringify({ action: 'merchant_accept_admin' })
      });
      if (response.ok) {
        showToast('Admin evidence accepted. Case forwarded.', 'success');
        refreshAllData();
      } else {
        const err = await response.json();
        showToast(err.message, 'error');
      }
    } catch (error) {
      showToast('API error', 'error');
    }
  };

  const handleMerchantRejectAdminClick = (id) => {
    setTargetDisputeId(id);
    setSelectedDocsToReject([]);
    setRejectionRemarks('');
    setActiveModal('merchantRejectAdminDocs');
  };

  const submitMerchantRejectAdminDocs = async () => {
    if (selectedDocsToReject.length === 0) {
      showToast('Please select at least one document to reject', 'error');
      return;
    }
    if (!rejectionRemarks.trim()) {
      showToast('Rejection remarks are mandatory', 'error');
      return;
    }
    const id = targetDisputeId;
    if (!id) return;

    try {
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'merchant', 'x-user-name': currentUser?.username },
        body: JSON.stringify({
          action: 'merchant_reject_admin',
          comments: rejectionRemarks,
          rejectedDocs: selectedDocsToReject.map(docId => ({ id: docId, remarks: rejectionRemarks }))
        })
      });
      if (response.ok) {
        setActiveModal(null);
        showToast('Admin documents rejected', 'success');
        refreshAllData();
      } else {
        const err = await response.json();
        showToast(err.message, 'error');
      }
    } catch (err) {
      showToast('API error', 'error');
    }
  };

  const handleDeclineClick = (disputeId) => {
    setTargetDisputeId(disputeId);
    setSelectedDocsToReject([]);
    setRejectionRemarks('');
    setActiveModal('declineDocuments');
  };

  const submitDeclineDocs = async () => {
    if (selectedDocsToReject.length === 0) {
      showToast('Please select at least one document to reject', 'error');
      return;
    }
    if (!rejectionRemarks.trim()) {
      showToast('Rejection remarks are mandatory', 'error');
      return;
    }
    const id = targetDisputeId;
    if (!id) return;
    try {
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin', 'x-user-name': currentUser?.username || 'nsdladmin' },
        body: JSON.stringify({
          action: 'admin_request_info',
          comments: rejectionRemarks,
          rejectedDocs: selectedDocsToReject.map(docId => ({ id: docId, remarks: rejectionRemarks }))
        })
      });

      if (response.ok) {
        setActiveModal(null);
        showToast('Dispute proofs declined. Rerouted to merchant.', 'success');
        await refreshAllData();
      } else {
        showToast('Failed to decline proofs', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  // Process accept merchant documents
  const handleAcceptDocs = async (disputeId) => {
    const id = disputeId || targetDisputeId;
    if (!id) return;
    try {
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Merchant Documents Accepted',
        remarks: 'Admin accepted the merchant\'s submitted documents. (Visa pending final resolution)',
        file: null
      };

      const response = await fetch(`${API_URL}/disputes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acquirerAction: 'accepted_docs',
          timelineEntry: entry
        })
      });

      if (response.ok) {
        setActiveModal(null);
        showToast('Documents accepted successfully');
        await refreshAllData();
      } else {
        showToast('Failed to accept documents', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  // Visa Workflow Handlers
  const handleVisaAccept = async (disputeId) => {
    const id = disputeId || targetDisputeId;
    if (!id) return;
    try {
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin', 'x-user-name': currentUser?.username || 'nsdladmin' },
        body: JSON.stringify({ action: 'visa_accept' })
      });
      if (response.ok) {
        setActiveModal(null);
        showToast('Accepted and sent to Visa for final review');
        await refreshAllData();
      } else { showToast('Action failed', 'error'); }
    } catch (err) { showToast('API error', 'error'); }
  };

  const handleVisaReview = async (disputeId) => {
    const id = disputeId || targetDisputeId;
    if (!id) return;
    try {
      const response = await fetch(`${API_URL}/disputes/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin', 'x-user-name': currentUser?.username || 'nsdladmin' },
        body: JSON.stringify({ action: 'visa_review' })
      });
      if (response.ok) {
        setActiveModal(null);
        showToast('Sent to Visa for Review');
        await refreshAllData();
      } else { showToast('Action failed', 'error'); }
    } catch (err) { showToast('API error', 'error'); }
  };

  const handleVisaAcceptPartially = async () => {
    if (!targetDisputeId) return;
    if (!visaAcceptedAmount || !visaRemarks || !visaEvidenceFile) {
      showToast('Amount, Remarks, and Evidence are required for partial acceptance', 'error');
      return;
    }
    try {
      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin', 'x-user-name': currentUser?.username || 'nsdladmin' },
        body: JSON.stringify({ 
          action: 'visa_accept_partially',
          acceptedAmount: Number(visaAcceptedAmount),
          comments: visaRemarks,
          evidence: visaEvidenceFile.name
        })
      });
      if (response.ok) {
        setActiveModal(null);
        setVisaAcceptedAmount('');
        setVisaRemarks('');
        setVisaEvidenceFile(null);
        showToast('Partial acceptance submitted to Visa');
        await refreshAllData();
      } else { showToast('Action failed', 'error'); }
    } catch (err) { showToast('API error', 'error'); }
  };

  // Arbitration won decision
  const handleArbitrationWon = async () => {
    try {
      const targetCb = chargebacks.find(x => x.id === targetDisputeId);
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Arbitration Won (NPCI Decision)',
        remarks: 'Ruling in favor of merchant. Dispute won. Wallet credited back.',
        file: null
      };

      // We need to credit merchant wallet balance. The backend route PUT /api/disputes doesn't modify wallets directly,
      // but we can call credit ledger endpoint! A credit ledger endpoint updates wallet + logs automatically!
      // Let's call /api/ledger to adjust merchant wallet balance, and update dispute status.
      
      // Update dispute status
      const resDisp = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acquirerAction: 'won',
          mSubStatus: 'Chargeback Won',
          timelineEntry: entry
        })
      });

      // Credit wallet via Ledger route
      const resLedg = await fetch(`${API_URL}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: targetCb.userName || 'masteruser',
          type: 'Credit',
          amount: targetCb.adjAmt,
          remarks: `NPCI Arbitration Won: RRN ${targetCb.rrn}`
        })
      });

      if (resDisp.ok && resLedg.ok) {
        setActiveModal(null);
        showToast('Arbitration ruled: WON. Wallet credited.');
        await refreshAllData();
      } else {
        showToast('Failed to record arbitration won', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  // Arbitration lost decision
  // Arbitration lost decision
  const handleArbitrationLost = async (disputeId) => {
    const id = typeof disputeId === 'string' ? disputeId : targetDisputeId;
    if (!id) return;
    try {
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Loss Accepted & Sent to Visa',
        remarks: 'Admin accepted the loss. Status sent to Visa for processing. Through Visa, the merchant refund will be processed.',
        file: null
      };

      const response = await fetch(`${API_URL}/disputes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acquirerAction: 'lost',
          mSubStatus: 'Chargeback Lost',
          visaPending: true,
          timelineEntry: entry
        })
      });

      if (response.ok) {
        setActiveModal(null);
        showToast('Arbitration ruled: LOST. Dispute closed.', 'error');
        await refreshAllData();
      } else {
        showToast('Failed to record arbitration lost', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  // Process refund accept
  const handleRefundAccept = async () => {
    try {
      const targetCb = chargebacks.find(x => x.id === targetDisputeId);
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Refund Accepted & Settled',
        remarks: 'Refund completed successfully. Merchant wallet debited.',
        file: null
      };

      // 1. Update dispute status
      const resDisp = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mSubStatus: 'Refund Success',
          timelineEntry: entry
        })
      });

      // 2. Debit wallet via Ledger route
      const resLedg = await fetch(`${API_URL}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: targetCb.userName || 'masteruser',
          type: 'Debit',
          amount: targetCb.adjAmt,
          remarks: `Acquired Refund Settle: RRN ${targetCb.rrn}`
        })
      });

      if (resDisp.ok && resLedg.ok) {
        setActiveModal(null);
        showToast('Refund processed successfully. Wallet debited.');
        await refreshAllData();
      } else {
        showToast('Failed to settle refund', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  // Process refund hold
  const handleRefundHold = async () => {
    try {
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Refund Placed On Hold',
        remarks: 'Internal team placed acquiring refund on hold pending validation.',
        file: null
      };

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mSubStatus: 'Refund On Hold',
          timelineEntry: entry
        })
      });

      if (response.ok) {
        setActiveModal(null);
        showToast('Refund placed on hold', 'warning');
        await refreshAllData();
      } else {
        showToast('Decline action failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
  };

  // File selection
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setBulkFileName(file.name + ` (${Math.round(file.size/1024)} KB)`);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setBulkFileContent(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleClearFile = () => {
    setBulkFileName('');
    setBulkFileContent('');
    document.getElementById('cbFile').value = '';
  };

  // Process CSV upload
  const handleBulkUploadSubmit = () => {
    if (!bulkFileContent) {
      showToast('No file content loaded', 'error');
      return;
    }

    showToast('Uploading disputes...', 'warning');

    setTimeout(async () => {
      try {
        const lines = bulkFileContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) {
          showToast('CSV is empty or missing headers', 'error');
          return;
        }

        // Simple CSV parser
        const parseCSVRow = (text) => {
          let p = false, r = [''], a = 0;
          for (let i = 0; i < text.length; i++) {
            let c = text[i];
            if (c === '"') { p = !p; }
            else if (c === ',' && !p) { r[++a] = ''; }
            else { r[a] += c; }
          }
          return r.map(x => x.trim().replace(/^["']|["']$/g, ''));
        };

        const headers = parseCSVRow(lines[0]);
        let addedCount = 0;
        let failedCount = 0;
        const uploadPayload = [];

        const TODAY_FMT = new Date().toISOString().split('T')[0];
        const daysAgoFmt = (n) => {
          let d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
        };

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVRow(lines[i]);
          if (cols.length < headers.length || !cols[0]) {
            failedCount++;
            continue;
          }

          const rowData = {};
          headers.forEach((h, idx) => {
            rowData[h] = cols[idx];
          });

          const rrn = rowData['RRN'] || ('60999' + Math.floor(Math.random() * 99999));
          const txnId = rowData['Txn ID'] || ('532' + Math.floor(Math.random() * 999999));
          const txnAmt = parseFloat(rowData['Txn Amount']) || 500;
          const txnDate = rowData['TXN Date'] || daysAgoFmt(3);
          const beneMobile = rowData['Bene Mobile'] || '9348909111';
          const glNo = rowData['GL No'] || '354422';
          const product = rowData['Product'] || selectedProvider || 'VISA';

          uploadPayload.push({
            id: 'CB' + Math.floor(Math.random() * 90000 + 10000),
            caseId: 'CASE' + Math.floor(Math.random() * 90000 + 10000),
            userName: 'masteruser',
            userId: '2575789089',
            rrn, txnId,
            terminalId: '5690001',
            beneMobile, remMobile: '7845695611',
            createdDate: TODAY_FMT,
            txnDate, adjDate: TODAY_FMT,
            respondByDate: new Date(new Date().getTime() + 86400000).toISOString().split('T')[0],
            mStatus: 'Chargeback Raise',
            mSubStatus: 'Chargeback New',
            adjType: 'Chargeback Raise',
            remitter: 'AXB', beneficiary: 'FIP',
            txnAmt, adjAmt: txnAmt, leinAmt: 0,
            glNo, currency: 'Rupees', reasonCode: '1', pan: '832927*****',
            walletStatus: 'Debited', product, aging: 0, merchantAction: null, acquirerAction: null,
            timeline: [{ by: 'nsdladmin', time: new Date().toLocaleString(), title: 'Dispute Raised via Bulk Upload', remarks: '', file: null }]
          });
          addedCount++;
        }

        // Post to API
        const response = await fetch(`${API_URL}/disputes/bulk-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(uploadPayload)
        });

        if (response.ok) {
          setUploadResult({ total: addedCount + failedCount, success: addedCount, fail: failedCount });
          showToast(`File processed successfully. Created ${addedCount} disputes.`);
          await refreshAllData();
        } else {
          showToast('Failed to process bulk upload via backend', 'error');
        }
      } catch (err) {
        console.error(err);
        showToast('CSV parsing/API error', 'error');
      }
    }, 800);
  };

  const handleResetUpload = () => {
    handleClearFile();
    setUploadResult(null);
  };

  const downloadSampleTemplate = () => {
    const headers = ['RRN', 'Txn ID', 'Txn Amount', 'TXN Date', 'Bene Mobile', 'GL No', 'Product'];
    const rows = [
      ['609315655333', '8768994', '500', new Date(new Date().getTime() - 5*86400000).toISOString().split('T')[0], '9348909106', '354422', 'VISA'],
      ['609315298417', '8768995', '1200', new Date(new Date().getTime() - 3*86400000).toISOString().split('T')[0], '9348909107', '354422', 'VISA']
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "iserveu_chargeback_sample.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Sample template downloaded');
  };

  // Submit Credit adjustment
  const handleAdjustmentSubmit = async () => {
    if (!adjMerchant) { showToast('Please select target merchant', 'error'); return; }
    const amount = parseFloat(adjAmount);
    if (isNaN(amount) || amount <= 0) { showToast('Please enter valid adjustment amount', 'error'); return; }
    if (!adjRemarks) { showToast('Please add adjustment remarks', 'error'); return; }

    try {
      const response = await fetch(`${API_URL}/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant: adjMerchant,
          type: adjType,
          amount: amount,
          remarks: adjRemarks
        })
      });

      if (response.ok) {
        setAdjAmount('');
        setAdjRemarks('');
        showToast('Wallet balance adjusted successfully');
        await refreshAllData();
      } else {
        const errData = await response.json();
        showToast(errData.message || 'Adjustment failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API communication error', 'error');
    }
  };

  return (
    <div className="app" id="adminApp">
      <header className="app-header">
        <button className="hdr-hamburger" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>☰</button>
        <div className="hdr-logo"><div className="hl-text">iServeU<sup>®</sup></div></div>
        <span className="admin-badge">ADMIN</span>
        <div className="hdr-space"></div>
        <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="hdr-bell">🔔<span className="notif-dot"></span></button>
        <div 
          className="hdr-user" 
          title={currentUser.name}
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          <div className="avatar" style={{ background: '#1e293b', color: '#fff' }}>KD</div>
          <div>
            <div className="hdr-uname">{currentUser.name}</div>
            <div className="hdr-urole">Admin / FRM</div>
          </div>
          {profileMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #ddd)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '160px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', color: 'var(--text-main, #333)', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--border-color, #eee)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background='var(--bg-body, #f9f9f9)'} onMouseLeave={(e) => e.target.style.background='transparent'} onClick={(e) => { e.stopPropagation(); showToast('Change password functionality not implemented'); setProfileMenuOpen(false); }}>Change Password</div>
              <div style={{ padding: '12px 16px', color: 'var(--red, #d32f2f)', fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background='var(--bg-body, #f9f9f9)'} onMouseLeave={(e) => e.target.style.background='transparent'} onClick={(e) => { e.stopPropagation(); handleLogout(); }}>Logout</div>
            </div>
          )}
        </div>
      </header>

      <div className="app-body">
        <nav className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} id="aSidebar">
          <div className="sb-welcome">Welcome, Krishna Das</div>
          <div className="sb-section">
            <div 
              className={`sb-item ${activePage === 'a-dashboard' ? 'active' : ''}`}
              onClick={() => setActivePage('a-dashboard')}
            >
              <span className="si">⊞</span> Dashboard
            </div>
            <div 
              className={`sb-item ${activePage === 'a-view-cb' ? 'active' : ''}`}
              onClick={() => { setAVcPage(1); setActivePage('a-view-cb'); }}
            >
              <span className="si">📋</span> Dispute Management
            </div>
            <div 
              className={`sb-item ${activePage === 'a-webhook' ? 'active' : ''}`}
              onClick={() => setActivePage('a-webhook')}
            >
              <span className="si">⚙️</span> Visa VROL Webhook Status
            </div>



          </div>
        </nav>

        <main className="main">
          {/* Admin Dashboard */}
          {activePage === 'a-dashboard' && (
            <div className="page active" id="a-dashboard">
              <div className="page-inner">
                <div className="welcome-bar">
                  <div>
                    <div className="wb-title">Welcome to Admin Portal</div>
                  </div>
                  <div className="wb-date">{new Date().toLocaleDateString('en-IN')}</div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: '700', margin: 0 }}>Dispute Dashboard</h3>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select
                      style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }}
                      value={dashDateRangeType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDashDateRangeType(val);
                        const today = new Date();
                        const todayStr = today.toISOString().split('T')[0];
                        if (val === 'today') {
                          setDashFilterFrom(todayStr);
                          setDashFilterTo(todayStr);
                        } else if (val === 'yesterday') {
                          const y = new Date(today);
                          y.setDate(y.getDate() - 1);
                          setDashFilterFrom(y.toISOString().split('T')[0]);
                          setDashFilterTo(y.toISOString().split('T')[0]);
                        } else if (val === '7days') {
                          const d7 = new Date(today);
                          d7.setDate(d7.getDate() - 7);
                          setDashFilterFrom(d7.toISOString().split('T')[0]);
                          setDashFilterTo(todayStr);
                        } else if (val === 'lastmonth') {
                          const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                          const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                          setDashFilterFrom(lmStart.toISOString().split('T')[0]);
                          setDashFilterTo(lmEnd.toISOString().split('T')[0]);
                        }
                      }}
                    >
                      <option value="today">Today</option>
                      <option value="custom">Custom Date Range</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="lastmonth">Last Month</option>
                    </select>
                    {dashDateRangeType === 'custom' && (
                      <>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '8px', color: '#50BDC9', fontSize: '14px' }}>📅</span>
                          <input type="date" style={{ padding: '8px 12px 8px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }} value={dashFilterFrom} onChange={(e) => setDashFilterFrom(e.target.value)} />
                        </div>
                        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>to</span>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '8px', color: '#50BDC9', fontSize: '14px' }}>📅</span>
                          <input type="date" style={{ padding: '8px 12px 8px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }} value={dashFilterTo} onChange={(e) => setDashFilterTo(e.target.value)} />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="stats-grid" id="adminDashStats" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                  <div className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Total Transactions</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1', color: 'var(--text)' }}>{stats.totalCount}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Overall</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatINR(stats.totalAmt)}</div>
                    <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--brand)' }}>+5.2%</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>vs yesterday</span>
                    </div>
                  </div>

                  <div className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Dispute Received</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1', color: 'var(--text)' }}>{stats.totalCount}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Claims log</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatINR(stats.totalAmt)}</div>
                    <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--brand)' }}>+12.5%</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>vs yesterday</span>
                    </div>
                  </div>
                  
                  <div className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Dispute Open</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1', color: 'var(--yellow)' }}>{stats.openCount}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>In SLA flight</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatINR(stats.openAmt)}</div>
                    <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--yellow)' }}>-4.2%</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>vs yesterday</span>
                    </div>
                  </div>
                  
                  <div className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Dispute Lost</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1', color: 'var(--red)' }}>{stats.lostCount}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Auto-TAT/Conceded</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatINR(stats.lostAmt)}</div>
                    <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--red)' }}>+2.1%</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>vs yesterday</span>
                    </div>
                  </div>
                  
                  <div className="stat-card" style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Dispute Won</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1', color: 'var(--green)' }}>{stats.wonCount}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>Re-presentments won</span>
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatINR(stats.wonAmt)}</div>
                    <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--green)' }}>+8.4%</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>vs yesterday</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Chargeback Menu */}
          {activePage === 'a-chargeback' && (
            <div className="page active" id="a-chargeback">
              <div className="view-chargeback-header">
                <span className="vc-breadcrumb">Dispute Management / <span>Chargeback Menu</span></span>
              </div>
              <div className="page-inner">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '700px', margin: '40px auto 24px' }}>

                  <div 
                    style={{ border: '1.5px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: 'var(--card)' }}
                    onClick={() => { setAVcPage(1); setActivePage('a-view-cb'); }}
                  >
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>👁</div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>View Chargeback</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Search, expand details and take actions</p>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* Admin View Chargebacks */}
          {activePage === 'a-view-cb' && (
            <div className="page active" id="a-view-cb">
              <div className="view-chargeback-header">
                <span className="vc-breadcrumb">Dispute Management / <span>View Dispute History</span></span>
              </div>
              <div className="page-inner">
                {adminTab === 'management' && (
                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>
                    <legend style={{ padding: '0 8px', color: '#50BDC9', fontWeight: '600', fontSize: '15px', marginLeft: '12px' }}>Search</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                      {/* Col 1 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>From Date</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#50BDC9' }}>📅</span>
                            <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="From Date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Vendor</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }}>
                            <option value="ISU">ISU</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Dispute Status</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">Dispute Status</option>
                            <option value="Dispute Won Partially">Dispute Won Partially</option>
                            <option value="Dispute Won Fully">Dispute Won Fully</option>
                            <option value="Dispute Lost – TAT Expired">Dispute Lost – TAT Expired</option>
                            <option value="Dispute Lost – Accepted">Dispute Lost – Accepted</option>
                            <option value="Document Rejected">Document Rejected</option>
                            <option value="Document Pending Verification">Document Pending Verification</option>
                            <option value="Document Pending from Merchant">Document Pending from Merchant</option>
                          </select>
                        </div>
                      </div>
                      {/* Col 2 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>To Date</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#50BDC9' }}>📅</span>
                            <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="To Date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Scheme</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }}>
                            <option value="Visa">Visa</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Search By</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                            <option value="">Search By</option>
                            <option value="Txn ID">Transaction ID (Txn ID)</option>
                            <option value="RRN">RRN</option>
                            <option value="TID">TID</option>
                            <option value="MID">MID</option>
                            <option value="Case ID">Case ID</option>
                            <option value="Merchant Name">Merchant Name</option>
                          </select>
                        </div>
                      </div>
                      {/* Col 3 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Dispute Type</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterSubStatus} onChange={(e) => setFilterSubStatus(e.target.value)}>
                            <option value="">Dispute Type</option>
                            <option value="Chargeback">Chargeback</option>
                            <option value="Pre-Arbitration">Pre-Arbitration</option>
                            <option value="Retrieval Request">Retrieval Request</option>
                            <option value="Arbitration">Arbitration</option>
                          </select>
                        </div>
                        <div style={{ height: '0px' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Search String</label>
                          <input type="text" style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="Search" value={filterRrn} onChange={(e) => setFilterRrn(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                      <button style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: 'transparent', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={resetAdminCb}>Reset</button>
                      <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={filterAdminCb}>Search</button>
                    </div>
                  </fieldset>
                )}

                <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '20px', gap: '32px' }}>
                  <div 
                    style={{ padding: '12px 0', color: adminTab === 'management' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: adminTab === 'management' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => { setAdminTab('management'); setAVcPage(1); }}
                  >Dispute Management</div>
                  <div 
                    style={{ padding: '12px 0', color: adminTab === 'merchant-pending' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: adminTab === 'merchant-pending' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => { setAdminTab('merchant-pending'); setAVcPage(1); }}
                  >Document pending from Merchant</div>
                  <div 
                    style={{ padding: '12px 0', color: adminTab === 'verification-pending' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: adminTab === 'verification-pending' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => { setAdminTab('verification-pending'); setAVcPage(1); }}
                  >Document Pending for Verification</div>
                </div>

                <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
                  <div className="tbl-wrap">
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <tr style={{ color: '#4a148c', fontSize: '11px', textAlign: 'left', background: 'transparent' }}>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Case ID</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Dispute Date</th>

                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Aggregator</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Scheme</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Dispute Type</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Merchant Name</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>MID</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>ARN</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Dispute Status</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>TXN Ref. Number</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Remaining Days</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>TID</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>{adminTab === 'verification-pending' ? 'View / Actions' : 'View'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminPaging.paginated.length > 0 ? (
                          adminPaging.paginated.map(cb => {
                            const isExpanded = expandedRowIds[cb.id];
                            return (
                              <React.Fragment key={cb.id}>
                                <tr style={{ borderBottom: '1px solid #f0f0f0', fontSize: '12px', background: 'transparent' }}>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.id.substring(0, 8).toUpperCase()}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{formatDateDisp(cb.txnDate)}</td>

                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>iServeU</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>Visa</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.mSubStatus || cb.mStatus}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.userName}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.userId}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.rrn}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{renderStatusBadge(cb.mStatus)}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.txnId}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.aging}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>TID-{cb.userId.substring(0,4)}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                      {adminTab !== 'verification-pending' && (
                                        <button 
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                                          onClick={() => { setTargetDisputeId(cb.id); setActiveModal('disputeDetails'); }}
                                          title="View Details"
                                        >
                                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#50BDC9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                            <circle cx="12" cy="12" r="3"></circle>
                                          </svg>
                                        </button>
                                      )}
                                      {adminTab === 'verification-pending' && isPendingVerification(cb) && (
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-primary"
                                          onClick={() => { setTargetDisputeId(cb.id); setActiveModal('remarks'); }}
                                        >
                                          Review
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              </React.Fragment>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan="17" style={{ textAlign: 'center', padding: '24px' }}>No records match the filter.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="tbl-footer">
                    <div className="rpp">
                      Rows per page: 
                      <select value={aVcLimit} onChange={(e) => { setAVcPage(1); setAVcLimit(parseInt(e.target.value)); }}>
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="25">25</option>
                      </select>
                    </div>
                    <div className="pagination">
                      <span style={{ marginRight: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                        {adminPaging.startRecord}–{adminPaging.endRecord} of {adminPaging.total} records
                      </span>
                      <button 
                        className="pg-btn" 
                        disabled={aVcPage === 1}
                        onClick={() => setAVcPage(aVcPage - 1)}
                      >
                        ‹
                      </button>
                      {Array.from({ length: adminPaging.totalPages }, (_, idx) => idx + 1).map(p => (
                        <button 
                          key={p} 
                          className={`pg-btn ${aVcPage === p ? 'active' : ''}`}
                          onClick={() => setAVcPage(p)}
                        >
                          {p}
                        </button>
                      ))}
                      <button 
                        className="pg-btn" 
                        disabled={aVcPage === adminPaging.totalPages}
                        onClick={() => setAVcPage(aVcPage + 1)}
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Webhook Status */}
          {activePage === 'a-webhook' && (
            <div className="page active" id="a-webhook">
              <div style={{ padding: '32px 40px', background: '#f8f9fd', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
                <div style={{ marginBottom: '32px' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#1a237e', marginBottom: '8px' }}>VISA VROL Webhook Status</h1>
                  <p style={{ color: '#78909c', fontSize: '14px', margin: 0 }}>Real-time incoming webhook gateway for integration with the Principal Acquirer from Visa Resolve on Liability (VROL) system.</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                  <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #eef2f6', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#e1f5fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#03a9f4' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#b0bec5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>TOTAL RECEIVED FEED</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#263238' }}>12 <span style={{fontSize: '16px', fontWeight: '600'}}>Events</span></div>
                    </div>
                  </div>

                  <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #eef2f6', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4caf50' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#b0bec5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>SUCCESS DELIVERIES</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#4caf50' }}>4</div>
                    </div>
                  </div>

                  <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #eef2f6', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#fff3e0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9800' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#b0bec5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>WARNING ALERTS</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#ff9800' }}>1</div>
                    </div>
                  </div>

                  <div style={{ background: '#fff', borderRadius: '8px', padding: '24px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid #eef2f6', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '8px', background: '#ffebee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f44336' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: '#b0bec5', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>FAILED DISPATCHES</div>
                      <div style={{ fontSize: '24px', fontWeight: '700', color: '#f44336' }}>1</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #eef2f6', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ padding: '20px 24px', borderBottom: '1px solid #eef2f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#455a64', margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>VROL WEBHOOK DELIVERY LOGS</h3>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      <select style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #e0e0e0', color: '#78909c', outline: 'none', fontSize: '13px' }}>
                        <option>All Types</option>
                      </select>
                      <select style={{ padding: '8px 16px', borderRadius: '4px', border: '1px solid #e0e0e0', color: '#78909c', outline: 'none', fontSize: '13px' }}>
                        <option>All Statuses</option>
                      </select>
                    </div>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#b0bec5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>WEBHOOK ID</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#b0bec5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>VROL EVENT / TIME</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#b0bec5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>DISPUTE TYPE</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#b0bec5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>MERCHANT / AMOUNT</th>
                        <th style={{ textAlign: 'left', padding: '16px 24px', fontSize: '11px', color: '#b0bec5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>RESPONSE CODE</th>
                        <th style={{ textAlign: 'right', padding: '16px 24px', fontSize: '11px', color: '#b0bec5', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>PAYLOAD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {webhookData.map((wh, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                          <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: '600', color: '#263238' }}>{wh.id}</td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#546e7a', marginBottom: '4px' }}>{wh.event}</div>
                            <div style={{ fontSize: '11px', color: '#b0bec5' }}>{wh.time}</div>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{ padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', background: wh.typeBg, color: wh.typeColor }}>{wh.typeLabel}</span>
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <div style={{ fontSize: '13px', fontWeight: '600', color: '#546e7a', marginBottom: '4px' }}>{wh.merchant}</div>
                            <div style={{ fontSize: '12px', color: '#78909c' }}>{wh.amount}</div>
                          </td>
                          <td style={{ padding: '16px 24px', fontSize: '12px', fontWeight: '700', color: wh.statusColor }}>{wh.status}</td>
                          <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                            <button onClick={() => { setTargetWebhook(wh); setActiveModal('webhookInspect'); }} style={{ padding: '6px 16px', background: '#1a237e', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                              <span>&gt;_</span> INSPECT
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}






        </main>
      </div>

      {activeModal === 'disputeDetails' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(c => c.id === targetDisputeId) || {};
            return (
              <div className="modal" style={{ width: '90%', maxWidth: '1100px', padding: '0', borderRadius: '4px', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                  <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#000' }}>{cb.id}</h2>
                  <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9e9e9e' }}>&times;</button>
                </div>
                
                <div style={{ padding: '0', overflowY: 'auto', flex: 1 }}>
                  {/* Original Transaction Details */}
                  <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                    <span>Original Transaction Details</span>
                    <span style={{ fontWeight: 'normal', color: '#757575' }}>Transaction Date & Time <span style={{color:'red'}}>*</span> : <span style={{color:'#333', fontWeight:'bold'}}>{formatDateDisp(cb.txnDate)}</span></span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                    {/* Col 1 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Case ID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.id}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>AR Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.rrn}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>RR Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.rrn}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Txn Currency <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Location <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>India</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Country <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>India</strong></div>
                    </div>
                    {/* Col 2 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Transaction Ref. Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnId}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>MID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.userId}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Card Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>457704******3989</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>City <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Zip code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                    </div>
                    {/* Col 3 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Merchant Name <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.userName}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>TID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>10515104</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Approval Code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>021838</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Address <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>State <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Request ID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                    </div>
                  </div>

                  {/* Dispute Details */}
                  <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                    <span>Dispute Details</span>
                    <span style={{ fontWeight: 'normal', color: '#757575' }}>Dispute Date <span style={{color:'red'}}>*</span> : <span style={{color:'#333', fontWeight:'bold'}}>{formatDateDisp(cb.txnDate)}</span></span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Scheme <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>VISA</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Reason Code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>13.1</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}><span style={{ color: '#9e9e9e' }}>Source Currency Code (Alpha) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Destination Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Remaining Days <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.aging}</strong></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Type <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px', textTransform: 'uppercase'}}>{cb.mSubStatus || cb.mStatus}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Description <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>13.1-Services Not Provided or Merchandise Not Received</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}><span style={{ color: '#9e9e9e' }}>Source Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Re-presentment Received Date Credit <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Amount (INR) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Current Status <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.mStatus}</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '40px' }}><span style={{ color: '#9e9e9e' }}>Destination Currency Code (Alpha) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Last Remarks <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.merchantAction || '-'}</strong></div>
                    </div>
                  </div>

                  {/* Previous Documents */}
                  <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000' }}>
                    <span>Previous Documents</span>
                    <button style={{ background: '#50BDC9', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Download All Docs</button>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', gap: '16px', overflowX: 'auto', background: '#fff' }}>
                    {cb.timeline && cb.timeline.filter(t => t.file).map((t, i) => (
                      <div key={i} style={{ width: '200px', padding: '12px', border: '2px solid #e0e0e0', borderTop: '4px solid #d1c4e9', borderRadius: '4px', flexShrink: 0, display: 'flex', flexDirection: 'column', color: '#333', background: '#fafafa' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px', wordBreak: 'break-all' }}>{t.file}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Uploaded By: {t.by}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Date: {new Date(t.time).toLocaleDateString()}</div>
                      </div>
                    ))}
                    {(!cb.timeline || cb.timeline.filter(t => t.file).length === 0) && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No previous evidence uploaded.</div>
                    )}
                  </div>
                </div>
                
                <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', flexShrink: 0, zIndex: 10, flexWrap: 'wrap', gap: '12px' }}>
                  {adminTab === 'merchant-pending' ? (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                      <button onClick={() => setActiveModal(null)} style={{ padding: '6px 16px', border: '1px solid #50BDC9', background: '#fff', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                    </div>
                  ) : adminTab === 'verification-pending' && isPendingVerification(cb) ? (
                    <>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', flex: 1 }}>
                        <button type="button" className="btn btn-sm btn-primary" onClick={() => setActiveModal('remarks')}>
                          Review Evidence
                        </button>
                        <button type="button" className="btn btn-sm btn-success" onClick={() => handleVisaAccept(cb.id)}>
                          ✓ Accept &amp; Submit to Visa
                        </button>
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeclineClick(cb.id)}>
                          ✕ Request More Info / Reject Documents
                        </button>
                        <button type="button" className="btn btn-sm" style={{ background: '#0288d1', color: '#fff' }} onClick={() => handleAdminEscalate(cb.id)}>
                          Escalate to Pre-Arb
                        </button>
                      </div>
                      <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '6px 16px', border: '1px solid #50BDC9', background: '#fff', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                    </>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {cb.visaPending && (
                          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <div style={{ padding: '8px 12px', background: '#e3f2fd', color: '#1565c0', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                              Case Submitted to Visa (Pending Final Decision)
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: '600', color: '#555' }}>[Simulator] Trigger Visa Webhook:</span>
                              <button className="btn btn-sm btn-success" onClick={async () => {
                                await fetch(`${API_URL}/disputes/${cb.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mSubStatus: 'Chargeback Won', resolution: 'Won', visaPending: false }) });
                                setActiveModal(null); refreshAllData();
                              }}>Chargeback Won</button>
                              <button className="btn btn-sm btn-danger" onClick={async () => {
                                await fetch(`${API_URL}/disputes/${cb.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mSubStatus: 'Chargeback Lost', resolution: 'Lost', visaPending: false }) });
                                setActiveModal(null); refreshAllData();
                              }}>Chargeback Lost</button>
                            </div>
                          </div>
                        )}
                        {!cb.visaPending && isPendingVerification(cb) && (
                          <>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => setActiveModal('remarks')}>
                              Review Evidence
                            </button>
                            <button type="button" className="btn btn-sm btn-success" onClick={() => handleVisaAccept(cb.id)}>
                              Accept &amp; Submit to Visa
                            </button>
                            <button type="button" className="btn btn-sm btn-danger" onClick={() => handleDeclineClick(cb.id)}>
                              Request More Info
                            </button>
                          </>
                        )}
                        {cb.mStatus.includes('Arbitration') && !cb.acquirerAction && (
                          <button type="button" className="btn btn-sm" style={{ background: 'var(--purple)', color: '#fff' }} onClick={() => { setActiveModal('arbitration'); }}>
                            Arb Decision
                          </button>
                        )}
                        {(cb.mSubStatus.includes('Won') || cb.mSubStatus.includes('Accepted')) && cb.mSubStatus !== 'Refund Success' && cb.mSubStatus !== 'Refund On Hold' && (
                          <button type="button" className="btn btn-sm btn-success" onClick={() => { setActiveModal('refund'); }}>
                            Refund
                          </button>
                        )}
                      </div>
                      <button type="button" onClick={() => setActiveModal(null)} style={{ padding: '6px 16px', border: '1px solid #50BDC9', background: '#fff', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Close</button>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Admin Review / Remarks Modal */}
      {activeModal === 'remarks' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(x => x.id === targetDisputeId);
            if (!cb) return null;
            return (
              <div className="modal">
                <div className="modal-hdr"><h3>Remarks &amp; Evidence Review</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
                <div className="modal-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>RRN</div><div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{cb.rrn}</div></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>Txn Amount</div><div style={{ fontWeight: 700 }}>{formatINR(cb.txnAmt)}</div></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>Status</div><div>{renderStatusBadge(cb.mStatus)}</div></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '3px' }}>Merchant Action</div><div style={{ fontWeight: 600 }}>{cb.merchantAction || '—'}</div></div>
                  </div>
                  {(cb.documents && cb.documents.length > 0) ? (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Submitted Documents</div>
                      {cb.documents.map((doc, idx) => (
                        <div key={doc.id || idx} className="remarks-doc" style={{ marginBottom: '8px', border: doc.status === 'Rejected' ? '1px solid #ff4d4f' : '' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>📄 {doc.filename}</span>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: doc.status === 'Rejected' ? '#ff4d4f' : doc.status === 'Accepted' ? '#52c41a' : '#faad14' }}>{doc.status}</span>
                              <button type="button" className="btn btn-sm btn-secondary" onClick={() => showToast(`Downloading ${doc.filename}...`, 'success')}>⬇ Download</button>
                            </div>
                          </div>
                          {doc.status === 'Rejected' && doc.rejectionRemarks && (
                            <div style={{ marginTop: '8px', fontSize: '12px', color: '#ff4d4f' }}>
                              <strong>Rejection Reason:</strong> {doc.rejectionRemarks}
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', marginTop: '12px' }}>Merchant Justification Remarks</div>
                      <div className="remarks-reason">
                        {cb.rejectReason || 'Merchant contested the chargeback. Pending admin review.'}
                      </div>
                    </div>
                  ) : (cb.rejectReason || cb.merchantAction === 'evidence' || cb.merchantAction === 'rejected' || cb.merchantAction === 'additional_evidence') ? (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Submitted Document</div>
                      <div className="remarks-doc">
                        <span>📄 {cb.merchantAction === 'evidence' ? 'Merchant_Evidence_Submitted.pdf' : 'Merchant_Evidence.pdf'}</span>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => showToast('Downloading Evidence File...', 'success')}>⬇ Download</button>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Merchant Justification Remarks</div>
                      <div className="remarks-reason">
                        {cb.rejectReason || (cb.merchantAction === 'evidence'
                          ? 'Merchant submitted evidence documents. Pending admin verification before representment to Visa/NPCI.'
                          : 'Merchant contested the chargeback. Pending admin review.')}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No merchant representation logs found.</div>
                  )}
                </div>
                <div className="modal-footer" style={{ justifyContent: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                  {cb.merchantAction === 'additional_evidence' ? (
                    <>
                      <button type="button" className="btn btn-primary" style={{ flex: 1, minWidth: '140px' }} onClick={() => setActiveModal('visaRuling')}>Visa Ruling</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                    </>
                  ) : isPendingVerification(cb) ? (
                    <>
                      <button type="button" className="btn btn-danger" style={{ flex: 1, minWidth: '140px' }} onClick={() => handleArbitrationLost(cb.id)}>Accept Loss (Send to Visa)</button>
                      <button type="button" className="btn btn-warning" style={{ flex: 1, minWidth: '140px', background: '#eab308', color: '#fff', border: 'none' }} onClick={() => handleDeclineClick(cb.id)}>Decline & Send to Merchant</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setActiveModal(null)}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setActiveModal(null)}>Close</button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeModal === 'visaRuling' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(x => x.id === targetDisputeId);
            if (!cb) return null;
            return (
              <div className="modal">
                <div className="modal-hdr"><h3>Visa Ruling</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
                <div className="modal-body">
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>Please select how you would like to proceed with this dispute:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button className="btn btn-success" style={{ width: '100%', padding: '12px' }} onClick={() => handleVisaAccept(cb.id)}>Accept</button>
                    <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => setActiveModal('acceptPartially')}>Accept Partially</button>
                    <button className="btn btn-warning" style={{ width: '100%', padding: '12px', background: '#eab308', color: '#fff', border: 'none' }} onClick={() => handleVisaReview(cb.id)}>Send to Visa for Review / Fight</button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setActiveModal('disputeDetails')}>Back</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeModal === 'adminUploadEvidence' && (
        <div className="overlay open">
          <div className="modal">
            <div className="modal-hdr"><h3>Upload Evidence for Merchant</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Upload evidence documents to send back to the merchant for their review and acceptance.</div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Select Document (Max 20MB, PDF/JPG/PNG)</label>
                <input type="file" className="form-control" onChange={(e) => setEvidenceFiles({ 1: e.target.files?.[0] || null })} />
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2, background: '#1890ff', color: '#fff', border: 'none' }} onClick={() => submitAdminUploadEvidence()}>Upload & Send</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'merchantRejectAdminDocs' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(x => x.id === targetDisputeId);
            if (!cb) return null;
            return (
              <div className="modal">
                <div className="modal-hdr"><h3>Reject Admin Evidence</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
                <div className="modal-body">
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>Select admin documents to reject:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {(cb.documents || []).filter(d => d.uploadedBy === 'Admin' && d.status === 'Pending Review').map(doc => (
                      <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedDocsToReject.includes(doc.id)} 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDocsToReject([...selectedDocsToReject, doc.id]);
                            else setSelectedDocsToReject(selectedDocsToReject.filter(id => id !== doc.id));
                          }}
                        />
                        📄 {doc.filename}
                      </label>
                    ))}
                  </div>
                  
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Rejection Remarks (Mandatory):</div>
                  <textarea 
                    className="mfi" 
                    placeholder="Enter reason for rejecting admin's evidence..." 
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    rows={4}
                    style={{ width: '100%', resize: 'vertical' }}
                  ></textarea>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-danger" style={{ flex: 2 }} onClick={() => submitMerchantRejectAdminDocs()}>Submit Rejection</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeModal === 'declineDocuments' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(x => x.id === targetDisputeId);
            if (!cb) return null;
            return (
              <div className="modal">
                <div className="modal-hdr"><h3>Reject Documents &amp; Request More Info</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
                <div className="modal-body">
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '10px' }}>Select documents to reject:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {(cb.documents || []).filter(d => d.status === 'Pending Review').map(doc => (
                      <label key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedDocsToReject.includes(doc.id)} 
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDocsToReject([...selectedDocsToReject, doc.id]);
                            else setSelectedDocsToReject(selectedDocsToReject.filter(id => id !== doc.id));
                          }}
                        />
                        📄 {doc.filename}
                      </label>
                    ))}
                    {(cb.documents || []).filter(d => d.status === 'Pending Review').length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No documents pending review.</div>
                    )}
                  </div>
                  
                  <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>Rejection Remarks (Mandatory):</div>
                  <textarea 
                    className="mfi" 
                    placeholder="Enter reason for rejection..." 
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    rows={4}
                    style={{ width: '100%', resize: 'vertical' }}
                  ></textarea>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveModal('remarks')}>Back</button>
                  <button className="btn btn-danger" style={{ flex: 2 }} onClick={() => submitDeclineDocs()}>Submit Rejection</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeModal === 'acceptPartially' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(x => x.id === targetDisputeId);
            if (!cb) return null;
            return (
              <div className="modal">
                <div className="modal-hdr"><h3>Accept Partially</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
                <div className="modal-body">
                  <div className="mf">
                    <label>Accepted Amount (Mandatory)</label>
                    <input type="number" className="mfi" value={visaAcceptedAmount} onChange={(e) => setVisaAcceptedAmount(e.target.value)} placeholder="e.g. 500" />
                  </div>
                  <div className="mf" style={{ marginTop: '12px' }}>
                    <label>Remarks (Mandatory)</label>
                    <textarea className="mfi mfi-area" value={visaRemarks} onChange={(e) => setVisaRemarks(e.target.value)} placeholder="Reason for partial acceptance..."></textarea>
                  </div>
                  <div className="mf" style={{ marginTop: '12px' }}>
                    <label>Evidence Upload (Mandatory)</label>
                    <input type="file" className="form-control" onChange={(e) => setVisaEvidenceFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '10px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveModal('visaRuling')}>Back</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleVisaAcceptPartially}>Submit and Send to Visa</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeModal === 'arbitration' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(x => x.id === targetDisputeId);
            if (!cb) return null;
            return (
              <div className="modal">
                <div className="modal-hdr"><h3>Arbitration Decision (NPCI)</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
                <div className="modal-body">
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '14px' }}>Select outcome based on card scheme ruling received via email:</p>
                  <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Disputed Case</div>
                    <div style={{ fontWeight: 700 }}>RRN: {cb.rrn}</div>
                    <div style={{ fontWeight: 700, marginTop: '2px' }}>Amount: {formatINR(cb.adjAmt)}</div>
                  </div>
                </div>
                <div className="modal-footer" style={{ flexWrap: 'wrap', gap: '10px' }}>
                  {!cb.visaPending ? (
                    <>
                      <button className="btn btn-primary" style={{ flex: 1, minWidth: '100%' }} onClick={() => handleVisaReview(cb.id)}>Submit to Visa</button>
                      <button className="btn btn-danger" style={{ flex: 1, minWidth: '100%' }} onClick={() => handleArbitrationLost(cb.id)}>Accept Loss & Send to Visa</button>
                      <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', margin: '8px 0' }}>
                        Note: Admin cannot decide "Won" status. Final "Won" resolution will be provided by Visa.
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '100%', textAlign: 'center', color: '#1565c0', fontSize: '13px', fontWeight: 'bold', margin: '8px 0' }}>
                        Case Submitted to Visa (Pending Final Decision)
                      </div>
                      <div style={{ width: '100%', borderTop: '1px solid #eee', paddingTop: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: '#555', marginBottom: '8px', textAlign: 'center' }}>[Simulator] Trigger Visa Webhook:</div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-sm btn-success" style={{ flex: 1 }} onClick={async () => {
                            await fetch(`${API_URL}/disputes/${cb.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mSubStatus: 'Chargeback Won', resolution: 'Won', visaPending: false }) });
                            setActiveModal(null); refreshAllData();
                          }}>Chargeback Won</button>
                          <button className="btn btn-sm btn-danger" style={{ flex: 1 }} onClick={async () => {
                            await fetch(`${API_URL}/disputes/${cb.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mSubStatus: 'Chargeback Lost', resolution: 'Lost', visaPending: false }) });
                            setActiveModal(null); refreshAllData();
                          }}>Chargeback Lost</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeModal === 'refund' && (
        <div className="overlay open">
          {(() => {
            const cb = chargebacks.find(x => x.id === targetDisputeId);
            if (!cb) return null;
            return (
              <div className="modal">
                <div className="modal-hdr"><h3>Acquiring Refund Processing</h3><button className="modal-close" onClick={() => setActiveModal(null)}>✕</button></div>
                <div className="modal-body">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>RRN</div><div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{cb.rrn}</div></div>
                    <div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Dispute Amt</div><div style={{ fontWeight: 700 }}>{formatINR(cb.txnAmt)}</div></div>
                  </div>
                  <div className="lein-highlight"><span>⚠️</span><span>Pre-checks passed: Merchant Wallet Debit capability, Hold Cleared</span></div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={handleRefundAccept}>Accept Refund (Debit Merchant)</button>
                  <button className="btn btn-warning" style={{ flex: 1, background: '#ca8a04', color: '#fff' }} onClick={handleRefundHold}>Place Refund On Hold</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {activeModal === 'webhookInspect' && targetWebhook && (
        <div className="overlay open">
          <div className="modal" style={{ width: '90%', maxWidth: '800px', padding: '0', borderRadius: '4px', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: '#f8f9fa' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#000' }}>Webhook Inspect: {targetWebhook.id}</h2>
              <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9e9e9e' }}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#78909c', textTransform: 'uppercase', marginBottom: '4px' }}>Event</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#263238' }}>{targetWebhook.event}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#78909c', textTransform: 'uppercase', marginBottom: '4px' }}>Time</div>
                  <div style={{ fontSize: '13px', color: '#546e7a' }}>{targetWebhook.time}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#78909c', textTransform: 'uppercase', marginBottom: '4px' }}>Merchant</div>
                  <div style={{ fontSize: '13px', color: '#546e7a' }}>{targetWebhook.merchant}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#78909c', textTransform: 'uppercase', marginBottom: '4px' }}>Status</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#4caf50' }}>{targetWebhook.status}</div>
                </div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#263238', marginBottom: '8px' }}>Request Payload</div>
              <pre style={{ background: '#263238', color: '#eceff1', padding: '16px', borderRadius: '4px', fontSize: '12px', overflowX: 'auto', marginBottom: '20px', fontFamily: 'monospace' }}>
{JSON.stringify({
  eventId: targetWebhook.id,
  eventType: targetWebhook.event,
  timestamp: targetWebhook.time,
  data: {
    merchantId: "M_" + targetWebhook.merchant.replace(" ", "").toUpperCase(),
    amount: targetWebhook.amount,
    currency: "INR",
    disputeType: targetWebhook.typeLabel
  }
}, null, 2)}
              </pre>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#263238', marginBottom: '8px' }}>Response Payload</div>
              <pre style={{ background: '#f5f5f5', color: '#333', padding: '16px', borderRadius: '4px', fontSize: '12px', overflowX: 'auto', border: '1px solid #e0e0e0', fontFamily: 'monospace' }}>
{JSON.stringify({
  status: "success",
  code: parseInt(targetWebhook.status) || 200,
  message: "Webhook processed successfully",
  processedAt: new Date().toISOString()
}, null, 2)}
              </pre>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#fff', flexShrink: 0 }}>
              <button onClick={() => setActiveModal(null)} style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: '#fff', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function daysAgoFmt(n) {
    let d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0];
  }
}

// ═════════════════════════════════════════════
// PARTNER PORTAL
// ═════════════════════════════════════════════
function PartnerPortal({
  currentUser, users, chargebacks, setView, toggleTheme, darkMode, formatINR, formatDateDisp, showToast, refreshAllData, resetAllSessions, handleLogout
}) {
  const [activePage, setActivePage] = useState('p-dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const TODAY_STR = new Date().toISOString().split('T')[0];
  const DEFAULT_FROM = (() => { let d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
  const [filterFrom, setFilterFrom] = useState(DEFAULT_FROM);
  const [filterTo, setFilterTo] = useState(TODAY_STR);
  const [dashDateRangeType, setDashDateRangeType] = useState('7days');
  const [dashFilterFrom, setDashFilterFrom] = useState(() => { let d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [dashFilterTo, setDashFilterTo] = useState(TODAY_STR);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScheme, setFilterScheme] = useState('');
  const [filterDisputeType, setFilterDisputeType] = useState('');
  const [filterSearchBy, setFilterSearchBy] = useState('');
  const [filterSearchText, setFilterSearchText] = useState('');

  const [activeTab, setActiveTab] = useState('dispute-mgmt');
  const [activeModal, setActiveModal] = useState(null);
  const [targetDisputeId, setTargetDisputeId] = useState(null);
  const [targetUserId, setTargetUserId] = useState(null);
  const [merchantSearch, setMerchantSearch] = useState('');

  // Partner sees all disputes (they represent all merchants)
  const allDisputes = chargebacks;
  const visaDisputes = allDisputes.filter(cb => cb.visaPending);
  const evidenceDisputes = allDisputes.filter(cb => cb.merchantAction === 'evidence');

  const filteredDisputes = allDisputes.filter(cb => {
    if (filterSearchText) {
      const q = filterSearchText.toLowerCase();
      if (filterSearchBy === 'Txn ID' && !cb.txnId?.toLowerCase().includes(q)) return false;
      if (filterSearchBy === 'RRN' && !cb.rrn?.toLowerCase().includes(q)) return false;
      if (filterSearchBy === 'TID' && !cb.tid?.toLowerCase().includes(q)) return false;
      if (filterSearchBy === 'MID' && !cb.userId?.toLowerCase().includes(q)) return false;
      if (filterSearchBy === 'Case ID' && !cb.caseId?.toLowerCase().includes(q) && !cb.id?.toLowerCase().includes(q)) return false;
      if (!filterSearchBy && !cb.rrn?.toLowerCase().includes(q) && !cb.txnId?.toLowerCase().includes(q) && !cb.userId?.toLowerCase().includes(q) && !cb.id?.toLowerCase().includes(q)) return false;
    }
    if (filterStatus && cb.mStatus !== filterStatus) return false;
    if (filterDisputeType && cb.mSubStatus !== filterDisputeType) return false;
    if (filterFrom && cb.createdDate && cb.createdDate < filterFrom) return false;
    if (filterTo && cb.createdDate && cb.createdDate > filterTo) return false;
    return true;
  });

  const totalAmt = allDisputes.reduce((s, c) => s + c.txnAmt, 0);
  const wonAmt = allDisputes.filter(c => c.mSubStatus.includes('Won') || c.mSubStatus.includes('Success')).reduce((s, c) => s + c.txnAmt, 0);
  const lostAmt = allDisputes.filter(c => c.mSubStatus.includes('Lost')).reduce((s, c) => s + c.txnAmt, 0);

  const renderStatusBadge = (s) => {
    const m = { 'Chargeback Raise': 'badge-cb', 'Pre-Arbitration Raise': 'badge-prearb', 'Arbitration Raise': 'badge-arb', 'Fraud Chargeback Raise': 'badge-fraud', 'Differed Chargeback Raise': 'badge-deferred', 'VROL Inquiry': 'badge-pending', 'VROL Chargeback': 'badge-cb', 'VROL Pre-Arbitration': 'badge-prearb', 'VROL Arbitration': 'badge-arb' };
    return <span className={`badge ${m[s] || 'badge-new'}`}>{s}</span>;
  };
  const renderSubBadge = (s) => {
    const m = { 'Chargeback New': 'badge-new', 'Chargeback Lost': 'badge-lost', 'Chargeback in Progress': 'badge-progress', 'Chargeback Resubmit': 'badge-resubmit', 'Chargeback Won': 'badge-won', 'Refund Success': 'badge-won', 'Refund On Hold': 'badge-progress' };
    return <span className={`badge ${m[s] || 'badge-pending'}`}>{s}</span>;
  };

  return (
    <div className="app" id="partnerApp">
      <header className="app-header">
        <button className="hdr-hamburger" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>☰</button>
        <div className="hdr-logo"><div className="hl-text">iServeU<sup>®</sup></div></div>
        <span className="partner-badge">PARTNER</span>
        <div className="hdr-space"></div>
        <button className="theme-toggle-btn" onClick={toggleTheme}>{darkMode ? '☀️' : '🌙'}</button>
        <button className="hdr-bell">🔔<span className="notif-dot"></span></button>
        <div 
          className="hdr-user" 
          title={currentUser.name}
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          style={{ position: 'relative', cursor: 'pointer' }}
        >
          <div className="avatar" style={{ background: '#7c3aed' }}>AM</div>
          <div>
            <div className="hdr-uname">{currentUser.name}</div>
            <div className="hdr-urole">Partner</div>
          </div>
          {profileMenuOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', background: 'var(--bg-card, #fff)', border: '1px solid var(--border-color, #ddd)', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 1000, minWidth: '160px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', color: 'var(--text-main, #333)', fontSize: '13px', cursor: 'pointer', borderBottom: '1px solid var(--border-color, #eee)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background='var(--bg-body, #f9f9f9)'} onMouseLeave={(e) => e.target.style.background='transparent'} onClick={(e) => { e.stopPropagation(); showToast('Change password functionality not implemented'); setProfileMenuOpen(false); }}>Change Password</div>
              <div style={{ padding: '12px 16px', color: 'var(--red, #d32f2f)', fontSize: '13px', cursor: 'pointer', transition: 'background 0.2s' }} onMouseEnter={(e) => e.target.style.background='var(--bg-body, #f9f9f9)'} onMouseLeave={(e) => e.target.style.background='transparent'} onClick={(e) => { e.stopPropagation(); handleLogout(); }}>Logout</div>
            </div>
          )}
        </div>
      </header>

      <div className="app-body">
        <nav className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sb-welcome">Welcome, Partner</div>
          <div className="sb-section">
            <div className={`sb-item ${activePage === 'p-dashboard' ? 'active' : ''}`} onClick={() => setActivePage('p-dashboard')}>
              <span className="si">⊞</span> Portfolio Analytics
            </div>

            <div className={`sb-item ${activePage === 'p-merchants' ? 'active' : ''}`} onClick={() => setActivePage('p-merchants')}>
              <span className="si">👥</span> Merchant Details
            </div>

          </div>
        </nav>

        <main className="main">
          {/* Partner Dashboard */}
          {activePage === 'p-dashboard' && (
            <div className="page active">
              <div className="page-inner">
                <div className="welcome-bar">
                  <div>
                    <div className="wb-title">Welcome, Partner Dashboard 🤝</div>
                    <div className="wb-sub">Monitor dispute submissions on behalf of your merchants</div>
                  </div>
                  <div className="wb-date">{new Date().toLocaleDateString('en-IN')}</div>
                </div>

                <div className="stats-grid">
                  <div className="stat-card received">
                    <div className="stat-icon">📥</div>
                    <div className="stat-content">
                      <div className="stat-val">{formatINR(totalAmt)}</div>
                      <div className="stat-lbl">Total Disputes</div>
                      <div className="stat-meta-row"><span className="stat-cnt">{allDisputes.length} cases</span></div>
                    </div>
                  </div>
                  <div className="stat-card open">
                    <div className="stat-icon">📋</div>
                    <div className="stat-content">
                      <div className="stat-val">{evidenceDisputes.length}</div>
                      <div className="stat-lbl">Evidence Submitted</div>
                      <div className="stat-meta-row"><span className="stat-cnt">Acquirer review</span></div>
                    </div>
                  </div>
                  <div className="stat-card won">
                    <div className="stat-icon">✅</div>
                    <div className="stat-content">
                      <div className="stat-val">{formatINR(wonAmt)}</div>
                      <div className="stat-lbl">Won Disputes</div>
                      <div className="stat-meta-row"><span className="stat-cnt">{allDisputes.filter(c => c.mSubStatus.includes('Won') || c.mSubStatus.includes('Success')).length} cases</span></div>
                    </div>
                  </div>
                  <div className="stat-card lost">
                    <div className="stat-icon">🌐</div>
                    <div className="stat-content">
                      <div className="stat-val">{visaDisputes.length}</div>
                      <div className="stat-lbl">Visa Escalations</div>
                      <div className="stat-meta-row"><span className="stat-cnt">Pending Visa review</span></div>
                    </div>
                  </div>
                </div>

                <div className="tbl-card">
                  <div className="tbl-toolbar">
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>Recent Dispute Activity</span>
                    <div className="tbl-space"></div>
                    <button className="btn btn-outline btn-sm" onClick={() => setActivePage('p-disputes')}>View All →</button>
                  </div>
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Case ID</th><th>RRN</th><th>Merchant</th><th>Scheme</th>
                          <th>Status</th><th>Sub Status</th><th>Amount</th><th>Date</th><th>Visa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allDisputes.slice(0, 6).map(cb => (
                          <tr key={cb.id}>
                            <td className="mono" style={{ fontSize: '11px' }}>{cb.caseId}</td>
                            <td className="mono">{cb.rrn}</td>
                            <td>{cb.userName}</td>
                            <td><span className="badge badge-new">{cb.product}</span></td>
                            <td>{renderStatusBadge(cb.mStatus)}</td>
                            <td>{renderSubBadge(cb.mSubStatus)}</td>
                            <td><strong>{formatINR(cb.txnAmt)}</strong></td>
                            <td>{formatDateDisp(cb.createdDate)}</td>
                            <td>{cb.visaPending ? <span className="badge badge-visa">🌐 Visa</span> : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Partner Dispute Reports — matching image design */}
          {activePage === 'p-disputes' && (
            <div className="page active">
              <div className="page-inner">
                <div className="page-hdr">
                  <div><h1>Dispute Reports</h1><p>Search and track all disputes across all merchants</p></div>
                </div>

                <div className="search-panel">
                  <div className="search-panel-title">🔍 Search — Dispute Management</div>
                  <div className="search-panel-grid">
                    <div className="sp-field">
                      <label>📅 From Date</label>
                      <input type="date" className="sp-input" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                    </div>
                    <div className="sp-field">
                      <label>📅 To Date</label>
                      <input type="date" className="sp-input" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                    </div>
                    <div className="sp-field">
                      <label>Dispute Type</label>
                      <select className="sp-input" value={filterDisputeType} onChange={(e) => setFilterDisputeType(e.target.value)}>
                        <option value="">Dispute Type</option>
                        <option value="Chargeback">Chargeback</option>
                        <option value="Pre-Arbitration">Pre-Arbitration</option>
                        <option value="Retrieval Request">Retrieval Request</option>
                        <option value="Arbitration">Arbitration</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Aggregator</label>
                      <select className="sp-input" value={filterScheme} onChange={(e) => setFilterScheme(e.target.value)}>
                        <option value="ISU">ISU</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Scheme</label>
                      <select className="sp-input" value={filterScheme} onChange={(e) => setFilterScheme(e.target.value)}>
                        <option value="Visa">Visa</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Dispute Status</label>
                      <select className="sp-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">Dispute Status</option>
                        <option value="Dispute Won Partially">Dispute Won Partially</option>
                        <option value="Dispute Won Fully">Dispute Won Fully</option>
                        <option value="Dispute Lost – TAT Expired">Dispute Lost – TAT Expired</option>
                        <option value="Dispute Lost – Accepted">Dispute Lost – Accepted</option>
                        <option value="Document Rejected">Document Rejected</option>
                        <option value="Document Pending Verification">Document Pending Verification</option>
                        <option value="Document Pending from Merchant">Document Pending from Merchant</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input" value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                        <option value="">Search By</option>
                        <option value="Txn ID">Transaction ID (Txn ID)</option>
                        <option value="RRN">RRN</option>
                        <option value="TID">TID</option>
                        <option value="MID">MID</option>
                        <option value="Case ID">Case ID</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Search</label>
                      <input type="text" className="sp-input" placeholder="Search..." value={filterSearchText} onChange={(e) => setFilterSearchText(e.target.value)} />
                    </div>
                    <div className="sp-field" style={{ visibility: 'hidden' }}></div>
                  </div>
                  <div className="search-panel-actions">
                    <button className="btn btn-secondary" onClick={() => { setFilterFrom(DEFAULT_FROM); setFilterTo(TODAY_STR); setFilterStatus(''); setFilterScheme(''); setFilterDisputeType(''); setFilterSearchBy(''); setFilterSearchText(''); }}>Reset</button>
                    <button className="btn btn-primary" onClick={() => showToast('Disputes filtered!')}>Search</button>
                    <table>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Case ID</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>RR Number</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Transaction Date & Time</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Dispute Date</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Txn Currency</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Amount</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Current Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>TAT</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDisputes.map(cb => (
                          <tr key={cb.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px 16px', color: '#50BDC9', fontWeight: '600' }}>{cb.caseId}</td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.txnDate)}</td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.createdDate)}</td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>INR</td>
                            <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{cb.txnAmt}</td>
                            <td style={{ padding: '12px 16px', color: '#333' }}>{cb.mStatus}</td>
                            <td style={{ padding: '12px 16px' }}>
                              <span style={{ color: cb.aging > 5 ? 'var(--red)' : 'var(--yellow)', fontWeight: '600' }}>
                                {cb.aging}d
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#50BDC9', fontSize: '16px' }} onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>
                                👁
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Partner Visa Escalations */}
          {activePage === 'p-visa' && (
            <div className="page active">
              <div className="page-inner">
                <div className="page-hdr">
                  <div><h1>🌐 Visa Escalations</h1><p>Disputes forwarded to Visa by acquirer on behalf of partner</p></div>
                </div>
                <div className="tbl-card">
                  <div className="tbl-toolbar">
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>Pending Visa Escalations</span>
                    <div className="tbl-space"></div>
                    <span style={{ color: 'var(--brand)', fontWeight: '700', fontSize: '13px' }}>{visaDisputes.length} pending</span>
                  </div>
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Case ID</th><th>RRN</th><th>Merchant</th><th>Scheme</th>
                          <th>Status</th><th>Amount</th><th>Date</th><th>Visa Status</th><th>Timeline</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visaDisputes.length > 0 ? visaDisputes.map(cb => (
                          <tr key={cb.id}>
                            <td className="mono" style={{ fontSize: '11px' }}>{cb.caseId}</td>
                            <td className="mono">{cb.rrn}</td>
                            <td>{cb.userName}</td>
                            <td><span className="badge badge-new">{cb.product}</span></td>
                            <td>{renderSubBadge(cb.mSubStatus)}</td>
                            <td><strong>{formatINR(cb.txnAmt)}</strong></td>
                            <td>{formatDateDisp(cb.createdDate)}</td>
                            <td><span className="badge badge-visa">🌐 Pending Visa Review</span></td>
                            <td>
                              <button className="btn btn-sm btn-secondary" onClick={() => showToast(`Timeline: ${cb.timeline?.length || 0} entries for ${cb.rrn}`, 'warning')}>
                                View Audit
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                              <div style={{ fontSize: '36px', marginBottom: '8px' }}>🌐</div>
                              <div>No disputes currently pending Visa review</div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {visaDisputes.length > 0 && (
                  <div style={{ marginTop: '20px', padding: '16px', background: 'var(--brand-pale)', border: '1px solid var(--brand-border)', borderRadius: 'var(--radius-lg)', fontSize: '13px', color: 'var(--brand-dark)' }}>
                    <strong>ℹ️ Partner Information:</strong> When a merchant submits evidence to the acquirer on behalf of the partner, it is automatically flagged for Visa review. Visa will adjudicate based on scheme rules and notify the acquirer with the ruling.
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Merchant Details */}
          {activePage === 'p-merchants' && (
            <div className="page active">
              <div className="page-inner">
                <h3 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px' }}>Merchant Details</h3>
                <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                  <input type="text" className="sp-input" placeholder="Search by Merchant Name or MID..." value={merchantSearch} onChange={(e) => setMerchantSearch(e.target.value)} style={{ maxWidth: '300px' }} />
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead><tr><th>Merchant Name</th><th>MID</th><th>TID</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {users && users.filter(u => u.role === 'merchant' && (!merchantSearch || u.name.toLowerCase().includes(merchantSearch.toLowerCase()) || u.id.toLowerCase().includes(merchantSearch.toLowerCase()))).map(m => (
                        <tr key={m.id}>
                          <td style={{ fontWeight: '600' }}>{m.name}</td>
                          <td className="mono" style={{ fontSize: '11px' }}>{m.id}</td>
                          <td className="mono" style={{ fontSize: '11px' }}>{m.tid || '10515104'}</td>
                          <td>
                            <span className="badge badge-won">Active</span>
                          </td>
                          <td>
                            <button className="btn btn-sm btn-outline" onClick={() => { setTargetUserId(m.id); setActiveModal('merchantDetails'); }}>View</button>
                          </td>
                        </tr>
                      ))}
                      {(!users || users.filter(u => u.role === 'merchant' && (!merchantSearch || u.name.toLowerCase().includes(merchantSearch.toLowerCase()) || u.id.toLowerCase().includes(merchantSearch.toLowerCase()))).length === 0) && (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No merchants found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}


          {/* Partner Dispute Details Modal */}
          {activeModal === 'disputeDetails' && (
            <div className="overlay open">
              {(() => {
                const cb = chargebacks.find(c => c.id === targetDisputeId) || {};
                return (
                  <div className="modal" style={{ width: '90%', maxWidth: '1100px', padding: '0', borderRadius: '4px', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#000' }}>{cb.id}</h2>
                      <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9e9e9e' }}>&times;</button>
                    </div>
                    
                    <div style={{ padding: '0', overflowY: 'auto', flex: 1 }}>
                      {/* Original Transaction Details */}
                      <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                        <span>Original Transaction Details</span>
                        <span style={{ fontWeight: 'normal', color: '#757575' }}>Transaction Date & Time <span style={{color:'red'}}>*</span> : <span style={{color:'#333', fontWeight:'bold'}}>{formatDateDisp(cb.txnDate)}</span></span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Case ID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.id}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>AR Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.rrn}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>RR Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.rrn}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Txn Currency <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Location <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>India</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Country <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>India</strong></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Transaction Ref. Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnId}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>MID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.userId}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Card Number <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>457704******3989</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>City <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Zip code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Merchant Name <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.userName}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>TID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>10515104</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Approval Code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>021838</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Address <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>State <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Request ID <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                        </div>
                      </div>
                      
                      {/* Dispute Details */}
                      <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', color: '#000' }}>
                        <span>Dispute Details</span>
                        <span style={{ fontWeight: 'normal', color: '#757575' }}>Dispute Date <span style={{color:'red'}}>*</span> : <span style={{color:'#333', fontWeight:'bold'}}>{formatDateDisp(cb.txnDate)}</span></span>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Scheme <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.product || 'VISA'}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Reason Code <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.reasonCode || '13.1'}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}><span style={{ color: '#9e9e9e' }}>Source Currency Code (Alpha) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Destination Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Remaining Days <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.aging}</strong></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Type <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px', textTransform: 'uppercase'}}>{cb.mSubStatus || cb.mStatus}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Description <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>13.1-Services Not Provided or Merchandise Not Received</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}><span style={{ color: '#9e9e9e' }}>Source Amount <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Re-presentment Received Date Credit <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>-</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Dispute Amount (INR) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.txnAmt}</strong></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Current Status <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.mStatus}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '40px' }}><span style={{ color: '#9e9e9e' }}>Destination Currency Code (Alpha) <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>INR</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Last Remarks <span style={{color:'red'}}>*</span> :</span> <strong style={{color: '#000', width: '140px'}}>{cb.merchantAction || '-'}</strong></div>
                        </div>
                      </div>
                      
                      {/* Previous Documents */}
                      <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#000' }}>
                        <span>Previous Documents</span>
                        <button style={{ background: '#50BDC9', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }} onClick={() => showToast('Documents downloaded', 'success')}>Download All Docs</button>
                      </div>
                      
                      <div style={{ padding: '20px', display: 'flex', gap: '16px', overflowX: 'auto', background: '#fff' }}>
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} style={{ width: '120px', height: '80px', border: '2px solid #e0e0e0', borderTop: '4px solid #d1c4e9', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d1c4e9', background: '#fafafa' }}>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#fff', flexShrink: 0 }}>
                      <button onClick={() => setActiveModal(null)} style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: '#fff', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Close</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Partner Merchant Details Modal */}
          {activeModal === 'merchantDetails' && (
            <div className="overlay open">
              {(() => {
                const user = users?.find(c => c.id === targetUserId) || {};
                return (
                  <div className="modal" style={{ width: '90%', maxWidth: '800px', padding: '0', borderRadius: '4px', overflow: 'hidden', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <h2 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0, color: '#000' }}>{user.name} - Details</h2>
                      <button onClick={() => setActiveModal(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#9e9e9e' }}>&times;</button>
                    </div>
                    
                    <div style={{ padding: '0', overflowY: 'auto', flex: 1 }}>
                      <div style={{ padding: '12px 20px', background: '#fff', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', color: '#000' }}>
                        Merchant Profile
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Merchant Name:</span> <strong style={{color: '#000', width: '180px'}}>{user.name}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>MID:</span> <strong style={{color: '#000', width: '180px'}}>{user.id}</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>TID:</span> <strong style={{color: '#000', width: '180px'}}>{user.tid || '10515104'}</strong></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Status:</span> <strong style={{color: '#000', width: '180px'}}>Active</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Role:</span> <strong style={{color: '#000', width: '180px'}}>Merchant</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Onboarding Date:</span> <strong style={{color: '#000', width: '180px'}}>2023-01-15</strong></div>
                        </div>
                      </div>

                      <div style={{ padding: '12px 20px', background: '#fff', borderTop: '1px solid #eee', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '13px', color: '#000' }}>
                        Business Information
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '20px', fontSize: '12px', background: '#fff' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Business Type:</span> <strong style={{color: '#000', width: '180px'}}>E-Commerce</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Contact Email:</span> <strong style={{color: '#000', width: '180px'}}>admin@{user.id?.toLowerCase()}.com</strong></div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Contact Phone:</span> <strong style={{color: '#000', width: '180px'}}>+91 98765 43210</strong></div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><span style={{ color: '#9e9e9e' }}>Address:</span> <strong style={{color: '#000', width: '180px'}}>Mumbai, India</strong></div>
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ padding: '12px 20px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', background: '#fff', flexShrink: 0 }}>
                      <button onClick={() => setActiveModal(null)} style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: '#fff', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>Close</button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════
// NATIVE CHART COMPONENTS
// ═════════════════════════════════════════════

function DonutChart({ dataSegments, darkMode }) {
  const total = dataSegments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500', textAlign: 'center', width: '100%' }}>No data matches reports filter</div>;
  }

  const r = 50;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * r;

  const getStrokeOffset = (index) => {
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const seg = dataSegments[i];
      if (seg.value > 0) {
        const percentage = seg.value / total;
        const dashArray = percentage * circumference;
        offset -= dashArray;
      }
    }
    return offset;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      <svg width="180" height="160" viewBox="0 0 160 160" style={{ overflow: 'visible' }}>
        {dataSegments.map((segment, idx) => {
          if (segment.value === 0) return null;
          const percentage = segment.value / total;
          const dashArray = percentage * circumference;
          const strokeDash = `${dashArray} ${circumference}`;
          const strokeOffset = getStrokeOffset(idx);

          return (
            <circle 
              key={idx}
              cx={cx} 
              cy={cy} 
              r={r} 
              fill="transparent" 
              stroke={segment.color} 
              strokeWidth="20" 
              strokeDasharray={strokeDash} 
              strokeDashoffset={strokeOffset} 
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
          );
        })}
        <circle cx={cx} cy={cy} r={r - 10} fill={darkMode ? '#121220' : '#ffffff'} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--text)">Total</text>
        <text x={cx} y={cy + 20} textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--brand)">{total}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginLeft: '20px', textAlign: 'left' }}>
        {dataSegments.map((segment, idx) => {
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }} key={idx}>
              <span style={{ width: '12px', height: '12px', background: segment.color, borderRadius: '3px', display: 'inline-block' }}></span>
              <span style={{ fontWeight: '500', color: 'var(--text)' }}>{segment.label}:</span>
              <span style={{ color: 'var(--text-muted)' }}>{segment.value} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarChart({ providerData }) {
  const maxVal = Math.max(...providerData.map(d => d.value), 1);
  const chartHeight = 150;
  const chartWidth = 260;
  const barWidth = 36;
  const gap = 20;

  return (
    <svg width={chartWidth} height={chartHeight + 40} viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`}>
      <line x1="15" y1={chartHeight + 10} x2={chartWidth - 15} y2={chartHeight + 10} stroke="var(--border)" strokeWidth="1.5"></line>
      {providerData.map((item, index) => {
        const barHeight = (item.value / maxVal) * chartHeight;
        const x = 30 + index * (barWidth + gap);
        const y = chartHeight - barHeight + 10;

        return (
          <g key={index}>
            <rect 
              x={x} 
              y={y} 
              width={barWidth} 
              height={barHeight} 
              fill={item.color} 
              rx="4" 
              style={{ transition: 'height 0.5s ease, y 0.5s ease' }}
            >
              <title>{item.label}: {item.value}</title>
            </rect>
            <text x={x + barWidth/2} y={y - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text)">
              {item.value}
            </text>
            <text x={x + barWidth/2} y={chartHeight + 26} textAnchor="middle" fontSize="11" fontWeight="500" fill="var(--text-muted)">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
