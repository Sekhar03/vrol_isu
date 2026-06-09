import sys

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove from Partner Portal table
    old_table_actions = '''                                      {!cb.mStatus.includes('Won') && !cb.mStatus.includes('Lost') && !cb.visaPending && (
                                        <>
                                          <button className="btn btn-sm btn-outline" style={{borderColor: '#ef4444', color: '#ef4444'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action2'); }}>Reject</button>
                                          <button className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>
                                        </>
                                      )}'''
    new_table_actions = ''''''
    content = content.replace(old_table_actions, new_table_actions)

    # 2. Add to Partner Portal disputeDetails footer
    old_modal_footer = '''                      {(!cb.mSubStatus.includes('Won') && !cb.mSubStatus.includes('Lost') && cb.mSubStatus !== 'Document Rejected') && !cb.visaPending && (
                        <button onClick={() => setActiveModal('partnerUploadEvidence')} style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
                          Upload Evidence on Behalf of Merchant
                        </button>
                      )}'''
    
    new_modal_footer = '''                      {(!cb.mStatus.includes('Won') && !cb.mStatus.includes('Lost')) && !cb.visaPending && (
                        <>
                          <button style={{ padding: '8px 24px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }} onClick={() => { setActiveModal('action2'); }}>Reject</button>
                          <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }} onClick={() => { setActiveModal('contest'); }}>Upload Evidence</button>
                        </>
                      )}'''
    content = content.replace(old_modal_footer, new_modal_footer)

    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
