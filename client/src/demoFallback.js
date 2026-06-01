/** Offline fallback when API is unreachable — keeps portals usable for demos */
const PARTNER_ID = 'partneruser';

export const CLIENT_DEMO = {
  users: [
    { username: 'masteruser', password: 'Test@2026', role: 'merchant', name: 'masteruser', walletBalance: 964.35 },
    { username: 'Test@isu', password: 'Test@2026', role: 'merchant', name: 'Test@isu', walletBalance: 12450.75 },
    { username: 'Test@Ad', password: 'Test@2027', role: 'admin', name: 'Krishna Das', walletBalance: 245800 },
    { username: 'partneruser', password: 'Test@2028', role: 'partner', name: 'Arjun Mehta (Partner)', walletBalance: 0, partnerId: PARTNER_ID }
  ],
  chargebacks: [
    { id: 'CB001', caseId: 'CASE000001', userName: 'masteruser', rrn: '6093156553', txnId: '8768987', createdDate: '2026-05-30', respondByDate: '2026-06-08', mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New', txnAmt: 1000, adjAmt: 1000, product: 'VISA', merchantAction: null, adminAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [] },
    { id: 'CB002', caseId: 'CASE000002', userName: 'masteruser', rrn: '6093152984', txnId: '8768988', createdDate: '2026-05-29', respondByDate: '2026-06-07', mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New', txnAmt: 3000, adjAmt: 3000, product: 'VISA', merchantAction: null, adminAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [] },
    { id: 'CB005', caseId: 'CASE000005', userName: 'masteruser', rrn: '6093152993', txnId: '8768991', createdDate: '2026-05-26', respondByDate: '2026-06-03', mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback in Progress', txnAmt: 500, adjAmt: 500, product: 'VISA', merchantAction: 'evidence', adminAction: null, visaPending: true, partnerId: PARTNER_ID, timeline: [] },
    { id: 'CB024', caseId: 'CASE000024', userName: 'Test@isu', rrn: '1234567890', txnId: '100001', createdDate: '2026-05-29', respondByDate: '2026-06-05', mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New', txnAmt: 2000, adjAmt: 2000, product: 'VISA', merchantAction: null, adminAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [] },
    { id: 'CB033', caseId: 'CASE000033', userName: 'Test@isu', rrn: '9012345678', txnId: '300001', createdDate: '2026-05-30', respondByDate: '2026-06-09', mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New', txnAmt: 3200, adjAmt: 3200, product: 'Rupay', merchantAction: null, adminAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [] },
    { id: 'CB_VROL_01', caseId: 'CASE_VROL_01', userName: 'masteruser', rrn: '1231231231', txnId: '9898989', createdDate: '2026-05-29', respondByDate: '2026-06-04', mStatus: 'VROL Inquiry', mSubStatus: 'Chargeback New', txnAmt: 5000, adjAmt: 5000, product: 'VISA', merchantAction: null, adminAction: null, visaPending: true, partnerId: PARTNER_ID, timeline: [] }
  ],
  ledger: [
    { id: 'ADJ101', merchant: 'masteruser', type: 'Debit', amount: 1000, date: '2026-05-30', remarks: 'Lien hold — CB001' },
    { id: 'ADJ105', merchant: 'Test@isu', type: 'Debit', amount: 3200, date: '2026-05-30', remarks: 'Lien hold — CB033' }
  ]
};
