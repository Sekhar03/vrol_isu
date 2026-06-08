const fs = require('fs');

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/mStatus:\s*'DISPUTE_RECEIVED'/g, "mStatus: 'Chargeback Raise'");
  content = content.replace(/mSubStatus:\s*'ACTION_REQUIRED'/g, "mSubStatus: 'Chargeback New'");
  content = content.replace(/mStatus:\s*'PRE_ARBITRATION_RAISED'/g, "mStatus: 'Pre-Arbitration Raise'");
  content = content.replace(/mStatus:\s*'UNDER_REVIEW'/g, "mStatus: 'Chargeback Raise'");
  content = content.replace(/mSubStatus:\s*'UNDER_REVIEW'/g, "mSubStatus: 'Chargeback In Progress'");
  content = content.replace(/mStatus:\s*'ARBITRATION_REQUESTED'/g, "mStatus: 'Arbitration Raise'");
  
  // For CASE_CLOSED and SETTLEMENT_COMPLETED, map them generally to Won/Lost based on context,
  // but to be safe we can just use the generic 'Chargeback Raise' and a terminal substatus.
  // The UI will handle resolution: 'Won' or 'Lost'.
  content = content.replace(/mStatus:\s*'CASE_CLOSED'/g, "mStatus: 'Chargeback Raise'");
  content = content.replace(/mStatus:\s*'SETTLEMENT_COMPLETED'/g, "mStatus: 'Chargeback Raise'");
  content = content.replace(/mSubStatus:\s*'SETTLEMENT_COMPLETED'/g, "mSubStatus: 'Chargeback Won'"); // default for script, demoFallback is mostly accurate
  
  content = content.replace(/status:\s*'DISPUTE_RECEIVED'/g, "status: 'Chargeback Raise'");

  fs.writeFileSync(filePath, content);
}

patchFile('server/routes/auth.js');
patchFile('server/routes/vrol.js');
console.log('Patched auth.js and vrol.js');
