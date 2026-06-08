const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'client', 'src', 'demoFallback.js');
let content = fs.readFileSync(targetFile, 'utf8');

// The arrays we want to combine
const disputeTypes = [
  'Chargeback Raise',
  'Pre-Arbitration Raise',
  'Retrieval Request',
  'Arbitration Raise'
];

const disputeStatuses = [
  'Dispute Won Partially',
  'Dispute Won Fully',
  'Dispute Lost – TAT Expired',
  'Dispute Lost – Accepted',
  'Document Rejected',
  'Chargeback In Progress',
  'Chargeback Resubmit'
];

// Extract existing chargebacks so we don't duplicate logic, or just append newly generated items.
// Using regex to find the end of the chargebacks array: `    { id: 'CB110'... }`
const newItems = [];
let caseCounter = 200;

for (const mStatus of disputeTypes) {
  for (const mSubStatus of disputeStatuses) {
    caseCounter++;
    const id = `CB_GEN_${caseCounter}`;
    const caseId = `CASE_GEN_${caseCounter}`;
    const userName = caseCounter % 2 === 0 ? 'masteruser' : 'Test@isu';
    const txnAmt = 1000 + (caseCounter * 10);
    const item = `    { id: '${id}', caseId: '${caseId}', userName: '${userName}', rrn: '998877${caseCounter}', txnId: 'TXN${caseCounter}', txnDate: '2026-06-01', createdDate: '2026-06-02', respondByDate: '2026-06-15', mStatus: '${mStatus}', mSubStatus: '${mSubStatus}', txnAmt: ${txnAmt}, adjAmt: ${txnAmt}, product: 'VISA', merchantAction: null, acquirerAction: null, visaPending: false, partnerId: PARTNER_ID, timeline: [] }`;
    newItems.push(item);
  }
}

// Find the last item in the chargebacks array and inject our new items
const chargebacksEndIdx = content.lastIndexOf('],');
const before = content.substring(0, chargebacksEndIdx);
const after = content.substring(chargebacksEndIdx);

// The last item in `before` doesn't have a trailing comma, so let's add one, then our new items
const updatedContent = before + ',\n' + newItems.join(',\n') + '\n  ' + after;

fs.writeFileSync(targetFile, updatedContent);
console.log(`Generated ${newItems.length} demo items and patched demoFallback.js successfully.`);
