import sys

def main():
    with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Find the malformed Partner search actions
    old_actions = '''                  <div className="search-panel-actions">
                    <button className="btn btn-secondary" onClick={() => { setFilterFrom(DEFAULT_FROM); setFilterTo(TODAY_STR); setFilterStatus(''); setFilterScheme(''); setFilterDisputeType(''); setFilterSearchBy(''); setFilterSearchText(''); setFilterMerchant(''); }}>Reset</button>
                    <button className="btn btn-primary" onClick={() => showToast('Disputes filtered!')}>Search</button>'''
                    
    new_actions = '''                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                    <button style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: 'transparent', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={() => { setFilterFrom(DEFAULT_FROM); setFilterTo(TODAY_STR); setFilterStatus(''); setFilterScheme(''); setFilterDisputeType(''); setFilterSearchBy(''); setFilterSearchText(''); setFilterMerchant(''); }}>Reset</button>
                    <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={() => showToast('Disputes filtered!')}>Search</button>
                  </div>
                </fieldset>'''
                
    content = content.replace(old_actions, new_actions)
    
    # Also fix the Partner Portal table headers
    old_p_thead_wrong = '''                    <table>
                      <thead>
                        <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #e0e0e0' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Case ID</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>RR Number</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Transaction Date & Time</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Dispute Date</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Txn Currency</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Amount</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Current Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>TAT</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 'bold', color: '#000', fontSize: '13px' }}>Action</th>
                        </tr>
                      </thead>'''
                      
    admin_table_headers = '''                    <div className="tbl-card" style={{ boxShadow: 'none', border: 'none', background: 'transparent' }}>
                    <div className="tbl-wrap">
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead>
                        <tr style={{ color: '#4a148c', fontSize: '11px', textAlign: 'left', background: 'transparent' }}>
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
                        </tr>
                      </thead>'''
    content = content.replace(old_p_thead_wrong, admin_table_headers)
    
    # And replace the body of the partner portal table too
    old_p_tbody_wrong = '''                          <tr key={cb.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px 16px', color: '#50BDC9', fontWeight: '600' }}>{cb.caseId}</td>
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
                            </td>
                          </tr>'''
                          
    new_p_tbody_wrong = '''                          <tr key={cb.id} style={{ borderBottom: '1px solid #eee' }}>
                                  <td style={{ padding: '12px 8px', color: '#4a148c', fontWeight: '600' }}>{(cb.id || 'XXXX').substring(0, 8).toUpperCase()}</td>
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
                                  </td>
                          </tr>'''
    content = content.replace(old_p_tbody_wrong, new_p_tbody_wrong)

    # Need to add the closing divs for tbl-card that we opened
    content = content.replace('''                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}''', '''                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}''') # wait, they're identical. I just added `<div className="tbl-card">` in header. I need to close it.
          
    # Actually, the original ended with `</table>` but now we wrapped `<table>` inside `<div className="tbl-card"> <div className="tbl-wrap">`
    # Let's fix that too.
    content = content.replace('                    </table>', '                    </table>\n                  </div>\n                  </div>')

    with open('client/src/App.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    main()
