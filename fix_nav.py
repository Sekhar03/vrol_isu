import os

def fix_file(filepath):
    if not os.path.exists(filepath): return
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Fix React Sidebar
    content = content.replace('<span className="si">📋</span> All Disputes', '<span className="si">📋</span> Dispute Management')
    content = content.replace('<span className="si">👤</span> All Disputes', '<span className="si">👤</span> Dispute Management')
    
    # Fix HTML Sidebar
    content = content.replace('<span class="si">📋</span> All Disputes', '<span class="si">📋</span> Dispute Management')
    content = content.replace('<span class="si">👤</span> All Disputes', '<span class="si">👤</span> Dispute Management')

    # Fix Breadcrumbs (which are also part of navigation)
    content = content.replace('All Disputes / ', 'Dispute Management / ')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed nav in {filepath}")

fix_file('client/src/App.jsx')
fix_file('client/public/admin.html')
fix_file('client/public/merchant.html')
