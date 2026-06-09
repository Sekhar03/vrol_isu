import os

filepath = 'client/src/App.jsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove from AdminPortal
content = content.replace("const [adminTab, setAdminTab] = useState('management');\n  const [partnerTab, setPartnerTab] = useState('management');", "const [adminTab, setAdminTab] = useState('management');")

# 2. Add to PartnerPortal
partner_portal_start = "function PartnerPortal({"
partner_state_insert = """
  const [partnerTab, setPartnerTab] = useState('management');
"""
# find where state usually goes in PartnerPortal
# let's look for `const [activePage` or something in PartnerPortal

# Let's insert it right after the component declaration and its destructured props.
old_partner_decl = """function PartnerPortal({
  currentUser,
  chargebacks,
  handleLogout,
  refreshAllData,
  API_URL,
  showToast,
  formatINR,
  formatDateDisp,
  DEFAULT_FROM,
  TODAY_STR,
  renderStatusBadge,
  renderSubBadge
}) {"""

new_partner_decl = """function PartnerPortal({
  currentUser,
  chargebacks,
  handleLogout,
  refreshAllData,
  API_URL,
  showToast,
  formatINR,
  formatDateDisp,
  DEFAULT_FROM,
  TODAY_STR,
  renderStatusBadge,
  renderSubBadge
}) {
  const [partnerTab, setPartnerTab] = React.useState('management');"""

content = content.replace(old_partner_decl, new_partner_decl)

# Wait, the file might just use `useState` directly.
content = content.replace("React.useState('management')", "useState('management')")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Fixed partnerTab scope")
