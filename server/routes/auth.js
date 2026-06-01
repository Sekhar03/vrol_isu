const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Chargeback = require('../models/Chargeback');
const Ledger = require('../models/Ledger');

// Fetch all users
router.get('/', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Fetch a single user by username
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Helper: build all chargeback seed records ─────────────────────────────────
const buildSeedData = (TODAY) => {
  const fmtDate = d => d.toISOString().split('T')[0];
  const dA = n => { let d = new Date(TODAY); d.setDate(d.getDate() - n); return fmtDate(d); };
  const dL = n => fmtDate(new Date(TODAY.getTime() + n * 86400000));

  return [
    // CB001 — VISA · New · Awaiting merchant action
    {
      id: 'CB001', caseId: 'CASE000001', userName: 'masteruser', userId: '2575789089',
      rrn: '6093156553', txnId: '8768987', terminalId: '5683583',
      beneMobile: '9348909106', remMobile: '7845695654',
      createdDate: dA(1), txnDate: dA(5), adjDate: dA(1), respondByDate: dL(8),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New',
      adjType: 'Chargeback Raise', remitter: 'AXB', beneficiary: 'FIP',
      txnAmt: 1000, adjAmt: 1000, glNo: '354422',
      currency: 'Rupees', reasonCode: '4808', pan: '832927*****',
      product: 'VISA', aging: 1,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(1) + ' 10:30 AM', title: 'Dispute Raised by iServeU', remarks: 'Chargeback initiated for VISA txn', file: null },
        { by: 'iServeU', time: dA(1) + ' 05:30 PM', title: 'Lien Amount Applied', remarks: 'Hold placed on merchant wallet pending resolution', file: 'LienNotice.pdf' }
      ]
    },
    // CB002 — VISA · New · Awaiting merchant action
    {
      id: 'CB002', caseId: 'CASE000002', userName: 'masteruser', userId: '2575789089',
      rrn: '6093152984', txnId: '8768988', terminalId: '5688584',
      beneMobile: '9348909107', remMobile: '7845695653',
      createdDate: dA(2), txnDate: dA(6), adjDate: dA(2), respondByDate: dL(7),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New',
      adjType: 'Chargeback Raise', remitter: 'AXB', beneficiary: 'FIP',
      txnAmt: 3000, adjAmt: 3000, glNo: '354422',
      currency: 'Rupees', reasonCode: '4808', pan: '832927*****',
      product: 'VISA', aging: 2,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(2) + ' 09:00 AM', title: 'Dispute Raised by iServeU', remarks: 'Customer reported unauthorized debit of Rs.3000', file: null }
      ]
    },
    // CB003 — VISA · Chargeback Lost · Declined by admin
    {
      id: 'CB003', caseId: 'CASE000003', userName: 'masteruser', userId: '2575789089',
      rrn: '6093152911', txnId: '8768989', terminalId: '5678585',
      beneMobile: '9398909108', remMobile: '7845665652',
      createdDate: dA(10), txnDate: dA(15), adjDate: dA(10), respondByDate: dA(2),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback Lost',
      adjType: 'Chargeback Raise', remitter: 'AXB', beneficiary: 'FIP',
      txnAmt: 1500, adjAmt: 1500, glNo: '354422',
      currency: 'Rupees', reasonCode: '4808', pan: '397927*****',
      product: 'VISA', aging: 10,
      merchantAction: 'rejected', adminAction: 'declined', visaPending: false,
      chargbackId: 'CommonVISA17268', adminName: 'Krishna Das',
      rejectReason: 'Transaction log confirms delivery of service to registered customer mobile. Dispute ruled in acquirer favour by NPCI.',
      timeline: [
        { by: 'iServeU', time: dA(10) + ' 08:00 AM', title: 'Dispute Raised', remarks: 'Customer claims unauthorized VISA debit', file: null },
        { by: 'masteruser', time: dA(8) + ' 10:00 AM', title: 'Evidence Submitted by masteruser', remarks: 'Delivery proof and transaction log attached', file: 'EvidenceFile.pdf' },
        { by: 'Krishna Das', time: dA(5) + ' 03:00 PM', title: 'Admin Reviewed — Declined', remarks: 'Evidence insufficient. Case ruled in favour of customer.', file: 'AdminDecision.pdf' }
      ]
    },
    // CB004 — VISA · Pre-Arbitration · New
    {
      id: 'CB004', caseId: 'CASE000004', userName: 'masteruser', userId: '2575789089',
      rrn: '6093152992', txnId: '8768990', terminalId: '5688585',
      beneMobile: '9348909108', remMobile: '7845695652',
      createdDate: dA(4), txnDate: dA(8), adjDate: dA(4), respondByDate: dL(3),
      mStatus: 'Pre-Arbitration Raise', mSubStatus: 'Chargeback New',
      adjType: 'Pre-Arbitration Raise', remitter: 'HDFC', beneficiary: 'FIP',
      txnAmt: 2500, adjAmt: 2500, glNo: '354423',
      currency: 'Rupees', reasonCode: '4853', pan: '456712*****',
      product: 'VISA', aging: 4,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(4) + ' 08:30 AM', title: 'Pre-Arbitration Raised', remarks: 'Escalated to Pre-Arb stage after initial chargeback rejection', file: null }
      ]
    },
    // CB005 — VISA · In Progress · Evidence submitted → Visa pending
    {
      id: 'CB005', caseId: 'CASE000005', userName: 'masteruser', userId: '2575789089',
      rrn: '6093152993', txnId: '8768991', terminalId: '5683583',
      beneMobile: '9348909106', remMobile: '7845695654',
      createdDate: dA(5), txnDate: dA(9), adjDate: dA(5), respondByDate: dL(2),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback in Progress',
      adjType: 'Chargeback Raise', remitter: 'ICICI', beneficiary: 'FIP',
      txnAmt: 500, adjAmt: 500, glNo: '354422',
      currency: 'Rupees', reasonCode: '1', pan: '832927*****',
      product: 'VISA', aging: 5,
      merchantAction: 'evidence', adminAction: null, visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(5) + ' 09:00 AM', title: 'Dispute Raised', remarks: 'Customer dispute: service not received', file: null },
        { by: 'masteruser', time: dA(3) + ' 11:45 AM', title: 'Evidence Submitted by masteruser (Partner Representation)', remarks: 'Delivery proof submitted — Evidence forwarded to Acquirer on behalf of Partner for Visa consideration.', file: 'EvidenceSubmitted.pdf' }
      ]
    },
    // CB006 — Mastercard · Arbitration · New
    {
      id: 'CB006', caseId: 'CASE000006', userName: 'masteruser', userId: '2575789089',
      rrn: '6093152994', txnId: '8768992', terminalId: '5688584',
      beneMobile: '9348909107', remMobile: '7845695653',
      createdDate: dA(6), txnDate: dA(10), adjDate: dA(6), respondByDate: dL(4),
      mStatus: 'Arbitration Raise', mSubStatus: 'Chargeback New',
      adjType: 'Arbitration Raise', remitter: 'AXIS', beneficiary: 'FIP',
      txnAmt: 3000, adjAmt: 3000, glNo: '354424',
      currency: 'Rupees', reasonCode: '4808', pan: '545454*****',
      product: 'Mastercard', aging: 6,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(6) + ' 08:00 AM', title: 'Arbitration Raised', remarks: 'Escalated to Mastercard Arbitration panel after Pre-Arb failure', file: null },
        { by: 'iServeU', time: dA(4) + ' 02:00 PM', title: 'Awaiting Mastercard Ruling', remarks: 'Pending card scheme arbitration decision', file: null }
      ]
    },
    // CB007 — VISA · Refund Success · Won
    {
      id: 'CB007', caseId: 'CASE000007', userName: 'masteruser', userId: '2575789089',
      rrn: '7045218834', txnId: '9912345', terminalId: '5690001',
      beneMobile: '9876543210', remMobile: '9123456789',
      createdDate: dA(20), txnDate: dA(25), adjDate: dA(20), respondByDate: dA(10),
      mStatus: 'Chargeback Raise', mSubStatus: 'Refund Success',
      adjType: 'Chargeback Raise', remitter: 'SBI', beneficiary: 'FIP',
      txnAmt: 8500, adjAmt: 8500, glNo: '354425',
      currency: 'Rupees', reasonCode: '4853', pan: '411234*****',
      product: 'VISA', aging: 20,
      merchantAction: 'rejected', adminAction: 'considered', visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(20) + ' 10:00 AM', title: 'Dispute Raised', remarks: 'Customer claims item not received', file: null },
        { by: 'masteruser', time: dA(18) + ' 02:00 PM', title: 'Evidence Submitted', remarks: 'Delivery confirmation with courier tracking attached', file: 'DeliveryProof.pdf' },
        { by: 'Krishna Das', time: dA(15) + ' 04:00 PM', title: 'Admin Considered — Represented to VISA', remarks: 'Merchant evidence validated. Case represented to VISA network.', file: null },
        { by: 'iServeU', time: dA(10) + ' 09:00 AM', title: 'VISA Ruled — Dispute Won', remarks: 'Dispute Won. Refund issued to merchant wallet.', file: 'VisaRuling.pdf' }
      ]
    },
    // CB008 — Rupay · Chargeback Won · Visa pending
    {
      id: 'CB008', caseId: 'CASE000008', userName: 'masteruser', userId: '2575789089',
      rrn: '7045218899', txnId: '9912346', terminalId: '5690002',
      beneMobile: '9876500001', remMobile: '9000000001',
      createdDate: dA(15), txnDate: dA(20), adjDate: dA(15), respondByDate: dA(5),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback Won',
      adjType: 'Chargeback Raise', remitter: 'BOI', beneficiary: 'FIP',
      txnAmt: 4200, adjAmt: 4200, glNo: '354426',
      currency: 'Rupees', reasonCode: '4808', pan: '607080*****',
      product: 'Rupay', aging: 15,
      merchantAction: 'rejected', adminAction: 'considered', visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(15) + ' 08:00 AM', title: 'Dispute Raised', remarks: 'Rupay chargeback: duplicate transaction claim', file: null },
        { by: 'masteruser', time: dA(13) + ' 11:00 AM', title: 'Evidence Submitted (Partner Representation)', remarks: 'Bank statement shows single debit. Forwarded to Acquirer on behalf of Partner for Visa.', file: 'BankStatement.pdf' },
        { by: 'Krishna Das', time: dA(10) + ' 03:00 PM', title: 'Admin Considered — Escalated to NPCI', remarks: 'Strong evidence. Represented to Rupay NPCI grid.', file: null },
        { by: 'iServeU', time: dA(6) + ' 10:00 AM', title: 'NPCI Ruled — Dispute Won', remarks: 'Chargeback Won. Merchant vindicated.', file: null }
      ]
    },
    // CB009 — Mastercard · Fraud · In Progress · Visa pending
    {
      id: 'CB009', caseId: 'CASE000009', userName: 'masteruser', userId: '2575789089',
      rrn: '8812349901', txnId: '1100045', terminalId: '5690003',
      beneMobile: '9700001234', remMobile: '9800001234',
      createdDate: dA(3), txnDate: dA(7), adjDate: dA(3), respondByDate: dL(5),
      mStatus: 'Fraud Chargeback Raise', mSubStatus: 'Chargeback in Progress',
      adjType: 'Fraud Chargeback Raise', remitter: 'PNB', beneficiary: 'FIP',
      txnAmt: 12000, adjAmt: 12000, glNo: '354427',
      currency: 'Rupees', reasonCode: '4863', pan: '522222*****',
      product: 'Mastercard', aging: 3,
      merchantAction: 'evidence', adminAction: null, visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(3) + ' 07:00 AM', title: 'Fraud Chargeback Raised', remarks: 'High-value card fraud. Lien placed on Rs.12,000', file: null },
        { by: 'masteruser', time: dA(2) + ' 01:00 PM', title: 'Evidence Submitted (Partner Representation)', remarks: 'OTP log and 3DS auth proof attached. Forwarded to Mastercard via Acquirer.', file: 'FraudEvidence.pdf' }
      ]
    },
    // CB010 — VISA · Deferred · Resubmit
    {
      id: 'CB010', caseId: 'CASE000010', userName: 'masteruser', userId: '2575789089',
      rrn: '5512348800', txnId: '7700011', terminalId: '5690004',
      beneMobile: '9600001111', remMobile: '9100001111',
      createdDate: dA(7), txnDate: dA(12), adjDate: dA(7), respondByDate: dL(1),
      mStatus: 'Differed Chargeback Raise', mSubStatus: 'Chargeback Resubmit',
      adjType: 'Differed Chargeback Raise', remitter: 'KOTAK', beneficiary: 'FIP',
      txnAmt: 750, adjAmt: 750, glNo: '354422',
      currency: 'Rupees', reasonCode: '4808', pan: '832900*****',
      product: 'VISA', aging: 7,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(7) + ' 09:30 AM', title: 'Deferred Chargeback Raised', remarks: 'Initial CB returned by NPCI — resubmitting', file: null },
        { by: 'iServeU', time: dA(5) + ' 02:00 PM', title: 'Resubmit Initiated', remarks: 'Case resubmitted to NPCI grid with corrected ARN', file: 'Resubmit_CB010.pdf' }
      ]
    },
    // CB011 — VISA · New (today)
    {
      id: 'CB011', caseId: 'CASE000011', userName: 'masteruser', userId: '2575789089',
      rrn: '9911223344', txnId: '5500022', terminalId: '5690005',
      beneMobile: '9500002222', remMobile: '9200002222',
      createdDate: dA(1), txnDate: dA(4), adjDate: dA(1), respondByDate: dL(9),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New',
      adjType: 'Chargeback Raise', remitter: 'YES BANK', beneficiary: 'FIP',
      txnAmt: 5600, adjAmt: 5600, glNo: '354428',
      currency: 'Rupees', reasonCode: '4853', pan: '411111*****',
      product: 'VISA', aging: 1,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(1) + ' 11:00 AM', title: 'VISA Chargeback Raised', remarks: 'Customer claims hotel booking cancelled but charged', file: null }
      ]
    },
    // CB012 — Rupay · New
    {
      id: 'CB012', caseId: 'CASE000012', userName: 'masteruser', userId: '2575789089',
      rrn: '3312349900', txnId: '4400033', terminalId: '5690006',
      beneMobile: '9400003333', remMobile: '9300003333',
      createdDate: dA(2), txnDate: dA(5), adjDate: dA(2), respondByDate: dL(6),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New',
      adjType: 'Chargeback Raise', remitter: 'CANARA', beneficiary: 'FIP',
      txnAmt: 1800, adjAmt: 1800, glNo: '354429',
      currency: 'Rupees', reasonCode: '4808', pan: '607001*****',
      product: 'Rupay', aging: 2,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(2) + ' 10:00 AM', title: 'Rupay Chargeback Raised', remarks: 'Customer: EMI deducted but subscription not activated', file: null }
      ]
    },
    // CB013 — VISA · Pre-Arb · Refund On Hold · Visa pending
    {
      id: 'CB013', caseId: 'CASE000013', userName: 'masteruser', userId: '2575789089',
      rrn: '1100099988', txnId: '6600044', terminalId: '5690007',
      beneMobile: '9111110000', remMobile: '9222220000',
      createdDate: dA(18), txnDate: dA(22), adjDate: dA(18), respondByDate: dA(8),
      mStatus: 'Pre-Arbitration Raise', mSubStatus: 'Refund On Hold',
      adjType: 'Pre-Arbitration Raise', remitter: 'IDFC', beneficiary: 'FIP',
      txnAmt: 9900, adjAmt: 9900, glNo: '354430',
      currency: 'Rupees', reasonCode: '4853', pan: '400001*****',
      product: 'VISA', aging: 18,
      merchantAction: 'rejected', adminAction: 'considered', visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(18) + ' 09:00 AM', title: 'Pre-Arbitration Raised', remarks: 'Escalated after failed chargeback representation', file: null },
        { by: 'masteruser', time: dA(16) + ' 12:00 PM', title: 'Evidence Submitted (Partner Representation)', remarks: 'Full transaction log + 3DS auth. Submitted to VISA acquirer.', file: 'EvidencePackage.pdf' },
        { by: 'Krishna Das', time: dA(12) + ' 04:00 PM', title: 'Admin Considered — Sent to VISA', remarks: 'Case represented. Refund on hold pending VISA ruling.', file: null }
      ]
    },
    // CB014 — Mastercard · Lost
    {
      id: 'CB014', caseId: 'CASE000014', userName: 'masteruser', userId: '2575789089',
      rrn: '2200011122', txnId: '3300055', terminalId: '5690008',
      beneMobile: '9000005555', remMobile: '9900005555',
      createdDate: dA(25), txnDate: dA(30), adjDate: dA(25), respondByDate: dA(15),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback Lost',
      adjType: 'Chargeback Raise', remitter: 'BOB', beneficiary: 'FIP',
      txnAmt: 6700, adjAmt: 6700, glNo: '354431',
      currency: 'Rupees', reasonCode: '4808', pan: '545454*****',
      product: 'Mastercard', aging: 25,
      merchantAction: 'rejected', adminAction: 'declined', visaPending: false,
      rejectReason: 'Mastercard dispute resolution team ruled in favour of cardholder. Service log did not match claimed delivery date.',
      timeline: [
        { by: 'iServeU', time: dA(25) + ' 08:30 AM', title: 'Mastercard Chargeback Raised', remarks: 'Card not present transaction disputed', file: null },
        { by: 'masteruser', time: dA(23) + ' 03:00 PM', title: 'Evidence Submitted', remarks: 'POS receipt and camera footage link shared', file: 'POSReceipt.pdf' },
        { by: 'Krishna Das', time: dA(20) + ' 02:00 PM', title: 'Admin Reviewed — Declined', remarks: 'Mastercard ruling against merchant. Case closed as Lost.', file: null }
      ]
    },
    // CB015 — VISA · Auto-accepted (TAT expired) · Visa pending
    {
      id: 'CB015', caseId: 'CASE000015', userName: 'masteruser', userId: '2575789089',
      rrn: '4400022233', txnId: '2200066', terminalId: '5690009',
      beneMobile: '9800006666', remMobile: '9700006666',
      createdDate: dA(6), txnDate: dA(10), adjDate: dA(6), respondByDate: dL(1),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback Won',
      adjType: 'Chargeback Raise', remitter: 'UNION', beneficiary: 'FIP',
      txnAmt: 2200, adjAmt: 2200, glNo: '354422',
      currency: 'Rupees', reasonCode: '4808', pan: '832927*****',
      product: 'VISA', aging: 6,
      merchantAction: 'rejected', adminAction: 'auto-accepted', visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(6) + ' 08:00 AM', title: 'Dispute Raised', remarks: 'Customer disputes VISA double debit', file: null },
        { by: 'masteruser', time: dA(4) + ' 10:00 AM', title: 'Evidence Submitted', remarks: 'Merchant rejected the claim with supporting docs', file: 'Evidence_CB015.pdf' },
        { by: 'system-auto', time: dA(0) + ' 12:00 AM', title: 'TAT Expired — Auto-Accepted & Pushed to Visa', remarks: 'TAT of 6 days exceeded. System auto-accepted and escalated to Visa for review.', file: null }
      ]
    },
    // CB016 — VISA · Fraud · New (high value)
    {
      id: 'CB016', caseId: 'CASE000016', userName: 'masteruser', userId: '2575789089',
      rrn: '5500033344', txnId: '1100077', terminalId: '5690010',
      beneMobile: '9600007777', remMobile: '9500007777',
      createdDate: dA(0), txnDate: dA(2), adjDate: dA(0), respondByDate: dL(10),
      mStatus: 'Fraud Chargeback Raise', mSubStatus: 'Chargeback New',
      adjType: 'Fraud Chargeback Raise', remitter: 'KARUR', beneficiary: 'FIP',
      txnAmt: 15000, adjAmt: 15000, glNo: '354432',
      currency: 'Rupees', reasonCode: '4863', pan: '400222*****',
      product: 'VISA', aging: 0,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(0) + ' 06:00 AM', title: 'Fraud Chargeback Raised — HIGH VALUE', remarks: 'High-value card fraud alert. Immediate lien placed on Rs.15,000.', file: null }
      ]
    },
    // CB017 — VISA · Chargeback Won
    {
      id: 'CB017', caseId: 'CASE000017', userName: 'masteruser', userId: '2575789089',
      rrn: '7700044455', txnId: '9900088', terminalId: '5690011',
      beneMobile: '9400008888', remMobile: '9300008888',
      createdDate: dA(12), txnDate: dA(16), adjDate: dA(12), respondByDate: dA(4),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback Won',
      adjType: 'Chargeback Raise', remitter: 'IOB', beneficiary: 'FIP',
      txnAmt: 3300, adjAmt: 3300, glNo: '354422',
      currency: 'Rupees', reasonCode: '4808', pan: '832927*****',
      product: 'VISA', aging: 12,
      merchantAction: 'rejected', adminAction: 'considered', visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(12) + ' 09:00 AM', title: 'Dispute Raised', remarks: 'Customer disputes Rs.3300 VISA debit', file: null },
        { by: 'masteruser', time: dA(10) + ' 02:00 PM', title: 'Evidence Submitted', remarks: 'Delivery receipt and GPS proof shared', file: 'GPSProof.pdf' },
        { by: 'Krishna Das', time: dA(7) + ' 11:00 AM', title: 'Admin Considered — Sent to NPCI', remarks: 'Evidence strong. Case represented.', file: null },
        { by: 'iServeU', time: dA(4) + ' 09:00 AM', title: 'NPCI Ruled — Dispute Won', remarks: 'Chargeback Won. Merchant wallet credited.', file: null }
      ]
    },
    // CB018 — Rupay · Accepted by merchant
    {
      id: 'CB018', caseId: 'CASE000018', userName: 'masteruser', userId: '2575789089',
      rrn: '8800055566', txnId: '8800099', terminalId: '5690012',
      beneMobile: '9200009999', remMobile: '9100009999',
      createdDate: dA(3), txnDate: dA(6), adjDate: dA(3), respondByDate: dL(4),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback in Progress',
      adjType: 'Chargeback Raise', remitter: 'SYNDICATE', beneficiary: 'FIP',
      txnAmt: 900, adjAmt: 900, glNo: '354433',
      currency: 'Rupees', reasonCode: '4808', pan: '607001*****',
      product: 'Rupay', aging: 3,
      merchantAction: 'accepted', adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(3) + ' 10:30 AM', title: 'Rupay Chargeback Raised', remarks: 'Customer reports recharge failed but amount debited', file: null },
        { by: 'masteruser', time: dA(2) + ' 02:30 PM', title: 'Merchant Accepted Dispute', remarks: 'Merchant accepted — refund process initiated', file: null }
      ]
    },
    // CB019 — Mastercard · Pending admin review (evidence submitted)
    {
      id: 'CB019', caseId: 'CASE000019', userName: 'masteruser', userId: '2575789089',
      rrn: '9900066677', txnId: '7700000', terminalId: '5690013',
      beneMobile: '9000010101', remMobile: '9000020202',
      createdDate: dA(4), txnDate: dA(8), adjDate: dA(4), respondByDate: dL(2),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback in Progress',
      adjType: 'Chargeback Raise', remitter: 'BANDHAN', beneficiary: 'FIP',
      txnAmt: 7200, adjAmt: 7200, glNo: '354434',
      currency: 'Rupees', reasonCode: '4853', pan: '512345*****',
      product: 'Mastercard', aging: 4,
      merchantAction: 'rejected', adminAction: null, visaPending: false,
      rejectReason: 'Service was fully rendered. Customer received goods at doorstep on 15/05/2026. Attached courier tracking reference.',
      timeline: [
        { by: 'iServeU', time: dA(4) + ' 08:00 AM', title: 'Mastercard Chargeback Raised', remarks: 'Customer claims goods not received', file: null },
        { by: 'masteruser', time: dA(3) + ' 03:00 PM', title: 'Evidence Submitted', remarks: 'Delivery confirmed. Awaiting admin review.', file: 'CourierReceipt.pdf' }
      ]
    },
    // CB020 — VISA · New · Fresh today
    {
      id: 'CB020', caseId: 'CASE000020', userName: 'masteruser', userId: '2575789089',
      rrn: '1234567890', txnId: '5678900', terminalId: '5690014',
      beneMobile: '9876543211', remMobile: '9123456700',
      createdDate: dA(0), txnDate: dA(1), adjDate: dA(0), respondByDate: dL(10),
      mStatus: 'Chargeback Raise', mSubStatus: 'Chargeback New',
      adjType: 'Chargeback Raise', remitter: 'FEDERAL', beneficiary: 'FIP',
      txnAmt: 4500, adjAmt: 4500, glNo: '354435',
      currency: 'Rupees', reasonCode: '4808', pan: '416001*****',
      product: 'VISA', aging: 0,
      merchantAction: null, adminAction: null, visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(0) + ' 08:30 AM', title: 'VISA Chargeback Raised — Fresh', remarks: 'New chargeback received from VISA acquirer network', file: null }
      ]
    }    ,{
      id: 'CB_VROL_01', caseId: 'CASE_VROL_01', userName: 'masteruser', userId: '2575789089',
      rrn: '1231231231', txnId: '9898989', terminalId: '5690015',
      beneMobile: '9999999999', remMobile: '8888888888',
      createdDate: dA(2), txnDate: dA(5), adjDate: dA(2), respondByDate: dL(5),
      mStatus: 'VROL Inquiry', mSubStatus: 'Chargeback New',
      adjType: 'Chargeback Raise', remitter: 'HDFC', beneficiary: 'FIP',
      txnAmt: 5000, adjAmt: 5000, glNo: '354435',
      currency: 'Rupees', reasonCode: '10.4', pan: '416001*****',
      product: 'VISA', aging: 2,
      merchantAction: null, adminAction: null, visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(2) + ' 10:00 AM', title: 'VROL Inquiry Initiated', remarks: 'Visa raised inquiry for potential fraud.', file: null }
      ]
    },
    {
      id: 'CB_VROL_02', caseId: 'CASE_VROL_02', userName: 'masteruser', userId: '2575789089',
      rrn: '1231231232', txnId: '9898990', terminalId: '5690016',
      beneMobile: '9999999998', remMobile: '8888888887',
      createdDate: dA(5), txnDate: dA(10), adjDate: dA(5), respondByDate: dA(1),
      mStatus: 'VROL Chargeback', mSubStatus: 'Chargeback in Progress',
      adjType: 'Chargeback Raise', remitter: 'SBI', beneficiary: 'FIP',
      txnAmt: 3500, adjAmt: 3500, glNo: '354436',
      currency: 'Rupees', reasonCode: '13.1', pan: '426001*****',
      product: 'VISA', aging: 5,
      merchantAction: 'evidence', adminAction: null, visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(5) + ' 11:00 AM', title: 'VROL Chargeback Received', remarks: 'First chargeback initiated by issuer.', file: null }
      ]
    },
    {
      id: 'CB_VROL_03', caseId: 'CASE_VROL_03', userName: 'masteruser', userId: '2575789089',
      rrn: '1231231233', txnId: '9898991', terminalId: '5690017',
      beneMobile: '9999999997', remMobile: '8888888886',
      createdDate: dA(15), txnDate: dA(20), adjDate: dA(15), respondByDate: dA(2),
      mStatus: 'VROL Pre-Arbitration', mSubStatus: 'Chargeback in Progress',
      adjType: 'Pre-Arbitration Raise', remitter: 'AXIS', beneficiary: 'FIP',
      txnAmt: 7500, adjAmt: 7500, glNo: '354437',
      currency: 'Rupees', reasonCode: '10.4', pan: '436001*****',
      product: 'VISA', aging: 15,
      merchantAction: 'evidence', adminAction: 'considered', visaPending: true,
      timeline: [
        { by: 'iServeU', time: dA(15) + ' 12:00 PM', title: 'VROL Pre-Arbitration Raised', remarks: 'Issuer declined evidence, pushed to pre-arb.', file: null }
      ]
    },
    {
      id: 'CB_VROL_04', caseId: 'CASE_VROL_04', userName: 'masteruser', userId: '2575789089',
      rrn: '1231231234', txnId: '9898992', terminalId: '5690018',
      beneMobile: '9999999996', remMobile: '8888888885',
      createdDate: dA(30), txnDate: dA(40), adjDate: dA(30), respondByDate: dA(5),
      mStatus: 'VROL Arbitration', mSubStatus: 'Chargeback Lost',
      adjType: 'Arbitration Raise', remitter: 'ICICI', beneficiary: 'FIP',
      txnAmt: 10000, adjAmt: 10000, glNo: '354438',
      currency: 'Rupees', reasonCode: '10.5', pan: '446001*****',
      product: 'VISA', aging: 30,
      merchantAction: 'evidence', adminAction: 'declined', visaPending: false,
      timeline: [
        { by: 'iServeU', time: dA(30) + ' 01:00 PM', title: 'VROL Arbitration Lost', remarks: 'Visa Arbitration panel ruled in favor of cardholder.', file: null }
      ]
    }
  ];
}

