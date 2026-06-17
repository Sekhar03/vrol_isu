const fs = require('fs');
const path = 'c:\\Users\\sekha\\OneDrive\\Desktop\\visa  chargeback - Copy\\client\\src\\App.jsx';
let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');
const tidLine = `                             <td className="mono" style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{m.tid || '10515104'}</td>`;
const idx = lines.findIndex(l => l.trimEnd() === tidLine.trimEnd());
console.log('Line index:', idx);
if (idx !== -1) {
  lines.splice(idx, 1);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log('Removed TID line at index', idx);
} else {
  console.log('Not found');
}
