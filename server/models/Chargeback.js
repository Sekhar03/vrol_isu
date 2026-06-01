const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  by: { type: String, required: true },
  time: { type: String, required: true }, // Store formatted string for timeline rendering
  title: { type: String, required: true },
  remarks: { type: String, default: '' },
  file: { type: String, default: null }
});

const chargebackSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  caseId: { type: String, required: true },
  userName: { type: String, default: 'masteruser' },
  userId: { type: String, default: '' },
  rrn: { type: String, required: true },
  txnId: { type: String, required: true },
  terminalId: { type: String, default: '' },
  beneMobile: { type: String, default: '' },
  remMobile: { type: String, default: '' },
  createdDate: { type: String, required: true }, // Date string (YYYY-MM-DD)
  txnDate: { type: String, required: true },     // Date string (YYYY-MM-DD)
  adjDate: { type: String, required: true },     // Date string (YYYY-MM-DD)
  respondByDate: { type: String, required: true },// Date string (YYYY-MM-DD)
  mStatus: { type: String, required: true },
  mSubStatus: { type: String, required: true },
  adjType: { type: String, required: true },
  remitter: { type: String, default: 'AXB' },
  beneficiary: { type: String, default: 'FIP' },
  txnAmt: { type: Number, required: true },
  adjAmt: { type: Number, required: true },
  leinAmt: { type: Number, default: 0 },
  glNo: { type: String, default: '354422' },
  currency: { type: String, default: 'Rupees' },
  reasonCode: { type: String, default: '1' },
  pan: { type: String, default: '' },
  walletStatus: { type: String, default: 'Debited' },
  product: { type: String, default: 'VISA' },
  aging: { type: Number, default: 0 },
  merchantAction: { type: String, default: null },
  adminAction: { type: String, default: null },
  rejectReason: { type: String, default: '' },
  chargbackId: { type: String, default: '' },
  adminName: { type: String, default: 'nsdladmin' },
  visaPending: { type: Boolean, default: false },
  timeline: [timelineEntrySchema]
}, { timestamps: true });

module.exports = mongoose.model('Chargeback', chargebackSchema);
