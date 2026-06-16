import re

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # --- 1. Modify Merchant Portal ---
    # Replace search-panel with fieldset
    old_m_search_start = '''                {/* Search Panel — matches reference image */}
                <div className="search-panel">
                  <div className="search-panel-title">🔍 Search — Dispute Management</div>
                  <div className="search-panel-grid">'''
                  
    new_m_search_start = '''                {/* Search Panel — matches reference image */}
                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>
                    <legend style={{ padding: '0 8px', color: '#50BDC9', fontWeight: '600', fontSize: '15px', marginLeft: '12px' }}>Search</legend>
                  <div className="search-panel-grid">'''
    content = content.replace(old_m_search_start, new_m_search_start)

    # Remove Aggregator in Merchant Portal
    m_agg = '''                    <div className="sp-field">
                      <label>Aggregator</label>
                      <input type="text" className="sp-input" value="PayerMax" readOnly style={{ background: '#f5f5f5', color: '#888', cursor: 'not-allowed' }} />
                    </div>'''
    content = content.replace(m_agg, '')

    # Close fieldset instead of div in Merchant Portal search panel actions
    old_m_search_end = '''                  <div className="search-panel-actions">
                    <button className="btn btn-secondary" onClick={() => setReportFilter({ from: DEFAULT_FROM, to: TODAY_STR, provider: '', disputeType: '', scheme: '', disputeStatus: '', searchBy: '', searchText: '' })}>
                      Reset
                    </button>
                    <button className="btn btn-primary" onClick={() => showToast('Reports filtered!')}>
                      Search
                    </button>
                  </div>
                </div>'''
    
    new_m_search_end = '''                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: 'transparent', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={() => setReportFilter({ from: DEFAULT_FROM, to: TODAY_STR, provider: '', disputeType: '', scheme: '', disputeStatus: '', searchBy: '', searchText: '' })}>
                      Reset
                    </button>
                    <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={() => showToast('Reports filtered!')}>
                      Search
                    </button>
                  </div>
                </fieldset>'''
    content = content.replace(old_m_search_end, new_m_search_end)

    # Update Merchant Portal Tabs
    old_m_tabs = '''                {/* Tab navigation */}
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
                  </div>'''

    new_m_tabs = '''                <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '20px', gap: '32px' }}>
                  <div 
                    style={{ padding: '12px 0', color: reportTab === 'dispute-mgmt' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: reportTab === 'dispute-mgmt' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => setReportTab('dispute-mgmt')}
                  >Dispute Management</div>
                  <div 
                    style={{ padding: '12px 0', color: reportTab === 'doc-pending' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: reportTab === 'doc-pending' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => setReportTab('doc-pending')}
                  >Document pending for Merchant</div>
                  <div 
                    style={{ padding: '12px 0', color: reportTab === 'doc-verification' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: reportTab === 'doc-verification' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => setReportTab('doc-verification')}
                  >Document Pending for Verification</div>
                </div>
                <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>'''
    content = content.replace(old_m_tabs, new_m_tabs)


    # --- 2. Modify Partner Portal ---
    old_p_search_start = '''                <div className="search-panel">
                  <div className="search-panel-title">🔍 Search — Dispute Management</div>
                  <div className="search-panel-grid">'''
    
    new_p_search_start = '''                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>
                    <legend style={{ padding: '0 8px', color: '#50BDC9', fontWeight: '600', fontSize: '15px', marginLeft: '12px' }}>Search</legend>
                  <div className="search-panel-grid">'''
    content = content.replace(old_p_search_start, new_p_search_start)

    p_agg = '''                    <div className="sp-field">
                      <label>Aggregator</label>
                      <input type="text" className="sp-input" value="PayerMax" readOnly style={{ background: '#f5f5f5', color: '#888', cursor: 'not-allowed' }} />
                    </div>'''
    content = content.replace(p_agg, '')

    old_p_search_end = '''                  <div className="search-panel-actions">
                    <button className="btn btn-secondary" onClick={resetPFilter}>Reset</button>
                    <button className="btn btn-primary" onClick={applyPFilter}>Search</button>
                  </div>
                </div>'''

    new_p_search_end = '''                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: 'transparent', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={resetPFilter}>Reset</button>
                    <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={applyPFilter}>Search</button>
                  </div>
                </fieldset>'''
    content = content.replace(old_p_search_end, new_p_search_end)

    # Partner Portal Search by ARN only
    old_p_search_by = '''                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input" value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                        <option value="">Select All</option>
                        <option value="Txn ID">Transaction ID (Txn ID)</option>
                        <option value="RRN">RRN</option>
                        <option value="TID">TID</option>
                        <option value="MID">MID</option>
                        <option value="Case ID">Case ID</option>
                      </select>
                    </div>'''
                    
    new_p_search_by = '''                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input" value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                        <option value="ARN">ARN Number</option>
                      </select>
                    </div>'''
    content = content.replace(old_p_search_by, new_p_search_by)

    # Ensure partner portal active page is set
    content = content.replace("const [filterSearchBy, setFilterSearchBy] = useState('');", "const [filterSearchBy, setFilterSearchBy] = useState('ARN');")


    # Partner Action Constraints: Reject and Upload Evidence ONLY
    old_p_actions = '''                              <button className="btn btn-sm btn-outline" style={{borderColor: '#22c55e', color: '#22c55e'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>Accept Liability</button>
                              <button className="btn btn-sm btn-outline" style={{borderColor: '#ef4444', color: '#ef4444'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action2'); }}>Reject</button>
                              <button className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>'''

    new_p_actions = '''                              <button className="btn btn-sm btn-outline" style={{borderColor: '#ef4444', color: '#ef4444'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action2'); }}>Reject</button>
                              <button className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>'''
    content = content.replace(old_p_actions, new_p_actions)


    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
