import os
import json

filepath = 'client/src/demoFallback.js'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace CB103 documents
old_cb103_docs = "documents: [{ id: 'doc_103', filename: 'Evidence_103.pdf', uploadedAt: '2026-05-29T10:00:00Z', status: 'Pending Review' }]"
new_cb103_docs = "documents: [{ id: 'doc_103_1', filename: 'Evidence_103.pdf', uploadedAt: '2026-05-29T10:00:00Z', status: 'Pending Review' }, { id: 'doc_103_2', filename: 'Receipt_103.pdf', uploadedAt: '2026-05-29T10:05:00Z', status: 'Pending Review' }, { id: 'doc_103_3', filename: 'CommLog_103.pdf', uploadedAt: '2026-05-29T10:10:00Z', status: 'Pending Review' }]"
content = content.replace(old_cb103_docs, new_cb103_docs)

# Replace CB_PEND_2 documents
old_pend2_docs = "documents: [{ id: 'doc_pend2', filename: 'ServiceInvoice.pdf', uploadedAt: '2026-05-30T14:00:00Z', status: 'Pending Review' }]"
new_pend2_docs = "documents: [{ id: 'doc_pend2_1', filename: 'ServiceInvoice.pdf', uploadedAt: '2026-05-30T14:00:00Z', status: 'Pending Review' }, { id: 'doc_pend2_2', filename: 'ContractAgreement.pdf', uploadedAt: '2026-05-30T14:05:00Z', status: 'Pending Review' }, { id: 'doc_pend2_3', filename: 'DeliveryProof.pdf', uploadedAt: '2026-05-30T14:10:00Z', status: 'Pending Review' }]"
content = content.replace(old_pend2_docs, new_pend2_docs)

# Add new pending cases
new_cases = """
    { id: 'CB_PEND_3', caseId: 'CASE000993', userName: 'masteruser', rrn: '1234567812', txnId: '500003', txnDate: '2026-05-26', createdDate: '2026-06-01', respondByDate: '2026-06-10', mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback In Progress', txnAmt: 1500, adjAmt: 1500, product: 'VISA', merchantAction: 'evidence', acquirerAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [], documents: [{ id: 'doc_pend3_1', filename: 'Evidence_1.pdf', uploadedAt: '2026-06-01T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend3_2', filename: 'Evidence_2.pdf', uploadedAt: '2026-06-01T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend3_3', filename: 'Evidence_3.pdf', uploadedAt: '2026-06-01T10:00:00Z', status: 'Pending Review' }] },
    { id: 'CB_PEND_4', caseId: 'CASE000994', userName: 'Test@isu', rrn: '1234567813', txnId: '500004', txnDate: '2026-05-26', createdDate: '2026-06-02', respondByDate: '2026-06-11', mStatus: 'Pre-Arbitration Raise', mSubStatus: 'Chargeback In Progress', txnAmt: 2500, adjAmt: 2500, product: 'VISA', merchantAction: 'evidence', acquirerAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [], documents: [{ id: 'doc_pend4_1', filename: 'Doc_A.pdf', uploadedAt: '2026-06-02T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend4_2', filename: 'Doc_B.pdf', uploadedAt: '2026-06-02T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend4_3', filename: 'Doc_C.pdf', uploadedAt: '2026-06-02T10:00:00Z', status: 'Pending Review' }] },
    { id: 'CB_PEND_5', caseId: 'CASE000995', userName: 'masteruser', rrn: '1234567814', txnId: '500005', txnDate: '2026-05-27', createdDate: '2026-06-03', respondByDate: '2026-06-12', mStatus: 'Arbitration Raise', mSubStatus: 'Chargeback In Progress', txnAmt: 3500, adjAmt: 3500, product: 'VISA', merchantAction: 'evidence', acquirerAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [], documents: [{ id: 'doc_pend5_1', filename: 'Receipt_copy.pdf', uploadedAt: '2026-06-03T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend5_2', filename: 'Terms.pdf', uploadedAt: '2026-06-03T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend5_3', filename: 'Invoice.pdf', uploadedAt: '2026-06-03T10:00:00Z', status: 'Pending Review' }] },
    { id: 'CB_PEND_6', caseId: 'CASE000996', userName: 'Test@isu', rrn: '1234567815', txnId: '500006', txnDate: '2026-05-27', createdDate: '2026-06-04', respondByDate: '2026-06-13', mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback In Progress', txnAmt: 4500, adjAmt: 4500, product: 'VISA', merchantAction: 'evidence', acquirerAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [], documents: [{ id: 'doc_pend6_1', filename: 'Customer_Comm.pdf', uploadedAt: '2026-06-04T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend6_2', filename: 'Shipping_Label.pdf', uploadedAt: '2026-06-04T10:00:00Z', status: 'Pending Review' }, { id: 'doc_pend6_3', filename: 'Tracking.pdf', uploadedAt: '2026-06-04T10:00:00Z', status: 'Pending Review' }] },
"""
content = content.replace("  chargebacks: [", "  chargebacks: [\n" + new_cases)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

