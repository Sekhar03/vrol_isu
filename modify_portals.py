import re

def update_app_jsx():
    filepath = 'client/src/App.jsx'
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to replace the MerchantPortal reports page.
    # It starts with: {activePage === 'reports' && (
    # and ends around line 1895 with: )}
    
    # Let's find the MerchantPortal bounds
    merchant_start = content.find('function MerchantPortal({')
    admin_start = content.find('function AdminPortal({')
    partner_start = content.find('function PartnerPortal({')
    
    # 1. Update filter options to "Select All"
    content = content.replace('<option value="">Select Dispute Type</option>', '<option value="">Select All</option>')
    content = content.replace('<option value="">Select Scheme</option>', '<option value="">Select All</option>')
    content = content.replace('<option value="">Select Dispute Status</option>', '<option value="">Select All</option>')
    content = content.replace('<option value="">Select Search By</option>', '<option value="">Select All</option>')
    
    # 2. Add Auto-Loss logic dynamically to renderStatusBadge
    # We find the renderStatusBadge functions and add the logic.
    # We will replace the status text if it's "Chargeback New" or "Chargeback In Progress" and respondByDate is past
    
    auto_loss_logic = """  const getComputedStatus = (cb) => {
    if ((cb.mSubStatus === 'Chargeback New' || cb.mSubStatus === 'Chargeback In Progress') && cb.respondByDate) {
      if (new Date(cb.respondByDate) < new Date()) {
        return 'Dispute Lost – TAT Expired';
      }
    }
    return cb.mStatus;
  };

  const renderStatusBadge = (s, cb) => {
    const actualStatus = cb ? getComputedStatus(cb) : s;
    s = actualStatus;
"""
    
    # Actually, modifying `renderStatusBadge` is easier if we just replace it globally or inside each portal.
    # Let's just find `const renderStatusBadge = (s) => {` and change it.
    # But wait, it's used as `renderStatusBadge(cb.mStatus)` everywhere. We need it to be `renderStatusBadge(cb.mStatus, cb)`
    # To be safe, we will just update the data fetching/processing part. But it's static demo data.
    # Let's just update `demoFallback.js` to simulate Auto-Loss for one, or we can just do it in the table rendering.
    
    # Let's write the modified MerchantPortal reports page UI
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
        
if __name__ == '__main__':
    update_app_jsx()