// ── Standard Seed ─────────────────────────────────────────────────────────────
router.post('/seed', async (req, res) => {
  try {
    // 1. Seed Users
    const userCount = await User.countDocuments();
    let usersSeeded = false;
    if (userCount === 0) {
      const defaultUsers = [
        { username: 'Test@isu', password: 'Test@2026', role: 'merchant', name: 'masteruser', walletBalance: 964.35 },
        { username: 'masteruser', password: 'Test@2026', role: 'merchant', name: 'masteruser', walletBalance: 964.35 },
        { username: 'Test@Ad', password: 'Test@2027', role: 'admin', name: 'Krishna Das', walletBalance: 245800.00 },
        { username: 'partneruser', password: 'Test@2028', role: 'partner', name: 'Arjun Mehta (Partner)', walletBalance: 0.00 }
      ];
      await User.insertMany(defaultUsers);
      usersSeeded = true;
    }

    // 2. Seed Chargebacks
    const TODAY = new Date();
    const fmtDate = d => d.toISOString().split('T')[0];
    const daysAgo = n => { let d = new Date(TODAY); d.setDate(d.getDate() - n); return fmtDate(d); };

    const cbCount = await Chargeback.countDocuments();
    let chargebacksSeeded = false;
    if (cbCount === 0) {
      const defaultChargebacks = buildSeedData(TODAY);
      await Chargeback.insertMany(defaultChargebacks);
      chargebacksSeeded = true;
    }

    // 3. Seed Ledger
    const ledgerCount = await Ledger.countDocuments();
    let ledgerSeeded = false;
    if (ledgerCount === 0) {
      const defaultLedger = [
        { id: 'ADJ001', merchant: 'masteruser', type: 'Credit', amount: 8500, date: daysAgo(10), remarks: 'Chargeback Won — CB007 VISA dispute reversal credited' },
        { id: 'ADJ002', merchant: 'masteruser', type: 'Credit', amount: 4200, date: daysAgo(6), remarks: 'Chargeback Won — CB008 Rupay dispute reversal credited' },
        { id: 'ADJ003', merchant: 'masteruser', type: 'Debit', amount: 1500, date: daysAgo(10), remarks: 'Chargeback Lost — CB003 debit adjustment applied' },
        { id: 'ADJ004', merchant: 'masteruser', type: 'Debit', amount: 6700, date: daysAgo(15), remarks: 'Chargeback Lost — CB014 Mastercard ruling debit' },
        { id: 'ADJ005', merchant: 'masteruser', type: 'Credit', amount: 3300, date: daysAgo(4), remarks: 'Chargeback Won — CB017 VISA dispute won, credit applied' },
        { id: 'ADJ006', merchant: 'masteruser', type: 'Debit', amount: 500, date: daysAgo(5), remarks: 'Processing fee — chargeback dispute handling fee Q1' },
        { id: 'ADJ007', merchant: 'masteruser', type: 'Credit', amount: 2000, date: daysAgo(2), remarks: 'Manual credit adjustment — goodwill reversal by admin' },
        { id: 'ADJ008', merchant: 'masteruser', type: 'Debit', amount: 350, date: daysAgo(1), remarks: 'Platform fee deduction — May 2026' }
      ];
      await Ledger.insertMany(defaultLedger);
      ledgerSeeded = true;
    }

    res.json({ message: 'Seeding completed', usersSeeded, chargebacksSeeded, ledgerSeeded });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Force Reseed: clears and reseeds all data ─────────────────────────────────
router.post('/reseed', async (req, res) => {
  try {
    await Chargeback.deleteMany({});
    await Ledger.deleteMany({});

    // Ensure partneruser exists
    const partnerExists = await User.findOne({ username: 'partneruser' });
    if (!partnerExists) {
      await User.create({ username: 'partneruser', password: 'Test@2028', role: 'partner', name: 'Arjun Mehta (Partner)', walletBalance: 0 });
    }

    const TODAY = new Date();
    const fmtDate = d => d.toISOString().split('T')[0];
    const dA = n => { let d = new Date(TODAY); d.setDate(d.getDate() - n); return fmtDate(d); };

    const chargebacks = buildSeedData(TODAY);
    await Chargeback.insertMany(chargebacks);

    const ledger = [
      { id: 'ADJ001', merchant: 'masteruser', type: 'Credit', amount: 8500, date: dA(10), remarks: 'Chargeback Won — CB007 VISA dispute reversal credited' },
      { id: 'ADJ002', merchant: 'masteruser', type: 'Credit', amount: 4200, date: dA(6), remarks: 'Chargeback Won — CB008 Rupay dispute reversal credited' },
      { id: 'ADJ003', merchant: 'masteruser', type: 'Debit', amount: 1500, date: dA(10), remarks: 'Chargeback Lost — CB003 debit adjustment applied' },
      { id: 'ADJ004', merchant: 'masteruser', type: 'Debit', amount: 6700, date: dA(15), remarks: 'Chargeback Lost — CB014 Mastercard ruling debit' },
      { id: 'ADJ005', merchant: 'masteruser', type: 'Credit', amount: 3300, date: dA(4), remarks: 'Chargeback Won — CB017 VISA dispute won, credit applied' },
      { id: 'ADJ006', merchant: 'masteruser', type: 'Debit', amount: 500, date: dA(5), remarks: 'Processing fee — chargeback dispute handling fee Q1' },
      { id: 'ADJ007', merchant: 'masteruser', type: 'Credit', amount: 2000, date: dA(2), remarks: 'Manual credit adjustment — goodwill reversal by admin' },
      { id: 'ADJ008', merchant: 'masteruser', type: 'Debit', amount: 350, date: dA(1), remarks: 'Platform fee deduction — May 2026' }
    ];
    await Ledger.insertMany(ledger);

    res.json({
      message: 'Force reseed completed successfully',
      chargebacks: chargebacks.length,
      ledger: ledger.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
module.exports.buildSeedData = buildSeedData;

