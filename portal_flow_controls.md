# Portal Flow & Controls

## Acquirer/Issuer Portal (formerly Admin)
**Facilitates the exchange between Merchant and Issuer over VROL**

**Disputes**
- Acquirer receives all incoming disputes from VROL and forwards to Merchant
- Issuer reviews evidence submitted by merchants (Representment)
- Issuer decides to accept the evidence or reject it and file Pre-Arbitration
- Issuer escalates cases to Arbitration if needed
- Final Visa ruling (Won or Lost) closes the case

**Merchants**
- Views any merchant's dispute history and VAMP ratio
- Suspends or reactivates merchants
- Sends alerts to merchants

**Compliance**
- Monitors VAMP ratios across all merchants
- Identifies merchants breaching the 2.2% threshold
- Exports compliance reports

**Configuration**
- Manages VROL API connection
- Sets alert rules and reason code mappings
- Manages user roles and permissions

---

## Merchant Portal
**Responds to their own disputes only**

**Disputes**
- Receives notification when a new dispute is filed
- Views what stage the dispute is at and how much time is left to respond
- Chooses to either accept liability (close as lost) or fight the dispute
- Uploads evidence files (max 2MB PDF / 10MB Images) and selects a rebuttal template
- Submits the response (Representment) for Issuer review
- If escalated to Pre-Arbitration by the Issuer, submits final counter-evidence (only 1 loop allowed)
- Views the final Visa Arbitration outcome (Won or Lost)

**VAMP**
- Monitors their own VAMP ratio against the 2.2% limit
- Projects future ratio using the calculator
- Sets personal alert thresholds

**Reports**
- Generates dispute and VAMP history reports
- Manages rebuttal response templates

---

## Partner Portal
**Oversees their portfolio of merchants**

**Portfolio**
- Monitors all sub-merchants' VAMP ratios and dispute counts
- Identifies at-risk or breaching merchants
- Changes merchant plan tiers or suspends merchants

**VROL Operations**
- Submits representments to Visa on behalf of a merchant
- Runs batch submissions for multiple disputes at once
- Tracks all active VROL cases across the portfolio
- Monitors incoming webhook events from Visa

**Analytics**
- Compares merchant performance across the portfolio
- Tracks portfolio-level VAMP trend and win rates

**API & Bulk Config**
- Issues and manages API keys for merchants
- Applies configuration changes (Order Insight, RDR, plan tier) to multiple merchants at once

---

## Who Controls What

| Action | Acquirer/Issuer | Merchant | Partner |
|---|---|---|---|
| Receive dispute from VROL | ✅ | ✅ notified | ✅ notified |
| Submit evidence | ❌ | ✅ | ✅ on behalf |
| Accept liability | ❌ | ✅ | ❌ |
| Submit Representment | ✅ (Acq) | ✅ | ✅ on behalf |
| File Pre-Arbitration | ✅ (Iss) | ❌ | ❌ |
| File Arbitration | ✅ (Iss) | ❌ | ❌ |
| Monitor VAMP ratio | ✅ all merchants | ✅ own only | ✅ portfolio |
| Suspend merchant | ✅ | ❌ | ✅ own portfolio |
| Bulk config changes | ❌ | ❌ | ✅ |
| Manage API keys | ❌ | ❌ | ✅ |
