path = r'c:\Users\sekha\OneDrive\Desktop\visa  chargeback - Copy\client\src\App.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

tid_line = '                             <td className="mono" style={{ padding: \'14px 16px\', fontSize: \'13px\', color: \'var(--text-muted)\', fontFamily: \'monospace\' }}>{m.tid || \'10515104\'}</td>\n'
count = content.count(tid_line)
print(f'Found {count} occurrence(s)')
new_content = content.replace(tid_line, '', 1)
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)
print('Done')
