import os

filepath = 'client/src/App.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix Admin Portal top: 0 to top: 'var(--header-h, 60px)' and give fieldset a white background
admin_search = """              <div className="page-inner" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-body, #fff)', paddingTop: '16px', paddingBottom: '8px', margin: '0 -32px', paddingLeft: '32px', paddingRight: '32px' }}>
                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>"""

admin_search_new = """              <div className="page-inner" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ position: 'sticky', top: 'var(--header-h, 60px)', zIndex: 100, background: 'var(--bg-body, #fff)', paddingTop: '16px', paddingBottom: '8px', margin: '0 -32px', paddingLeft: '32px', paddingRight: '32px' }}>
                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative', background: '#fff' }}>"""

content = content.replace(admin_search, admin_search_new)

# 2. Add Sticky Wrapper to Merchant Portal
merchant_search = """                {/* Search Panel — matches reference image */}
                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>"""

merchant_search_new = """                {/* Search Panel — matches reference image */}
                <div style={{ position: 'sticky', top: 'var(--header-h, 60px)', zIndex: 100, background: 'var(--bg-body, #fff)', paddingTop: '16px', paddingBottom: '8px', margin: '0 -32px', paddingLeft: '32px', paddingRight: '32px' }}>
                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative', background: '#fff' }}>"""

content = content.replace(merchant_search, merchant_search_new)

# 3. Close Sticky Wrapper for Merchant Portal
merchant_end = """                    onClick={() => setReportTab('doc-verification')}
                  >Document Pending for Verification</div>
                </div>
                <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>"""

merchant_end_new = """                    onClick={() => setReportTab('doc-verification')}
                  >Document Pending for Verification</div>
                </div>
                </div>
                <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>"""

content = content.replace(merchant_end, merchant_end_new)

# 4. Remove sticky from Admin table header
admin_table_head = """                <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
                  <div className="tbl-wrap">
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderBottom: '1px solid #f0f0f0' }}>"""

admin_table_head_new = """                <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
                  <div className="tbl-wrap">
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead style={{ background: '#fff', zIndex: 10, borderBottom: '1px solid #f0f0f0' }}>"""

content = content.replace(admin_table_head, admin_table_head_new)

# 5. Add Sticky Wrapper to Partner Portal
partner_search = """                <div className="page-hdr">
                  <div><h1>Dispute Reports</h1><p>Search and track all disputes across all merchants</p></div>
                </div>

                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>"""

partner_search_new = """                <div className="page-hdr">
                  <div><h1>Dispute Reports</h1><p>Search and track all disputes across all merchants</p></div>
                </div>

                <div style={{ position: 'sticky', top: 'var(--header-h, 60px)', zIndex: 100, background: 'var(--bg-body, #fff)', paddingTop: '16px', paddingBottom: '8px', margin: '0 -32px', paddingLeft: '32px', paddingRight: '32px' }}>
                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative', background: '#fff' }}>"""

content = content.replace(partner_search, partner_search_new)

# 6. Close Sticky Wrapper for Partner Portal
partner_end = """                    <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={() => showToast('Disputes filtered!')}>Search</button>
                  </div>
                </fieldset>
                    <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>"""

partner_end_new = """                    <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={() => showToast('Disputes filtered!')}>Search</button>
                  </div>
                </fieldset>
                </div>
                    <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>"""

content = content.replace(partner_end, partner_end_new)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Applied sticky header CSS fixes to App.jsx.")
