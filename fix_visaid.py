import re

file_path = 'client/src/App.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("{cb.visaId || '-'}", "{cb.visaId || 'V-' + (cb.id || 'XXXX').substring(0, 6).toUpperCase()}")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Replaced all cb.visaId fallbacks.")
