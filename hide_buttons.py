import sys

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Sort autoLossCbs
    old_sort = '''      setChargebacks(autoLossCbs);'''
    new_sort = '''      autoLossCbs.sort((a, b) => {
        const aResolved = a.mStatus.includes('Lost') || a.mStatus.includes('Won');
        const bResolved = b.mStatus.includes('Lost') || b.mStatus.includes('Won');
        if (aResolved && !bResolved) return 1;
        if (!aResolved && bResolved) return -1;
        return new Date(b.createdDate || b.txnDate) - new Date(a.createdDate || a.txnDate);
      });
      setChargebacks(autoLossCbs);'''
    if "autoLossCbs.sort" not in content:
        content = content.replace(old_sort, new_sort)
        
    # 2. Hide Action Buttons in MerchantPortal Modal
    # Line 2060 block:
    m_action1 = '''{reportTab === 'doc-pending' && ('''
    new_m_action1 = '''{reportTab === 'doc-pending' && !cb.mStatus.includes('Lost') && !cb.mStatus.includes('Won') && ('''
    content = content.replace(m_action1, new_m_action1)

    m_action2 = '''{reportTab === 'doc-verification' && (cb.acquirerAction === 'evidence_uploaded' || (cb.documents && cb.documents.some(d => d.uploadedBy === 'Admin' && d.status === 'Pending Review'))) && ('''
    new_m_action2 = '''{reportTab === 'doc-verification' && !cb.mStatus.includes('Lost') && !cb.mStatus.includes('Won') && (cb.acquirerAction === 'evidence_uploaded' || (cb.documents && cb.documents.some(d => d.uploadedBy === 'Admin' && d.status === 'Pending Review'))) && ('''
    content = content.replace(m_action2, new_m_action2)

    m_action3 = '''{reportTab === 'doc-verification' && cb.acquirerAction !== 'evidence_uploaded' && !(cb.documents && cb.documents.some(d => d.uploadedBy === 'Admin' && d.status === 'Pending Review')) && ('''
    new_m_action3 = '''{reportTab === 'doc-verification' && !cb.mStatus.includes('Lost') && !cb.mStatus.includes('Won') && cb.acquirerAction !== 'evidence_uploaded' && !(cb.documents && cb.documents.some(d => d.uploadedBy === 'Admin' && d.status === 'Pending Review')) && ('''
    content = content.replace(m_action3, new_m_action3)

    # In PartnerPortal, the actions are rendered in the table directly:
    p_action = '''                                      {cb.mSubStatus !== 'Chargeback Won' && cb.mSubStatus !== 'Chargeback Lost' && !cb.visaPending && ('''
    new_p_action = '''                                      {!cb.mStatus.includes('Won') && !cb.mStatus.includes('Lost') && !cb.visaPending && ('''
    content = content.replace(p_action, new_p_action)
    
    # Wait, Merchant Portal also has action buttons we added via `add_partial.py` in `getActionBtn` maybe?
    # No, `add_partial.py` replaced `old_m_action_btn` which was in `App.jsx`
    # Let's search where `add_partial.py` replaced it. It was around line 2080 but I didn't see it when I viewed lines 2050-2080!
    # Ah! `add_partial.py` found `old_m_action_btn` which was actually in `PartnerPortal`? No!
    # Let's just blindly replace any `!cb.mStatus.includes('Lost')` if not present.
    # Actually, in Merchant portal, my `add_partial.py` didn't find the exact match! Wait!
    
    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
