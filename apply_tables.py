import sys

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # The Admin Portal Table headers:
    admin_table_headers = '''                        <tr style={{ color: '#4a148c', fontSize: '11px', textAlign: 'left', background: 'transparent' }}>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Case ID</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Visa ID</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Dispute Date</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Scheme</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Dispute Type</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Merchant Name</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>MID</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>ARN</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Dispute Status</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>TXN Ref. Number</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>Remaining Days</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>TID</th>
                          <th style={{ padding: '12px 8px', fontWeight: '700' }}>View / Actions</th>
                        </tr>'''
                        
    # Replace Merchant Portal table heads
    old_m_thead1 = '''                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Case ID</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>AR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>RR Number</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Transaction Date & Time</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Dispute Date</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Txn Currency</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Amount</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Current Status</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>TAT</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Action</th>
                            </tr>'''
                            
    content = content.replace(old_m_thead1, admin_table_headers)
    
    # We need to map Merchant table rows
    old_m_tbody = '''                                <td style={{ padding: '12px 16px', color: '#50BDC9', fontWeight: '600' }}>{cb.caseId}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.rrn}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.txnDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{formatDateDisp(cb.createdDate)}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>INR</td>
                                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{cb.txnAmt}</td>
                                <td style={{ padding: '12px 16px', color: '#333' }}>{cb.mStatus}</td>
                                <td style={{ padding: '12px 16px' }}>
                                  <span style={{ color: cb.aging > 5 ? 'var(--red)' : 'var(--yellow)', fontWeight: '600' }}>
                                    {cb.aging}d
                                  </span>
                                </td>
                                <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#50BDC9', fontSize: '16px' }} onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>
                                    👁
                                  </button>
                                </td>'''
                                
    new_m_tbody = '''                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{(cb.id || 'XXXX').substring(0, 8).toUpperCase()}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.visaId || '-'}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{formatDateDisp(cb.createdDate || cb.txnDate)}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>Visa</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.mSubStatus || 'Chargeback'}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.userName}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>ISU-{(cb.userName || '9999').substring(0,4).toUpperCase()}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.arn || cb.rrn}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{renderStatusBadge(cb.mStatus)}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.txnId}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>
                                    {cb.respondByDate ? Math.max(0, Math.ceil((new Date(cb.respondByDate) - new Date()) / (1000 * 60 * 60 * 24))) + ' Days' : '-'}
                                  </td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>TID-{(cb.userId || cb.userName || '9999').substring(0,4).toUpperCase()}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#50BDC9', fontSize: '16px' }} onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>
                                      👁
                                    </button>
                                  </td>'''
    content = content.replace(old_m_tbody, new_m_tbody)

    # For partner portal:
    # They have 'p-disputes' table
    old_p_thead = '''                            <tr>
                              <th>Case ID</th>
                              <th>Merchant</th>
                              <th>RRN</th>
                              <th>Txn ID</th>
                              <th>Status</th>
                              <th>Adj Amount</th>
                              <th>Details</th>
                              <th>Action</th>
                            </tr>'''
                            
    content = content.replace(old_p_thead, admin_table_headers)
    
    old_p_tbody = '''                                <td>{cb.caseId}</td>
                                <td>{cb.userName}</td>
                                <td className="mono">{cb.rrn}</td>
                                <td className="mono">{cb.txnId}</td>
                                <td>{renderStatusBadge(cb.mStatus)}</td>
                                <td><strong>{formatINR(cb.adjAmt)}</strong></td>
                                <td>
                                  <button className="info-btn" onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>ℹ</button>
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    {cb.mSubStatus !== 'Chargeback Won' && cb.mSubStatus !== 'Chargeback Lost' && (
                                      <>
                                        {cb.visaPending ? (
                                          <button className="btn btn-sm btn-outline" style={{borderColor: '#22c55e', color: '#22c55e'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>Accept (Visa)</button>
                                        ) : (
                                          <>
                                            <button className="btn btn-sm btn-outline" style={{borderColor: '#22c55e', color: '#22c55e'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action1'); }}>Accept Liability</button>
                                            <button className="btn btn-sm btn-outline" style={{borderColor: '#ef4444', color: '#ef4444'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action2'); }}>Reject</button>
                                            <button className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>
                                          </>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>'''
                                
    new_p_tbody = '''                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{(cb.id || 'XXXX').substring(0, 8).toUpperCase()}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.visaId || '-'}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{formatDateDisp(cb.createdDate || cb.txnDate)}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>Visa</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.mSubStatus || 'Chargeback'}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.userName}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>ISU-{(cb.userName || '9999').substring(0,4).toUpperCase()}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.arn || cb.rrn}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{renderStatusBadge(cb.mStatus)}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{cb.txnId}</td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>
                                    {cb.respondByDate ? Math.max(0, Math.ceil((new Date(cb.respondByDate) - new Date()) / (1000 * 60 * 60 * 24))) + ' Days' : '-'}
                                  </td>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>TID-{(cb.userId || cb.userName || '9999').substring(0,4).toUpperCase()}</td>
                                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#50BDC9', fontSize: '16px' }} onClick={() => { setActiveModal('disputeDetails'); setTargetDisputeId(cb.id); }}>👁</button>
                                      {cb.mSubStatus !== 'Chargeback Won' && cb.mSubStatus !== 'Chargeback Lost' && !cb.visaPending && (
                                        <>
                                          <button className="btn btn-sm btn-outline" style={{borderColor: '#ef4444', color: '#ef4444'}} onClick={() => { setTargetDisputeId(cb.id); setActiveModal('action2'); }}>Reject</button>
                                          <button className="btn btn-sm btn-outline" onClick={() => { setTargetDisputeId(cb.id); setActiveModal('contest'); }}>Upload Evidence</button>
                                        </>
                                      )}
                                    </div>
                                  </td>'''
    # We may need a fallback if old_p_tbody doesn't match perfectly, but this is an exact match for demo fallback.
    if old_p_tbody in content:
        content = content.replace(old_p_tbody, new_p_tbody)
        
    # Also add "Partial Accept" modal for Merchant
    # Admin has `<button ... onClick={() => { setTargetDisputeId(cb.id); setActiveModal('remarks'); }}>Review</button>`
    # Merchant should have `<button ... onClick={() => { setTargetDisputeId(cb.id); setActiveModal('partialAccept'); }}>Partial Accept</button>`
    # Where does Merchant define Modals? At the bottom of `App.jsx`, `App` component renders Modals!
    
    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)
        
if __name__ == '__main__':
    main()
