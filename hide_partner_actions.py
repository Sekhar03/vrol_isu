import os

filepath = 'client/src/App.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old_actions_check = "{(!cb.mStatus.includes('Won') && !cb.mStatus.includes('Lost')) && !cb.visaPending && ("
new_actions_check = "{partnerTab !== 'verification-pending' && (!cb.mStatus.includes('Won') && !cb.mStatus.includes('Lost')) && !cb.visaPending && ("

# We only want to replace this inside PartnerPortal disputeDetails
partner_details_start = content.find("Partner Dispute Details Modal")
if partner_details_start != -1:
    actions_idx = content.find(old_actions_check, partner_details_start)
    if actions_idx != -1:
        content = content[:actions_idx] + new_actions_check + content[actions_idx + len(old_actions_check):]

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Hidden action buttons for partnerTab verification-pending")
