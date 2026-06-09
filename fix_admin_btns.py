import sys

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Admin Portal action buttons fix
    old_admin_btns = '''                        {!cb.visaPending && isPendingVerification(cb) && (
                          <>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => setActiveModal('remarks')}>
                              Review Evidence'''
                              
    new_admin_btns = '''                        {!cb.mStatus.includes('Lost') && !cb.mStatus.includes('Won') && !cb.visaPending && isPendingVerification(cb) && (
                          <>
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => setActiveModal('remarks')}>
                              Review Evidence'''
                              
    content = content.replace(old_admin_btns, new_admin_btns)
    
    # getActionBtn fix for Merchant Portal "Take Action"
    old_get_action = '''  const getActionBtn = (cb) => {
    if (cb.visaPending) return <span className="badge badge-won" style={{background: '#e3f2fd', color: '#1976d2'}}>Submitted to Visa</span>;
    if (cb.resolution === 'Lost' || cb.mSubStatus === 'Chargeback Lost' || cb.mSubStatus === 'Arbitration Lost') return <span className="badge badge-resubmit">Accepted (Lost)</span>;'''

    new_get_action = '''  const getActionBtn = (cb) => {
    if (cb.visaPending) return <span className="badge badge-won" style={{background: '#e3f2fd', color: '#1976d2'}}>Submitted to Visa</span>;
    if (cb.mStatus.includes('Lost') || cb.mStatus.includes('Won')) return <span className={`badge ${cb.mStatus.includes('Won') ? 'badge-won' : 'badge-resubmit'}`}>{cb.mStatus}</span>;
    if (cb.resolution === 'Lost' || cb.mSubStatus === 'Chargeback Lost' || cb.mSubStatus === 'Arbitration Lost') return <span className="badge badge-resubmit">Accepted (Lost)</span>;'''
    
    content = content.replace(old_get_action, new_get_action)

    # In AdminPortal, check if there are other places where actions are rendered
    old_admin_esc = '''                        {!cb.mStatus.includes('Arbitration') && cb.mSubStatus !== 'Chargeback Won' && cb.mSubStatus !== 'Chargeback Lost' && !isPendingVerification(cb) && (
                          <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '16px' }}>'''
    
    new_admin_esc = '''                        {!cb.mStatus.includes('Lost') && !cb.mStatus.includes('Won') && !cb.mStatus.includes('Arbitration') && cb.mSubStatus !== 'Chargeback Won' && cb.mSubStatus !== 'Chargeback Lost' && !isPendingVerification(cb) && (
                          <div style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '16px' }}>'''
    content = content.replace(old_admin_esc, new_admin_esc)

    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
