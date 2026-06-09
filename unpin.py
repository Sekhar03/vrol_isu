import os

filepath = 'client/src/App.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove sticky from search boxes
old_sticky_div = "<div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg-body, #fff)', paddingTop: '16px', paddingBottom: '8px', margin: '0 -32px', paddingLeft: '32px', paddingRight: '32px' }}>"
new_div = "<div style={{ background: 'var(--bg-body, #fff)', paddingTop: '16px', paddingBottom: '8px', margin: '0 -32px', paddingLeft: '32px', paddingRight: '32px' }}>"
content = content.replace(old_sticky_div, new_div)

# Add sticky back to Admin table header
old_admin_thead = "<thead style={{ background: '#fff', zIndex: 10, borderBottom: '1px solid #f0f0f0' }}>"
new_admin_thead = "<thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderBottom: '1px solid #f0f0f0' }}>"
content = content.replace(old_admin_thead, new_admin_thead)

# Make all other standard theads sticky (except the one we just fixed)
# Using a blanket style for standard <thead> if they don't have style
old_thead = "<thead>"
new_thead = "<thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, boxShadow: '0 1px 0 #f0f0f0' }}>"
content = content.replace(old_thead, new_thead)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Un-pinned search box and pinned table headers")
