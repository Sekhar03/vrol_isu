import os

filepath = 'client/src/App.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add partnerTab state
content = content.replace("const [adminTab, setAdminTab] = useState('management');", "const [adminTab, setAdminTab] = useState('management');\n  const [partnerTab, setPartnerTab] = useState('management');")

# 2. Add filter logic for partnerTab
old_filter_end = """    if (filterFrom && cb.createdDate && cb.createdDate < filterFrom) return false;
    if (filterTo && cb.createdDate && cb.createdDate > filterTo) return false;
    return true;
  });"""

new_filter_end = """    if (filterFrom && cb.createdDate && cb.createdDate < filterFrom) return false;
    if (filterTo && cb.createdDate && cb.createdDate > filterTo) return false;

    if (partnerTab === 'merchant-pending') {
      if (!((!cb.mStatus.includes('Lost') && !cb.mStatus.includes('Won')) && (!cb.merchantAction || (cb.acquirerAction === 'considered' && cb.merchantAction !== 'additional_evidence')) && !cb.visaPending)) return false;
    } else if (partnerTab === 'verification-pending') {
      if (!((!cb.mStatus.includes('Lost') && !cb.mStatus.includes('Won')) && (cb.merchantAction === 'evidence' || cb.merchantAction === 'rejected' || cb.merchantAction === 'additional_evidence' || cb.merchantAction === 'rejected_admin') && cb.acquirerAction === null && !cb.visaPending)) return false;
    }

    return true;
  });"""
content = content.replace(old_filter_end, new_filter_end)

# 3. Fix Search By dropdown
old_dropdown = """                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input" value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                        <option value="ARN">ARN Number</option>
                      </select>
                    </div>"""

new_dropdown = """                    <div className="sp-field">
                      <label>Search By</label>
                      <select className="sp-input" value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                        <option value="">Select Field...</option>
                        <option value="ARN">ARN Number</option>
                      </select>
                    </div>"""
content = content.replace(old_dropdown, new_dropdown)

# 4. Insert Tabs UI
old_table_start = """                </div>
                    <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
                    <div className="tbl-wrap">"""

tabs_ui = """                </div>
                <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', marginBottom: '20px', gap: '32px' }}>
                  <div 
                    style={{ padding: '12px 0', color: partnerTab === 'management' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: partnerTab === 'management' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => { setPartnerTab('management'); }}
                  >
                    All Disputes
                  </div>
                  <div 
                    style={{ padding: '12px 0', color: partnerTab === 'merchant-pending' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: partnerTab === 'merchant-pending' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => { setPartnerTab('merchant-pending'); }}
                  >
                    Document Pending from Merchant
                  </div>
                  <div 
                    style={{ padding: '12px 0', color: partnerTab === 'verification-pending' ? '#4a148c' : '#9e9e9e', fontWeight: '700', fontSize: '15px', borderBottom: partnerTab === 'verification-pending' ? '3px solid #4a148c' : 'none', cursor: 'pointer' }}
                    onClick={() => { setPartnerTab('verification-pending'); }}
                  >
                    Document verification Pending From Admin
                  </div>
                </div>
                    <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
                    <div className="tbl-wrap">"""

content = content.replace(old_table_start, tabs_ui)

# 5. Change "View / Actions" to "View"
old_th = "<th style={{ padding: '12px 8px', fontWeight: '700' }}>View / Actions</th>"
new_th = "<th style={{ padding: '12px 8px', fontWeight: '700' }}>View</th>"

# Only want to replace this inside the partner table, which we know is near the tabs UI we just added.
# Let's find the specific block and replace it.
partner_table_start = content.find("Document verification Pending From Admin")
partner_th_idx = content.find(old_th, partner_table_start)

if partner_th_idx != -1:
    content = content[:partner_th_idx] + new_th + content[partner_th_idx + len(old_th):]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated partner portal UI and logic")