# Now, also fix App.jsx fallback so if there is NO documents array it shows 3.
app_path = 'client/src/App.jsx'
with open(app_path, 'r', encoding='utf-8') as f:
    app_content = f.read()

fallback_old = """                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #eaeaea', borderRadius: '6px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#ccc' }}>📄</span>
                          <span style={{ fontSize: '14px', color: '#333' }}>{cb.merchantAction === 'evidence' ? 'Merchant_Evidence_Submitted.pdf' : 'Merchant_Evidence.pdf'}</span>
                        </div>
                        <button type="button" style={{ background: '#fff', border: '1px solid #ddd', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => showToast('Downloading Evidence File...', 'success')}>
                          ⬇ Download
                        </button>
                      </div>"""

fallback_new = """                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #eaeaea', borderRadius: '6px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#ccc' }}>📄</span>
                          <span style={{ fontSize: '14px', color: '#333' }}>{cb.merchantAction === 'evidence' ? 'Merchant_Evidence_Submitted_1.pdf' : 'Merchant_Evidence_1.pdf'}</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#faad14', marginLeft: '4px' }}>Pending Review</span>
                        </div>
                        <button type="button" style={{ background: '#fff', border: '1px solid #ddd', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => showToast('Downloading Evidence File 1...', 'success')}>
                          ⬇ Download
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #eaeaea', borderRadius: '6px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#ccc' }}>📄</span>
                          <span style={{ fontSize: '14px', color: '#333' }}>{cb.merchantAction === 'evidence' ? 'Merchant_Evidence_Submitted_2.pdf' : 'Merchant_Evidence_2.pdf'}</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#faad14', marginLeft: '4px' }}>Pending Review</span>
                        </div>
                        <button type="button" style={{ background: '#fff', border: '1px solid #ddd', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => showToast('Downloading Evidence File 2...', 'success')}>
                          ⬇ Download
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', border: '1px solid #eaeaea', borderRadius: '6px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#ccc' }}>📄</span>
                          <span style={{ fontSize: '14px', color: '#333' }}>{cb.merchantAction === 'evidence' ? 'Merchant_Evidence_Submitted_3.pdf' : 'Merchant_Evidence_3.pdf'}</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#faad14', marginLeft: '4px' }}>Pending Review</span>
                        </div>
                        <button type="button" style={{ background: '#fff', border: '1px solid #ddd', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => showToast('Downloading Evidence File 3...', 'success')}>
                          ⬇ Download
                        </button>
                      </div>"""

app_content = app_content.replace(fallback_old, fallback_new)

with open(app_path, 'w', encoding='utf-8') as f:
    f.write(app_content)

print("Updated demoFallback.js and App.jsx")
