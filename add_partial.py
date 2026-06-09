import sys

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find MerchantPortal getActionBtn
    old_m_action_btn = '''        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-sm btn-outline" style={{borderColor: '#22c55e', color: '#22c55e'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>Accept Liability</button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>
        </div>'''
        
    new_m_action_btn = '''        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-sm btn-outline" style={{borderColor: '#22c55e', color: '#22c55e'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>Accept Liability</button>
          <button type="button" className="btn btn-sm btn-outline" style={{borderColor: '#ffb300', color: '#ffb300'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('acceptPartially'); }}>Partial Accept</button>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>
        </div>'''
        
    content = content.replace(old_m_action_btn, new_m_action_btn)

    # Now we need to add the `acceptPartially` modal inside MerchantPortal.
    # We can inject it right before `      {activeModal === 'successEvidence' && (`
    m_modal_anchor = "      {activeModal === 'successEvidence' && ("
    
    partial_accept_modal = '''      {activeModal === 'acceptPartially' && (
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
                    <input type="number" className="mfi" placeholder="e.g. 500" id="m_partial_amt" />
                  </div>
                  <div className="mf" style={{ marginTop: '12px' }}>
                    <label>Remarks (Mandatory)</label>
                    <textarea className="mfi mfi-area" placeholder="Reason for partial acceptance..." id="m_partial_rmk"></textarea>
                  </div>
                  <div className="mf" style={{ marginTop: '12px' }}>
                    <label>Evidence Upload (Mandatory)</label>
                    <input type="file" className="form-control" id="m_partial_file" />
                  </div>
                </div>
                <div className="modal-footer" style={{ display: 'flex', gap: '12px' }}>
                  <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setActiveModal(null)}>Cancel</button>
                  <button className="btn btn-primary" style={{ flex: 2 }} onClick={() => {
                    const amt = document.getElementById('m_partial_amt').value;
                    const rmk = document.getElementById('m_partial_rmk').value;
                    const file = document.getElementById('m_partial_file').files[0];
                    if (!amt || !rmk || !file) {
                      showToast('Amount, Remarks, and Evidence are required for partial acceptance', 'error');
                      return;
                    }
                    showToast('Partial acceptance submitted for Admin approval');
                    setActiveModal(null);
                  }}>Submit for Approval</button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      
'''
    if "      {activeModal === 'acceptPartially' && (" not in content[:content.find('function AdminPortal')]:
        content = content.replace(m_modal_anchor, partial_accept_modal + m_modal_anchor, 1)

    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
