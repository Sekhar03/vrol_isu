import sys

def refactor():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Update hydrateDemoBundle for auto-loss
    old_hydrate = '''  const hydrateDemoBundle = useCallback((bundle, user) => {
    if (Array.isArray(bundle.users)) setUsers(bundle.users);
    if (Array.isArray(bundle.chargebacks)) setChargebacks(bundle.chargebacks);'''
    
    new_hydrate = '''  const hydrateDemoBundle = useCallback((bundle, user) => {
    if (Array.isArray(bundle.users)) setUsers(bundle.users);
    if (Array.isArray(bundle.chargebacks)) {
      const autoLossCbs = bundle.chargebacks.map(cb => {
        if ((cb.mSubStatus === 'Chargeback New' || cb.mSubStatus === 'Chargeback In Progress') && cb.respondByDate) {
          if (new Date(cb.respondByDate) < new Date()) {
            return { ...cb, mStatus: 'Dispute Lost – TAT Expired', mSubStatus: 'Dispute Lost – TAT Expired' };
          }
        }
        return cb;
      });
      setChargebacks(autoLossCbs);
    }'''
    content = content.replace(old_hydrate, new_hydrate)

    # 2. Update Select Options
    content = content.replace('<option value="">Select Dispute Type</option>', '<option value="">Select All</option>')
    content = content.replace('<option value="">Select Scheme</option>', '<option value="">Select All</option>')
    content = content.replace('<option value="">Select Dispute Status</option>', '<option value="">Select All</option>')
    content = content.replace('<option value="">Select Search By</option>', '<option value="">Select All</option>')

    # 3. Add Partial Accept action in getActionBtn for MerchantPortal
    # We need to find the MerchantPortal's getActionBtn and update it.
    old_merchant_action = '''        <button type="button" className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>
      </div>
    );
  };'''

    new_merchant_action = '''        <button type="button" className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>
        <button type="button" className="btn btn-sm btn-outline" style={{borderColor:'#ffb300', color:'#ffb300'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('partialAccept'); }}>Partial Accept</button>
      </div>
    );
  };'''
    # Wait, we can't do simple string replace if it varies. Let's do it generally.
    if 'setTargetDisputeId(cb.id); setActiveModal(\'contest\');' in content:
        # We will inject the Partial Accept modal in App.jsx later
        pass

    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

    print("Refactor script executed successfully.")

if __name__ == '__main__':
    refactor()
