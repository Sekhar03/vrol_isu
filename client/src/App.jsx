import React, { useState, useEffect, useCallback } from 'react';

// API BASE URL
const API_URL = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  // Navigation: 'selector' | 'merchant' | 'admin' | 'partner'
  const [view, setView] = useState('selector');
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('isu_dark_mode') === 'true');
  
  // Shared States (synchronized with Express + MongoDB)
  const [users, setUsers] = useState([]);
  const [chargebacks, setChargebacks] = useState([]);
  const [ledger, setLedger] = useState([]);
  
  // Active User State
  const [currentUser, setCurrentUser] = useState(null);
  
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

  // TAT Auto-Accept: scan disputes where admin review is pending and aging >= 3 days
  const tatAutoAccept = useCallback(async (disputes) => {
    const expired = disputes.filter(cb =>
      cb.merchantAction === 'rejected' &&
      cb.adminAction === null &&
      cb.aging >= 3
    );
    for (const cb of expired) {
      try {
        const entry = {
          by: 'system-auto',
          time: new Date().toLocaleString(),
          title: 'TAT Expired — Auto-Accepted & Pushed to Visa',
          remarks: `TAT of ${cb.aging} days exceeded. System auto-accepted and escalated to Visa for review.`,
          file: null
        };
        await fetch(`${API_URL}/disputes/${cb.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adminAction: 'auto-accepted',
            mSubStatus: 'Chargeback Won',
            visaPending: true,
            timelineEntry: entry
          })
        });
      } catch (e) { console.warn('TAT auto-accept failed for', cb.id); }
    }
    if (expired.length > 0) {
      showToast(`TAT expired: ${expired.length} dispute(s) auto-accepted → Visa`, 'warning');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAllData = useCallback(async () => {
    try {
      const resUsers = await fetch(`${API_URL}/users`);
      const dataUsers = await resUsers.json();
      setUsers(dataUsers);

      const resDisputes = await fetch(`${API_URL}/disputes`);
      const dataDisputes = await resDisputes.json();
      setChargebacks(dataDisputes);

      // TAT auto-accept check
      await tatAutoAccept(dataDisputes);

      const resLedger = await fetch(`${API_URL}/ledger`);
      const dataLedger = await resLedger.json();
      setLedger(dataLedger);

      // Keep current user session synced with updated database balance
      if (currentUser) {
        const found = dataUsers.find(u => u.username === currentUser.username);
        if (found) {
          setCurrentUser(prev => prev ? ({ ...prev, walletBalance: found.walletBalance }) : null);
        }
      }
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }, [currentUser, tatAutoAccept]);

  // Seed and fetch data on launch
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Seed database if empty
        await fetch(`${API_URL}/users/seed`, { method: 'POST' });
        
        // Load initial state
        await refreshAllData();
      } catch (err) {
        console.error("Initialization failed:", err);
      }
    };
    bootstrap();
  }, [refreshAllData]);

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

  const loginAs = (role) => {
    if (role === 'merchant') {
      const u = users.find(x => x.username === 'masteruser');
      if (u) {
        setCurrentUser(u);
        setView('merchant');
        showToast('Logged in as masteruser (Merchant)');
      }
    } else if (role === 'partner') {
      const u = users.find(x => x.username === 'partneruser');
      if (u) {
        setCurrentUser(u);
        setView('partner');
        showToast('Logged in as Arjun Mehta (Partner)');
      } else {
        // Fallback if not seeded yet
        setCurrentUser({ username: 'partneruser', name: 'Arjun Mehta (Partner)', role: 'partner', walletBalance: 0 });
        setView('partner');
        showToast('Logged in as Partner');
      }
    } else {
      const u = users.find(x => x.username === 'Test@Ad');
      if (u) {
        setCurrentUser(u);
        setView('admin');
        showToast('Logged in as Krishna Das (Admin)');
      }
    }
  };

  const resetAllSessions = async () => {
    if (confirm('Are you sure you want to reset MongoDB collections? (This seeds database back to defaults)')) {
      try {
        localStorage.removeItem('isu_session');
        setView('selector');
        location.reload();
      } catch (err) {
        console.error("Reset error:", err);
        showToast('Failed to reset', 'error');
      }
    }
  };

  return (
    <>
      {view === 'selector' && (
        <PortalSelector loginAs={loginAs} toggleTheme={toggleTheme} darkMode={darkMode} />
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
        />
      )}

      {view === 'partner' && currentUser && (
        <PartnerPortal 
          currentUser={currentUser} 
          chargebacks={chargebacks}
          setView={setView} 
          toggleTheme={toggleTheme} 
          darkMode={darkMode}
          formatINR={formatINR}
          formatDateDisp={formatDateDisp}
          showToast={showToast}
          refreshAllData={refreshAllData}
          resetAllSessions={resetAllSessions}
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
function PortalSelector({ loginAs, toggleTheme, darkMode }) {
  return (
    <div className="portal-selector-container">
      <div className="portal-selector-card" style={{ position: 'relative' }}>
        <button 
          className="theme-toggle-btn" 
          onClick={toggleTheme} 
          style={{ position: 'absolute', top: '20px', right: '20px', color: '#fff', background: 'rgba(255,255,255,0.1)' }}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <div className="portal-selector-logo">iServeU<span>®</span></div>
        <p className="portal-selector-subtitle">Chargeback &amp; Dispute Resolution Management Platform</p>
        <div className="portal-choices">
          <div className="portal-choice" onClick={() => loginAs('merchant')}>
            <div className="portal-choice-icon">🌐</div>
            <div className="portal-choice-title">Merchant Portal</div>
            <p className="portal-choice-desc">Represent payment claims, submit delivery evidences, track deadlines, and review analytics dashboards.</p>
            <span className="portal-choice-meta">Auto Login: masteruser</span>
          </div>
          <div className="portal-choice" onClick={() => loginAs('partner')}>
            <div className="portal-choice-icon">🤝</div>
            <div className="portal-choice-title">Partner Portal</div>
            <p className="portal-choice-desc">Track merchant dispute submissions on your behalf, review evidence status, and monitor Visa escalations.</p>
            <span className="portal-choice-meta">Auto Login: partneruser</span>
          </div>
          <div className="portal-choice" onClick={() => loginAs('admin')}>
            <div className="portal-choice-icon">💼</div>
            <div className="portal-choice-title">Admin Dashboard</div>
            <p className="portal-choice-desc">Review merchant representations, raise new chargebacks (bulk CSV uploader), process adjustments, and NPCI arbitration.</p>
            <span className="portal-choice-meta">Auto Login: Krishna Das</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════
// MERCHANT DASHBOARD PORTAL
// ═════════════════════════════════════════════
function MerchantPortal({
  currentUser, chargebacks, setView, toggleTheme, darkMode, formatINR, formatDateDisp, showToast, refreshAllData, resetAllSessions
}) {
  const [activePage, setActivePage] = useState('dashboard'); // 'dashboard' | 'reports' | 'raised' | 'respond' | 'detail'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [disputeMenuOpen, setDisputeMenuOpen] = useState(true);
  
  // Detail disputes states
  const [selectedDisputeId, setSelectedDisputeId] = useState(null);
  const [detailSourcePage, setDetailSourcePage] = useState('respond');
  const [timelineRemark, setTimelineRemark] = useState('');

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

  const [dashFilter, setDashFilter] = useState({ from: DEFAULT_FROM, to: TODAY_STR });
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
  const merchantDisputes = chargebacks.filter(cb => cb.userName === 'masteruser');

  // Dashboard calculations
  const getFilteredDashboardDisputes = () => {
    return merchantDisputes.filter(cb => {
      if (dashFilter.from && cb.createdDate && cb.createdDate < dashFilter.from) return false;
      if (dashFilter.to && cb.createdDate && cb.createdDate > dashFilter.to) return false;
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
    if (cb.merchantAction === 'accepted') return <span className="badge badge-won">✓ Accepted</span>;
    if (cb.merchantAction === 'rejected') return <span className="badge badge-resubmit">✕ Rejected</span>;
    if (cb.merchantAction === 'evidence') return <span className="badge badge-progress">Evidence Submitted</span>;
    return (
      <button className="ta-btn" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>
        Take Action
      </button>
    );
  };

  // Detail dispute view handler
  const openDetail = (id, source) => {
    setSelectedDisputeId(id);
    setDetailSourcePage(source);
    setActivePage('detail');
  };

  const activeDetailDispute = merchantDisputes.find(x => x.id === selectedDisputeId);

  // Post remarks reply
  const sendReply = async () => {
    if (!timelineRemark.trim()) {
      showToast('Please enter a message', 'error');
      return;
    }

    try {
      const entry = {
        by: currentUser.name || 'masteruser',
        time: new Date().toLocaleString(),
        title: 'Remarks Updated by ' + currentUser.name,
        remarks: timelineRemark,
        file: null
      };

      const response = await fetch(`${API_URL}/disputes/${activeDetailDispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timelineEntry: entry })
      });

      if (response.ok) {
        setTimelineRemark('');
        showToast('Remarks posted successfully');
        await refreshAllData();
      } else {
        showToast('Failed to post reply', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API communication error', 'error');
    }
  };

  // Confirm Accept Dispute Action
  const confirmAccept = async () => {
    try {
      const entry = {
        by: currentUser.name,
        time: new Date().toLocaleString(),
        title: 'Merchant Accepted Dispute',
        remarks: acceptRemarks || 'Accepted',
        file: null
      };

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantAction: 'accepted',
          mSubStatus: 'Chargeback Lost',
          timelineEntry: entry
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
      const entry = {
        by: currentUser.name,
        time: new Date().toLocaleString(),
        title: 'Evidence Submitted by ' + currentUser.name + ' (Partner Representation)',
        remarks: (contestRemarks || 'Contested') + ' — Evidence forwarded to Acquirer on behalf of Partner for Visa consideration.',
        file: 'EvidenceSubmitted.pdf'
      };

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantAction: 'evidence',
          mSubStatus: 'Chargeback in Progress',
          visaPending: true,
          timelineEntry: entry
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
      if (reportFilter.from && cb.createdDate && cb.createdDate < reportFilter.from) return false;
      if (reportFilter.to && cb.createdDate && cb.createdDate > reportFilter.to) return false;
      if (reportFilter.provider && cb.product !== reportFilter.provider) return false;
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
        <div className="hdr-wallet">
          <span className="wi">💳</span>
          <span className="wl">Wallet:</span>
          <span className="wa">{formatINR(currentUser.walletBalance)}</span>
        </div>
        <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="hdr-bell">🔔<span className="notif-dot"></span></button>
        <div className="hdr-user" onClick={resetAllSessions}>
          <div className="avatar">🌐</div>
          <div>
            <div className="hdr-uname">{currentUser.name}</div>
            <div className="hdr-urole">Merchant</div>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>▾</span>
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
              <span className="si">📋</span> Reports
            </div>
            <div 
              className={`sb-item ${disputeMenuOpen ? 'open' : ''}`} 
              onClick={() => setDisputeMenuOpen(!disputeMenuOpen)}
            >
              <span className="si">👤</span> Dispute Management <span className="arr">▾</span>
            </div>
            <div className={`sb-sub ${disputeMenuOpen ? 'open' : ''}`}>
              <div 
                className={`sb-sub-item ${activePage === 'raised' ? 'active' : ''}`} 
                onClick={() => { setRaisedPage(1); setActivePage('raised'); }}
              >
                <span className="ssi">📅</span> Dispute Raised Date
              </div>
              <div 
                className={`sb-sub-item ${activePage === 'respond' ? 'active' : ''}`} 
                onClick={() => { setRespondPage(1); setActivePage('respond'); }}
              >
                <span className="ssi">📅</span> Dispute Respond By Date
              </div>
            </div>
          </div>
          <div style={{ marginTop: 'auto', padding: '16px' }}>
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setView('selector')}>
              ← Back to Portal Select
            </button>
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
                  <div className="wb-date">{new Date().toLocaleDateString('en-IN')}</div>
                </div>
                <div className="filter-card" style={{ marginBottom: '16px' }}>
                  <div className="filter-row">
                    <div className="filter-group">
                      <label>From Date</label>
                      <input 
                        type="date" 
                        className="fi-date" 
                        value={dashFilter.from} 
                        onChange={(e) => setDashFilter(prev => ({ ...prev, from: e.target.value }))} 
                      />
                    </div>
                    <div className="filter-group">
                      <label>To Date</label>
                      <input 
                        type="date" 
                        className="fi-date" 
                        value={dashFilter.to} 
                        onChange={(e) => setDashFilter(prev => ({ ...prev, to: e.target.value }))} 
                      />
                    </div>
                    <button className="btn btn-primary" onClick={refreshAllData}>Sync Data</button>
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

                <div className="tbl-card">
                  <div className="tbl-toolbar">
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>Recent Chargebacks</span>
                    <div className="tbl-space"></div>
                    <button className="btn btn-outline btn-sm" onClick={() => setActivePage('respond')}>
                      View All →
                    </button>
                  </div>
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>RRN Number</th>
                          <th>Txn ID</th>
                          <th>Merchant Status</th>
                          <th>Sub Status</th>
                          <th>Adj Amount</th>
                          <th>Adj Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {merchantDisputes.slice(0, 5).map(cb => (
                          <tr key={cb.id}>
                            <td className="mono">{cb.rrn}</td>
                            <td className="mono">{cb.txnId}</td>
                            <td>{renderStatusBadge(cb.mStatus)}</td>
                            <td>{renderSubBadge(cb.mSubStatus)}</td>
                            <td><strong>{formatINR(cb.adjAmt)}</strong></td>
                            <td>{formatDateDisp(cb.adjDate)}</td>
                            <td>{getActionBtn(cb)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
                                  <button className="info-btn" onClick={() => openDetail(cb.id, 'respond')}>ℹ</button>
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
                    <h1>Dispute Reports &amp; Analytics</h1>
                    <p>Search, filter and analyze dispute data across all dimensions</p>
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
                        <option>Chargeback Raise</option>
                        <option>Pre-Arbitration Raise</option>
                        <option>Arbitration Raise</option>
                        <option>VROL Inquiry</option>
                        <option>VROL Chargeback</option>
                        <option>VROL Pre-Arbitration</option>
                        <option>VROL Arbitration</option>
                        <option>Fraud Chargeback Raise</option>
                        <option>Differed Chargeback Raise</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Aggregator</label>
                      <select className="sp-input" value={reportFilter.provider}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, provider: e.target.value }))}>
                        <option value="">Aggregator</option>
                                                <option value="VISA">VISA / Acquirer</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="Rupay">Rupay</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Scheme</label>
                      <select className="sp-input" value={reportFilter.scheme}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, scheme: e.target.value }))}>
                        <option value="">Scheme</option>
                                                <option>VISA</option>
                        <option>Mastercard</option>
                        <option>Rupay</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Dispute Status</label>
                      <select className="sp-input" value={reportFilter.disputeStatus}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, disputeStatus: e.target.value }))}>
                        <option value="">Dispute Status</option>
                        <option>Chargeback New</option>
                        <option>Chargeback in Progress</option>
                        <option>Chargeback Resubmit</option>
                        <option>Chargeback Won</option>
                        <option>Chargeback Lost</option>
                        <option>Refund Success</option>
                        <option>Refund On Hold</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input" value={reportFilter.searchBy}
                        onChange={(e) => setReportFilter(prev => ({ ...prev, searchBy: e.target.value }))}>
                        <option value="">Search By</option>
                        <option value="rrn">RRN</option>
                        <option value="txnId">Txn ID</option>
                        <option value="caseId">Case ID</option>
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
                      Dispute Management
                    </div>
                    <div className={`report-tab ${reportTab === 'doc-pending' ? 'active' : ''}`} onClick={() => setReportTab('doc-pending')}>
                      Document Pending from Merchant
                    </div>
                    <div className={`report-tab ${reportTab === 'doc-verification' ? 'active' : ''}`} onClick={() => setReportTab('doc-verification')}>
                      Document Pending for Verification
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
                            <tr>
                              <th>Ticket ID</th>
                              <th>Dispute Date</th>
                              <th>Aggregator</th>
                              <th>Scheme</th>
                              <th>Dispute Type</th>
                              <th>Merchant Name</th>
                              <th>MID</th>
                              <th>ARN / RRN</th>
                              <th>Dispute Status</th>
                              <th>TXN Ref. Number</th>
                              <th>Remaining Days</th>
                              <th>Visa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.filtered.slice(0, 10).map(cb => (
                              <tr key={cb.id}>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.caseId}</td>
                                <td>{formatDateDisp(cb.createdDate)}</td>
                                <td>{cb.product === 'VISA' ? 'NPCI' : 'Acquirer'}</td>
                                <td><span className="badge badge-new">{cb.product}</span></td>
                                <td>{renderStatusBadge(cb.mStatus)}</td>
                                <td>{cb.userName}</td>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.userId}</td>
                                <td className="mono">{cb.rrn}</td>
                                <td>{renderSubBadge(cb.mSubStatus)}</td>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.txnId}</td>
                                <td>
                                  <span style={{ color: cb.aging > 4 ? 'var(--red)' : cb.aging > 2 ? 'var(--yellow)' : 'var(--green)', fontWeight: '700' }}>
                                    {Math.max(0, 10 - cb.aging)}d
                                  </span>
                                </td>
                                <td>
                                  {cb.visaPending
                                    ? <span className="badge badge-visa">🌐 Visa</span>
                                    : <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>—</span>}
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
                          {merchantDisputes.filter(cb => !cb.merchantAction).length} pending
                        </span>
                      </div>
                      <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Ticket ID</th>
                              <th>Dispute Date</th>
                              <th>Scheme</th>
                              <th>Dispute Type</th>
                              <th>Merchant Name</th>
                              <th>MID</th>
                              <th>ARN / RRN</th>
                              <th>Dispute Status</th>
                              <th>TXN Ref. Number</th>
                              <th>Remaining Days</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {merchantDisputes.filter(cb => !cb.merchantAction).map(cb => (
                              <tr key={cb.id}>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.caseId}</td>
                                <td>{formatDateDisp(cb.createdDate)}</td>
                                <td><span className="badge badge-new">{cb.product}</span></td>
                                <td>{renderStatusBadge(cb.mStatus)}</td>
                                <td>{cb.userName}</td>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.userId}</td>
                                <td className="mono">{cb.rrn}</td>
                                <td>{renderSubBadge(cb.mSubStatus)}</td>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.txnId}</td>
                                <td><span style={{ color: 'var(--red)', fontWeight: '700' }}>{Math.max(0, 10 - cb.aging)}d</span></td>
                                <td>
                                  <button className="ta-btn" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>
                                    Take Action
                                  </button>
                                </td>
                              </tr>
                            ))}
                            {merchantDisputes.filter(cb => !cb.merchantAction).length === 0 && (
                              <tr><td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>✅ No pending documents</td></tr>
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
                          {merchantDisputes.filter(cb => cb.merchantAction === 'evidence').length} awaiting verification
                        </span>
                      </div>
                      <div className="tbl-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Ticket ID</th>
                              <th>Dispute Date</th>
                              <th>Scheme</th>
                              <th>Dispute Type</th>
                              <th>Merchant Name</th>
                              <th>MID</th>
                              <th>ARN / RRN</th>
                              <th>Dispute Status</th>
                              <th>TXN Ref.</th>
                              <th>Remaining Days</th>
                              <th>Visa Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {merchantDisputes.filter(cb => cb.merchantAction === 'evidence').map(cb => (
                              <tr key={cb.id}>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.caseId}</td>
                                <td>{formatDateDisp(cb.createdDate)}</td>
                                <td><span className="badge badge-new">{cb.product}</span></td>
                                <td>{renderStatusBadge(cb.mStatus)}</td>
                                <td>{cb.userName}</td>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.userId}</td>
                                <td className="mono">{cb.rrn}</td>
                                <td>{renderSubBadge(cb.mSubStatus)}</td>
                                <td className="mono" style={{ fontSize: '11px' }}>{cb.txnId}</td>
                                <td><span style={{ color: cb.aging > 4 ? 'var(--red)' : 'var(--yellow)', fontWeight: '700' }}>{Math.max(0, 10 - cb.aging)}d</span></td>
                                <td>
                                  {cb.visaPending
                                    ? <span className="badge badge-visa">🌐 Pending Visa</span>
                                    : <span className="badge badge-progress">⏳ Acquirer Review</span>}
                                </td>
                              </tr>
                            ))}
                            {merchantDisputes.filter(cb => cb.merchantAction === 'evidence').length === 0 && (
                              <tr><td colSpan="11" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No documents pending verification</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Charts row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                  <div className="tbl-card" style={{ padding: '20px' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '15px', fontWeight: '700' }}>Disputes by Scheme</h4>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                      <BarChart providerData={reportData.providers} />
                    </div>
                  </div>
                  <div className="tbl-card" style={{ padding: '20px' }}>
                    <h4 style={{ marginBottom: '16px', fontSize: '15px', fontWeight: '700' }}>Resolution Outcome (Won vs Lost)</h4>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                      <DonutChart dataSegments={reportData.outcomes} darkMode={darkMode} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

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
                Accept Dispute
              </button>
              <button 
                className="btn btn-outline" 
                style={{ width: '100%', height: '46px', fontSize: '15px' }} 
                onClick={() => setActiveModal('contest')}
              >
                Contest &amp; Upload Evidence
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
                  <option value="accept">Accept Dispute</option>
                  <option value="contest">Contest Dispute and Submit Evidence</option>
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
                    <button className="btn btn-primary" onClick={confirmAccept}>Accept Dispute</button>
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
                  <input type="radio" name="contestOpt" checked={false} onChange={() => setActiveModal('action2')} /> Accept Dispute
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
function AdminPortal({
  currentUser, chargebacks, users, ledger, setView, toggleTheme, darkMode, formatINR, formatDateDisp, showToast, refreshAllData, resetAllSessions
}) {
  const [activePage, setActivePage] = useState('a-dashboard'); // 'a-dashboard' | 'a-chargeback' | 'a-raise-cb' | 'a-view-cb' | 'a-lein' | 'a-credit'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [disputeMenuOpen, setDisputeMenuOpen] = useState(true);

  // Modal active
  const [activeModal, setActiveModal] = useState(null); // null | 'remarks' | 'arbitration' | 'refund'
  const [targetDisputeId, setTargetDisputeId] = useState(null);

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

  const [aVcSearchInput, setAVcSearchInput] = useState('');

  // Pagination view chargebacks
  const [aVcPage, setAVcPage] = useState(1);
  const [aVcLimit, setAVcLimit] = useState(5);

  // Expanded row IDs
  const [expandedRowIds, setExpandedRowIds] = useState({});

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
    setFilterFrom(DEFAULT_FROM);
    setFilterTo(TODAY_STR);
    setAVcSearchInput('');
    setAVcPage(1);
  };

  // Compute stats
  const getAdminDashboardStats = () => {
    const totalCount = chargebacks.length;
    const totalAmt = chargebacks.reduce((sum, c) => sum + c.txnAmt, 0);

    const openList = chargebacks.filter(cb => cb.mSubStatus.includes('New') || cb.mSubStatus.includes('Progress') || cb.mSubStatus.includes('Resubmit') || cb.mSubStatus.includes('Hold'));
    const openAmt = openList.reduce((sum, c) => sum + c.txnAmt, 0);

    const lostList = chargebacks.filter(cb => cb.mSubStatus.includes('Lost'));
    const lostAmt = lostList.reduce((sum, c) => sum + c.txnAmt, 0);

    const wonList = chargebacks.filter(cb => cb.mSubStatus.includes('Won') || cb.mSubStatus.includes('Success'));
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
  const pendingReviews = chargebacks.filter(cb => cb.merchantAction === 'rejected' && cb.adminAction === null);

  // Filters admin disputes list
  const getFilteredAdmin = () => {
    let list = chargebacks.filter(cb => {
      if (filterRrn && !cb.rrn.includes(filterRrn)) return false;
      if (filterStatus && cb.mStatus !== filterStatus) return false;
      if (filterSubStatus && cb.mSubStatus !== filterSubStatus) return false;
      if (filterFrom && cb.createdDate && cb.createdDate < filterFrom) return false;
      if (filterTo && cb.createdDate && cb.createdDate > filterTo) return false;
      return true;
    });

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
  const handleConsider = async () => {
    try {
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Internal Team Considered – Represented NPCI UDIR',
        remarks: 'Merchant representations verified. Routing represented claim to Visa VROL.',
        file: evidenceFiles?.adminUpload?.name || null
      };

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAction: 'considered',
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

  // Review decline resubmit
  const handleDecline = async () => {
    try {
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Dispute Proof Declined',
        remarks: 'Uploaded proof insufficient. Resubmitting chargeback to merchant to provide valid delivery docs.',
        file: null
      };

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAction: 'declined',
          merchantAction: null, // Reset so merchant takes action again
          mSubStatus: 'Chargeback Resubmit',
          timelineEntry: entry
        })
      });

      if (response.ok) {
        setActiveModal(null);
        showToast('Declined. Re-routed to merchant.');
        await refreshAllData();
      } else {
        showToast('Decline action failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('API error', 'error');
    }
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
          adminAction: 'won',
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
  const handleArbitrationLost = async () => {
    try {
      const entry = {
        by: 'nsdladmin',
        time: new Date().toLocaleString(),
        title: 'Arbitration Lost (NPCI Decision)',
        remarks: 'Ruling in favor of cardholder. Dispute lost. Held ledger debited permanently.',
        file: null
      };

      const response = await fetch(`${API_URL}/disputes/${targetDisputeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminAction: 'lost',
          mSubStatus: 'Chargeback Lost',
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
            walletStatus: 'Debited', product, aging: 0, merchantAction: null, adminAction: null,
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
        <div className="hdr-logo"><div class="hl-text">iServeU<sup>®</sup></div></div>
        <span className="admin-badge">ADMIN</span>
        <div className="hdr-space"></div>
        <div className="hdr-wallet">
          <span className="wi">💳</span>
          <span className="wl">Wallet:</span>
          <span className="wa" id="aWalletAmt">{formatINR(currentUser.walletBalance)}</span>
        </div>
        <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
        <button className="hdr-bell">🔔<span className="notif-dot"></span></button>
        <div className="hdr-user" onClick={resetAllSessions}>
          <div className="avatar" style={{ background: '#1e293b', color: '#fff' }}>KD</div>
          <div>
            <div className="hdr-uname">{currentUser.name}</div>
            <div className="hdr-urole">Admin / FRM</div>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>▾</span>
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
              className={`sb-item ${disputeMenuOpen ? 'open' : ''}`}
              onClick={() => setDisputeMenuOpen(!disputeMenuOpen)}
            >
              <span className="si">📋</span> Dispute Management <span className="arr">▾</span>
            </div>
            <div className={`sb-sub ${disputeMenuOpen ? 'open' : ''}`}>
              <div 
                className={`sb-sub-item ${activePage === 'a-chargeback' || activePage === 'a-raise-cb' || activePage === 'a-view-cb' ? 'active' : ''}`}
                onClick={() => setActivePage('a-chargeback')}
              >
                <span className="ssi">⚖️</span> Chargeback
              </div>
              <div 
                className={`sb-sub-item ${activePage === 'a-lein' ? 'active' : ''}`}
                onClick={() => setActivePage('a-lein')}
              >
                <span className="ssi">🔒</span> LEIN Amount
              </div>
              <div 
                className={`sb-sub-item ${activePage === 'a-credit' ? 'active' : ''}`}
                onClick={() => setActivePage('a-credit')}
              >
                <span className="ssi">💳</span> Credit Adjustment
              </div>
            </div>
          </div>
          <div style={{ marginTop: 'auto', padding: '16px' }}>
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setView('selector')}>
              ← Back to Portal Select
            </button>
          </div>
        </nav>

        <main className="main">
          {/* Admin Dashboard */}
          {activePage === 'a-dashboard' && (
            <div className="page active" id="a-dashboard">
              <div className="page-inner">
                <div className="welcome-bar">
                  <div>
                    <div className="wb-title">Welcome, Admin (FRM Team) 👋</div>
                    <div className="wb-sub">Audit and represent chargeback claims across acquired merchants</div>
                  </div>
                  <div className="wb-date">{new Date().toLocaleDateString('en-IN')}</div>
                </div>

                <div className="stats-grid" id="adminDashStats">
                  <div className="stat-card received">
                    <div className="stat-icon">📥</div>
                    <div>
                      <div className="stat-val">{formatINR(stats.totalAmt)}</div>
                      <div className="stat-lbl">Total Disputes</div>
                      <div className="stat-cnt">Count: {stats.totalCount}</div>
                    </div>
                  </div>
                  <div className="stat-card open">
                    <div className="stat-icon">🔄</div>
                    <div>
                      <div className="stat-val">{formatINR(stats.openAmt)}</div>
                      <div className="stat-lbl">Open / Pending</div>
                      <div className="stat-cnt">Count: {stats.openCount}</div>
                    </div>
                  </div>
                  <div className="stat-card lost">
                    <div className="stat-icon">❌</div>
                    <div>
                      <div className="stat-val">{formatINR(stats.lostAmt)}</div>
                      <div className="stat-lbl">Disputes Lost</div>
                      <div className="stat-cnt">Count: {stats.lostCount}</div>
                    </div>
                  </div>
                  <div className="stat-card won">
                    <div className="stat-icon">✅</div>
                    <div>
                      <div className="stat-val">{formatINR(stats.wonAmt)}</div>
                      <div className="stat-lbl">Disputes Won</div>
                      <div className="stat-cnt">Count: {stats.wonCount}</div>
                    </div>
                  </div>
                </div>

                <div className="qa-grid">
                  <div className="qa-card">
                    <h4>Chargeback TAT Status</h4>
                    <div className="tat-row"><span>Chargeback (10 days iSU)</span><span className="tat-ok">6 within TAT</span></div>
                    <div className="tat-row"><span>Deferred CB (10 days iSU)</span><span className="tat-ok">4 within TAT</span></div>
                    <div className="tat-row"><span>Fraud CB (25 days iSU)</span><span className="tat-warn">2 near expiry</span></div>
                    <div className="tat-row"><span>Pre-Arbitration (4 days)</span><span className="tat-over">1 overdue</span></div>
                    <div className="tat-row"><span>Arbitration (10 days iSU)</span><span className="tat-ok">2 within TAT</span></div>
                  </div>
                  <div className="qa-card">
                    <h4>Quick Actions</h4>
                    <button className="btn btn-primary qa-btn" onClick={() => { setSelectedProvider(''); setActivePage('a-raise-cb'); }}>
                      📤 Raise New Chargeback (Bulk Upload)
                    </button>
                    <button className="btn btn-secondary qa-btn" style={{ marginTop: '8px' }} onClick={() => { setAVcPage(1); setActivePage('a-view-cb'); }}>
                      📋 View All Chargebacks
                    </button>
                    <button className="btn btn-secondary qa-btn" style={{ marginTop: '8px' }} onClick={() => setActivePage('a-lein')}>
                      🔒 Manage LEIN Amounts
                    </button>
                  </div>
                </div>

                <div className="tbl-card">
                  <div className="tbl-toolbar">
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>Pending Merchant Representation Reviews</span>
                    <div className="tbl-space"></div>
                    <span style={{ color: 'var(--brand)', fontWeight: '600', fontSize: '13px' }}>
                      {pendingReviews.length} awaiting review
                    </span>
                  </div>
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>RRN</th>
                          <th>Beneficiary</th>
                          <th>Txn Amount</th>
                          <th>Adj Type</th>
                          <th>Status</th>
                          <th>Sub Status</th>
                          <th>Raised Date</th>
                          <th>Aging</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingReviews.length > 0 ? (
                          pendingReviews.map(cb => (
                            <tr key={cb.id}>
                              <td className="mono">{cb.rrn}</td>
                              <td>{cb.beneficiary}</td>
                              <td><strong>{formatINR(cb.txnAmt)}</strong></td>
                              <td>{cb.adjType}</td>
                              <td>{renderStatusBadge(cb.mStatus)}</td>
                              <td>{renderSubBadge(cb.mSubStatus)}</td>
                              <td>{formatDateDisp(cb.createdDate)}</td>
                              <td>
                                <span style={{ color: cb.aging > 5 ? 'var(--red)' : 'var(--yellow)', fontWeight: '600' }}>
                                  {cb.aging}d
                                </span>
                              </td>
                              <td>
                                <button className="btn btn-sm btn-primary" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('remarks'); }}>
                                  Review
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="9">
                              <div className="no-data" style={{ padding: '24px' }}>
                                <div style={{ fontSize: '30px', marginBottom: '8px' }}>✅</div>
                                <p>No pending merchant representations awaiting review.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
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
                    onClick={() => { setSelectedProvider(''); setActivePage('a-raise-cb'); }}
                  >
                    <div style={{ fontSize: '40px', marginBottom: '12px' }}>📤</div>
                    <div style={{ fontSize: '15px', fontWeight: '600' }}>Raise Chargeback</div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>Upload bulk excel/CSV disputes</p>
                  </div>
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

          {/* Admin Raise Chargeback */}
          {activePage === 'a-raise-cb' && (
            <div className="page active" id="a-raise-cb">
              <div className="view-chargeback-header">
                <span className="vc-breadcrumb">Dispute Management / Chargeback / <span>Raise Chargeback</span></span>
              </div>
              <div className="page-inner">
                <div className="upload-hero">
                  <button className="back-btn" onClick={() => setActivePage('a-chargeback')}>←</button>
                  <h2>Bulk Upload Chargebacks</h2>
                </div>
                
                {!selectedProvider ? (
                  <div id="providerStep">
                    <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '16px' }}>Select Card Scheme / Payment System:</div>
                    <div className="provider-cards">
                                            <div className="provider-card" onClick={() => selectProvider('VISA')}>VISA</div>
                      <div className="provider-card" onClick={() => selectProvider('Mastercard')}>Mastercard</div>
                      <div className="provider-card" onClick={() => selectProvider('Rupay')}>Rupay</div>
                    </div>
                  </div>
                ) : (
                  <div id="uploadStep">
                    <div className="upload-section">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '600' }}>Selected Provider: <span style={{ color: 'var(--brand)' }}>{selectedProvider}</span></div>
                        <button className="btn btn-secondary btn-sm" onClick={changeProvider}>Change Provider</button>
                      </div>

                      {!uploadResult ? (
                        <div id="uploadZoneWrap">
                          <div className="upload-box" onClick={() => document.getElementById('cbFile').click()}>
                            <div className="ub-icon">📊</div>
                            <h3>Upload Chargeback CSV File</h3>
                            <p>Click to browse or drag &amp; drop here</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '6px' }}>CSV format only · Max 100MB · Up to 5000 records</p>
                          </div>
                          <input type="file" id="cbFile" accept=".csv" style={{ display: 'none' }} onChange={handleFileSelect} />
                          
                          {bulkFileName && (
                            <div className="uploaded-file">
                              <span>📄 {bulkFileName}</span>
                              <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand)' }} onClick={handleClearFile}>✕</button>
                            </div>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px' }}>
                            <span onClick={downloadSampleTemplate} style={{ color: 'var(--brand)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                              ⬇ Download Sample File Template
                            </span>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button className="btn btn-secondary" onClick={handleClearFile}>Cancel</button>
                              {bulkFileName && <button className="btn btn-primary" onClick={handleBulkUploadSubmit}>Upload File</button>}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div id="uploadResult">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', padding: '16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius)' }}>
                            <span style={{ fontSize: '32px' }}>✅</span>
                            <div>
                              <div style={{ fontSize: '16px', fontWeight: '700', color: '#15803d' }}>File Processed Successfully!</div>
                              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Dispute records populated in database.</div>
                            </div>
                          </div>
                          <div className="upload-result-grid">
                            <div className="url-item total"><div className="urv">{uploadResult.total}</div><div className="url">Total Records</div></div>
                            <div className="url-item success"><div className="urv">{uploadResult.success}</div><div className="url">Processed Successfully</div></div>
                            <div className="url-item fail"><div className="urv">{uploadResult.fail}</div><div className="url">Failed</div></div>
                          </div>
                          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                            <button className="btn btn-primary" onClick={downloadSampleTemplate}>⬇ Download Template</button>
                            <button className="btn btn-secondary" onClick={handleResetUpload}>Upload Another File</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                <div className="filter-card">
                  <div className="filter-row">
                    <div className="filter-group">
                      <label>From Date</label>
                      <input type="date" className="fi-date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                    </div>
                    <div className="filter-group">
                      <label>To Date</label>
                      <input type="date" className="fi-date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                    </div>
                    <div className="filter-group">
                      <label>Enter RRN</label>
                      <input type="text" className="fi-text" placeholder="RRN Number" value={filterRrn} onChange={(e) => setFilterRrn(e.target.value)} />
                    </div>
                    <div className="filter-group">
                      <label>Merchant ID</label>
                      <input type="text" className="fi-text" placeholder="Merchant ID" value={filterMid} onChange={(e) => setFilterMid(e.target.value)} />
                    </div>
                    <div className="filter-group">
                      <label>Status</label>
                      <select className="fi-sel" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">All Status</option>
                        <option>Chargeback Raise</option>
                        <option>Pre-Arbitration Raise</option>
                        <option>Arbitration Raise</option>
                        <option>VROL Inquiry</option>
                        <option>VROL Chargeback</option>
                        <option>VROL Pre-Arbitration</option>
                        <option>VROL Arbitration</option>
                        <option>Fraud Chargeback Raise</option>
                        <option>Differed Chargeback Raise</option>
                      </select>
                    </div>
                    <div className="filter-group">
                      <label>Sub Status</label>
                      <select className="fi-sel" value={filterSubStatus} onChange={(e) => setFilterSubStatus(e.target.value)}>
                        <option value="">All Sub Status</option>
                        <option>Chargeback New</option>
                        <option>Chargeback in Progress</option>
                        <option>Chargeback Resubmit</option>
                        <option>Chargeback Won</option>
                        <option>Chargeback Lost</option>
                        <option>Refund Success</option>
                        <option>Refund On Hold</option>
                      </select>
                    </div>
                    <button className="btn btn-primary" onClick={filterAdminCb}>Search</button>
                    <button className="btn btn-secondary" onClick={resetAdminCb}>Reset</button>
                  </div>
                </div>

                <div className="tbl-card">
                  <div className="tbl-toolbar">
                    <div className="search-wrap">
                      <span className="si">🔍</span>
                      <input 
                        type="text" 
                        className="tbl-search" 
                        placeholder="Search Merchant/RRN/Txn..." 
                        value={aVcSearchInput}
                        onChange={(e) => { setAVcPage(1); setAVcSearchInput(e.target.value); }}
                      />
                    </div>
                    <div className="tbl-space"></div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', marginRight: '12px' }}>
                      {adminPaging.total} records found
                    </span>
                    <button className="btn btn-outline btn-sm" onClick={() => exportExcel('admin')}>
                      ⬇ Download CSV
                    </button>
                  </div>
                  
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Merchant</th>
                          <th>User ID</th>
                          <th>RRN</th>
                          <th>Txn ID</th>
                          <th>GL No.</th>
                          <th>TXN Date</th>
                          <th>Status</th>
                          <th>Sub Status</th>
                          <th>Adj Date</th>
                          <th>Adj Type</th>
                          <th>Remitter</th>
                          <th>Beneficiary</th>
                          <th>Txn Amount</th>
                          <th>Adj Amount</th>
                          <th>LEIN Amount</th>
                          <th>Aging</th>
                          <th>Visa</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminPaging.paginated.length > 0 ? (
                          adminPaging.paginated.map(cb => {
                            const isExpanded = expandedRowIds[cb.id];
                            return (
                              <React.Fragment key={cb.id}>
                                <tr>
                                  <td>{cb.userName}</td>
                                  <td className="mono" style={{ fontSize: '11px' }}>{cb.userId}</td>
                                  <td className="mono">{cb.rrn}</td>
                                  <td className="mono" style={{ fontSize: '11px' }}>{cb.txnId}</td>
                                  <td>{cb.glNo}</td>
                                  <td>{formatDateDisp(cb.txnDate)}</td>
                                  <td>{renderStatusBadge(cb.mStatus)}</td>
                                  <td>{renderSubBadge(cb.mSubStatus)}</td>
                                  <td>{formatDateDisp(cb.adjDate)}</td>
                                  <td>{cb.adjType}</td>
                                  <td>{cb.remitter}</td>
                                  <td>{cb.beneficiary}</td>
                                  <td><strong>{formatINR(cb.txnAmt)}</strong></td>
                                  <td>{formatINR(cb.adjAmt)}</td>
                                  <td>{cb.leinAmt > 0 ? <span style={{ color: 'var(--yellow)', fontWeight: '600' }}>{formatINR(cb.leinAmt)}</span> : '₹0.00'}</td>
                                  <td>
                                    <span style={{ color: cb.aging > 4 ? 'var(--red)' : cb.aging > 2 ? 'var(--yellow)' : 'var(--green)', fontWeight: '600' }}>
                                      {cb.aging}d
                                    </span>
                                  </td>
                                  <td>
                                    {cb.visaPending
                                      ? <span className="badge badge-visa">🌐 Visa</span>
                                      : <span style={{ color: 'var(--text-light)', fontSize: '11px' }}>—</span>}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                      <button className="btn btn-sm btn-secondary" onClick={() => toggleRowExpand(cb.id)}>
                                        {isExpanded ? '▲ Less' : '▼ Details'}
                                      </button>
                                      {cb.merchantAction === 'rejected' && cb.adminAction === null && (
                                        <button className="btn btn-sm btn-primary" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('remarks'); }}>
                                          Review
                                        </button>
                                      )}
                                      {cb.mStatus.includes('Arbitration') && !cb.adminAction && (
                                        <button className="btn btn-sm" style={{ background: 'var(--purple)', color: '#fff' }} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('arbitration'); }}>
                                          Arb Decision
                                        </button>
                                      )}
                                      {(cb.mSubStatus.includes('Won') || cb.mSubStatus.includes('Accepted')) && cb.mSubStatus !== 'Refund Success' && cb.mSubStatus !== 'Refund On Hold' && (
                                        <button className="btn btn-sm btn-success" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('refund'); }}>
                                          Refund
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="expand-row">
                                    <td colSpan="18" style={{ padding: 0 }}>
                                      <div className="expand-inner" style={{ background: 'var(--bg)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                                        <div className="expand-grid">
                                          <div className="eg-item"><div className="ek">Terminal ID</div><div className="ev">{cb.terminalId || '—'}</div></div>
                                          <div className="eg-item"><div className="ek">Remitter Mobile</div><div className="ev">{cb.remMobile || '—'}</div></div>
                                          <div className="eg-item"><div className="ek">Hold Status</div><div className="ev">{cb.leinAmt > 0 ? 'HOLD ACTIVE' : 'NO HOLD'}</div></div>
                                          <div className="eg-item"><div className="ek">Product / Scheme</div><div className="ev">{cb.product}</div></div>
                                          <div className="eg-item"><div className="ek">Merchant Action</div><div className="ev">{cb.merchantAction || '—'}</div></div>
                                          <div className="eg-item"><div className="ek">Admin Review Action</div><div className="ev">{cb.adminAction || '—'}</div></div>
                                          {cb.product === 'VISA' && (
                                            <>
                                              <div className="eg-item"><div className="ek">VROL Case ID</div><div className="ev">{cb.caseId || '-'}</div></div>
                                              <div className="eg-item"><div className="ek">Visa Reason Code</div><div className="ev">{cb.reasonCode || '10.4'}</div></div>
                                            </>
                                          )}
                                        </div>
                                        {cb.timeline && cb.timeline.length > 0 && (
                                          <div style={{ marginTop: '12px', borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                                              Audit Timeline Trails:
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                              {cb.timeline.map((tl, index) => (
                                                <div style={{ fontSize: '12px' }} key={index}>
                                                  <strong>[{tl.time}] {tl.title}</strong>: {tl.remarks || 'No remarks'} {tl.file ? `(Uploaded: ${tl.file})` : ''}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
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

          {/* Admin LEIN Amount holds */}
          {activePage === 'a-lein' && (
            <div className="page active" id="a-lein">
              <div className="page-inner">
                <div className="page-hdr"><div><h1>LEIN Amount Holds</h1><p>Audit hold balances placed on merchant wallets</p></div></div>
                <div className="filter-card">
                  <div className="filter-row">
                    <div className="filter-group"><label>From Date</label><input type="date" className="fi-date" /></div>
                    <div className="filter-group"><label>To Date</label><input type="date" className="fi-date" /></div>
                    <div className="filter-group"><label>Merchant ID</label><input type="text" className="fi-text" placeholder="Merchant ID" /></div>
                    <button className="btn btn-primary" onClick={() => showToast('Hold history refreshed', 'warning')}>Search</button>
                  </div>
                </div>
                <div className="tbl-card">
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Merchant ID</th>
                          <th>Merchant Name</th>
                          <th>LEIN Amount</th>
                          <th>Hold Since</th>
                          <th>Chargeback RRN</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="mono">2222257001642755</td>
                          <td>masteruser</td>
                          <td><strong>₹100.00</strong></td>
                          <td>{daysAgoFmt(5)}</td>
                          <td className="mono">609315655333</td>
                          <td><span className="badge badge-progress">Hold Active</span></td>
                          <td><button className="btn btn-sm btn-secondary" onClick={() => showToast('Viewing hold audit logs...', 'warning')}>View</button></td>
                        </tr>
                        <tr>
                          <td className="mono">2222257001642755</td>
                          <td>masteruser</td>
                          <td><strong>₹100.00</strong></td>
                          <td>{daysAgoFmt(2)}</td>
                          <td className="mono">609315298417</td>
                          <td><span className="badge badge-progress">Hold Active</span></td>
                          <td><button className="btn btn-sm btn-secondary" onClick={() => showToast('Viewing hold audit logs...', 'warning')}>View</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Credit Adjustment Portal */}
          {activePage === 'a-credit' && (
            <div className="page active" id="a-credit">
              <div className="page-inner">
                <div className="page-hdr">
                  <div>
                    <h1>Credit Adjustment Portal</h1>
                    <p>Execute financial adjustments on merchant wallets and log entries</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px', alignItems: 'start' }}>
                  <div className="filter-card" style={{ marginBottom: 0 }}>
                    <h3 style={{ marginBottom: '16px', fontSize: '15px', fontWeight: '700', color: 'var(--text)' }}>New Wallet Adjustment</h3>
                    
                    <div className="mf">
                      <label>Target Merchant <span className="req">*</span></label>
                      <select 
                        className="mfi" 
                        style={{ height: '38px' }}
                        value={adjMerchant}
                        onChange={(e) => setAdjMerchant(e.target.value)}
                      >
                        <option value="">Select Merchant</option>
                        {users.filter(u => u.role === 'merchant').map(u => (
                          <option key={u._id} value={u.username}>{u.name} ({u.username})</option>
                        ))}
                      </select>
                    </div>

                    <div className="mf">
                      <label>Adjustment Type <span className="req">*</span></label>
                      <div className="radio-opts" style={{ marginTop: '8px', marginBottom: '8px' }}>
                        <label className="radio-opt">
                          <input type="radio" name="adjType" value="Credit" checked={adjType === 'Credit'} onChange={() => setAdjType('Credit')} /> Credit (+)
                        </label>
                        <label className="radio-opt">
                          <input type="radio" name="adjType" value="Debit" checked={adjType === 'Debit'} onChange={() => setAdjType('Debit')} /> Debit (-)
                        </label>
                      </div>
                    </div>

                    <div className="mf">
                      <label>Amount (INR) <span className="req">*</span></label>
                      <input 
                        type="number" 
                        className="mfi" 
                        placeholder="Enter adjustment amount" 
                        value={adjAmount}
                        onChange={(e) => setAdjAmount(e.target.value)}
                      />
                    </div>

                    <div className="mf">
                      <label>Remarks / Purpose <span className="req">*</span></label>
                      <textarea 
                        className="mfi mfi-area" 
                        placeholder="State financial adjustment reason..." 
                        value={adjRemarks}
                        onChange={(e) => setAdjRemarks(e.target.value)}
                      />
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%', marginTop: '8px', height: '40px' }} onClick={handleAdjustmentSubmit}>
                      Submit Adjustment
                    </button>
                  </div>

                  <div className="tbl-card">
                    <div className="tbl-toolbar">
                      <span style={{ fontSize: '14px', fontWeight: '700' }}>Adjustment Ledger History Logs</span>
                    </div>
                    <div className="tbl-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Merchant</th>
                            <th>Type</th>
                            <th>Amount</th>
                            <th>Date</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.length > 0 ? (
                            ledger.map(item => (
                              <tr key={item._id}>
                                <td className="mono">{item.id}</td>
                                <td><strong>{item.merchant}</strong></td>
                                <td>
                                  <span className={`badge ${item.type === 'Credit' ? 'badge-won' : 'badge-lost'}`}>
                                    {item.type}
                                  </span>
                                </td>
                                <td>
                                  <strong style={{ color: item.type === 'Credit' ? 'var(--green)' : 'var(--red)' }}>
                                    {item.type === 'Credit' ? '+' : '-'} {formatINR(item.amount)}
                                  </strong>
                                </td>
                                <td>{formatDateDisp(item.date)}</td>
                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.remarks}>
                                  {item.remarks}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="6" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No ledger adjustment logs found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Admin Modals */}
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
                  {cb.rejectReason ? (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Submitted Document</div>
                      <div className="remarks-doc">
                        <span>📄 Merchant_Evidence.pdf</span>
                        <button className="btn btn-sm btn-secondary" onClick={() => showToast('Downloading Evidence File...', 'success')}>⬇ Download</button>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>Merchant Justification Remarks</div>
                      <div className="remarks-reason">{cb.rejectReason}</div>
                      <div style={{ marginTop: '15px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>Admin Evidence Upload (Optional)</label>
                        <input type="file" className="form-control" onChange={(e) => setEvidenceFiles({ ...evidenceFiles, adminUpload: e.target.files[0] })} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No merchant representation logs found.</div>
                  )}
                </div>
                <div className="modal-footer" style={{ justifyContent: 'flex-start' }}>
                  {cb.merchantAction === 'rejected' && cb.adminAction === null ? (
                    <>
                      <button className="btn btn-success" style={{ flex: 1 }} onClick={handleConsider}>Consider (Represent Case)</button>
                      <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDecline}>Decline (Re-Route Merchant)</button>
                    </>
                  ) : (
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setActiveModal(null)}>Close</button>
                  )}
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
                <div className="modal-footer">
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={handleArbitrationWon}>Arbitration WON (Credit Merchant)</button>
                  <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleArbitrationLost}>Arbitration LOST (Confirm Debit)</button>
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
  currentUser, chargebacks, setView, toggleTheme, darkMode, formatINR, formatDateDisp, showToast, refreshAllData, resetAllSessions
}) {
  const [activePage, setActivePage] = useState('p-dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const TODAY_STR = new Date().toISOString().split('T')[0];
  const DEFAULT_FROM = (() => { let d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0]; })();
  const [filterFrom, setFilterFrom] = useState(DEFAULT_FROM);
  const [filterTo, setFilterTo] = useState(TODAY_STR);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScheme, setFilterScheme] = useState('');
  const [activeTab, setActiveTab] = useState('dispute-mgmt');

  // Partner sees all disputes (they represent all merchants)
  const allDisputes = chargebacks;
  const visaDisputes = allDisputes.filter(cb => cb.visaPending);
  const evidenceDisputes = allDisputes.filter(cb => cb.merchantAction === 'evidence');

  const filteredDisputes = allDisputes.filter(cb => {
    if (filterFrom && cb.createdDate && cb.createdDate < filterFrom) return false;
    if (filterTo && cb.createdDate && cb.createdDate > filterTo) return false;
    if (filterStatus && cb.mSubStatus !== filterStatus) return false;
    if (filterScheme && cb.product !== filterScheme) return false;
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
        <div className="hdr-user" onClick={resetAllSessions}>
          <div className="avatar" style={{ background: '#7c3aed' }}>AM</div>
          <div>
            <div className="hdr-uname">{currentUser.name}</div>
            <div className="hdr-urole">Partner</div>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '4px' }}>▾</span>
        </div>
      </header>

      <div className="app-body">
        <nav className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <div className="sb-welcome">Welcome, Partner</div>
          <div className="sb-section">
            <div className={`sb-item ${activePage === 'p-dashboard' ? 'active' : ''}`} onClick={() => setActivePage('p-dashboard')}>
              <span className="si">⊞</span> Dashboard
            </div>
            <div className={`sb-item ${activePage === 'p-disputes' ? 'active' : ''}`} onClick={() => setActivePage('p-disputes')}>
              <span className="si">📋</span> Dispute Reports
            </div>
            <div className={`sb-item ${activePage === 'p-visa' ? 'active' : ''}`} onClick={() => setActivePage('p-visa')}>
              <span className="si">🌐</span> Visa Escalations
              {visaDisputes.length > 0 && <span style={{ marginLeft: 'auto', background: 'var(--brand)', color: '#fff', borderRadius: '10px', fontSize: '10px', padding: '2px 6px', fontWeight: '700' }}>{visaDisputes.length}</span>}
            </div>
          </div>
          <div style={{ marginTop: 'auto', padding: '16px' }}>
            <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => setView('selector')}>
              ← Back to Portal Select
            </button>
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
                      <select className="sp-input" value="" onChange={() => {}}>
                        <option value="">Dispute Type</option>
                        <option>Chargeback Raise</option>
                        <option>Pre-Arbitration Raise</option>
                        <option>Arbitration Raise</option>
                        <option>VROL Inquiry</option>
                        <option>VROL Chargeback</option>
                        <option>VROL Pre-Arbitration</option>
                        <option>VROL Arbitration</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Aggregator</label>
                      <select className="sp-input" value={filterScheme} onChange={(e) => setFilterScheme(e.target.value)}>
                        <option value="">All Aggregators</option>
                                                <option value="VISA">VISA / Acquirer</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="Rupay">Rupay</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Scheme</label>
                      <select className="sp-input" value={filterScheme} onChange={(e) => setFilterScheme(e.target.value)}>
                        <option value="">Scheme</option>
                                                <option value="VISA">VISA</option>
                        <option value="Mastercard">Mastercard</option>
                        <option value="Rupay">Rupay</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Dispute Status</label>
                      <select className="sp-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                        <option value="">Dispute Status</option>
                        <option>Chargeback New</option>
                        <option>Chargeback in Progress</option>
                        <option>Chargeback Resubmit</option>
                        <option>Chargeback Won</option>
                        <option>Chargeback Lost</option>
                        <option>Refund Success</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input">
                        <option>Search By</option>
                        <option>RRN</option>
                        <option>Txn ID</option>
                        <option>Case ID</option>
                      </select>
                    </div>
                    <div className="sp-field">
                      <label>Search</label>
                      <input type="text" className="sp-input" placeholder="Search..." />
                    </div>
                    <div className="sp-field" style={{ visibility: 'hidden' }}></div>
                  </div>
                  <div className="search-panel-actions">
                    <button className="btn btn-secondary" onClick={() => { setFilterFrom(DEFAULT_FROM); setFilterTo(TODAY_STR); setFilterStatus(''); setFilterScheme(''); }}>Reset</button>
                    <button className="btn btn-primary" onClick={() => showToast('Disputes filtered!')}>Search</button>
                  </div>
                </div>

                <div className="tbl-card" style={{ overflow: 'visible' }}>
                  <div className="report-tabs" style={{ padding: '0 16px' }}>
                    <div className={`report-tab ${activeTab === 'dispute-mgmt' ? 'active' : ''}`} onClick={() => setActiveTab('dispute-mgmt')}>Dispute Management</div>
                    <div className={`report-tab ${activeTab === 'doc-pending' ? 'active' : ''}`} onClick={() => setActiveTab('doc-pending')}>Document Pending from Merchant</div>
                    <div className={`report-tab ${activeTab === 'doc-verification' ? 'active' : ''}`} onClick={() => setActiveTab('doc-verification')}>Document Pending for Verification</div>
                  </div>
                  <div className="tbl-toolbar">
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{filteredDisputes.length} records</span>
                    <div className="tbl-space"></div>
                  </div>
                  <div className="tbl-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Ticket ID</th><th>Dispute Date</th><th>Aggregator</th><th>Scheme</th>
                          <th>Dispute Type</th><th>Merchant Name</th><th>MID</th><th>ARN / RRN</th>
                          <th>Dispute Status</th><th>TXN Ref.</th><th>Remaining Days</th><th>Visa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDisputes.map(cb => (
                          <tr key={cb.id}>
                            <td className="mono" style={{ fontSize: '11px' }}>{cb.caseId}</td>
                            <td>{formatDateDisp(cb.createdDate)}</td>
                            <td>{cb.product === 'VISA' ? 'NPCI' : 'Acquirer'}</td>
                            <td><span className="badge badge-new">{cb.product}</span></td>
                            <td>{renderStatusBadge(cb.mStatus)}</td>
                            <td>{cb.userName}</td>
                            <td className="mono" style={{ fontSize: '11px' }}>{cb.userId}</td>
                            <td className="mono">{cb.rrn}</td>
                            <td>{renderSubBadge(cb.mSubStatus)}</td>
                            <td className="mono" style={{ fontSize: '11px' }}>{cb.txnId}</td>
                            <td><span style={{ color: cb.aging > 4 ? 'var(--red)' : cb.aging > 2 ? 'var(--yellow)' : 'var(--green)', fontWeight: '700' }}>{Math.max(0, 10 - cb.aging)}d</span></td>
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
