import os

files_to_update = [
    'client/src/App.jsx',
    'client/public/admin.html',
    'client/public/merchant.html'
]

for file_path in files_to_update:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # We replace the exact string "Dispute Management" with "All Disputes"
        new_content = content.replace("Dispute Management", "All Disputes")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {file_path}")
    else:
        print(f"File not found: {file_path}")
