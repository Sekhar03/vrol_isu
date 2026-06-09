with open('client/src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start = -1
end = -1
for i, line in enumerate(lines):
    if "activePage === 'a-view-cb' && (" in line:
        start = i
    if start != -1 and i > start and line.strip() == ')}':
        end = i
        break

if start != -1 and end != -1:
    with open('admin_block.txt', 'w', encoding='utf-8') as f:
        f.writelines(lines[start:end+1])
    print('Block extracted.')
