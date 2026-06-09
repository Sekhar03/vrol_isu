import os

filepath = 'client/src/App.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("top: 'var(--header-h, 60px)'", "top: 0")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Reverted sticky top back to 0")
