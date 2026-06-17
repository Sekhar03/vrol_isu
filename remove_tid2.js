const fs=require('fs');
const p='c:\\Users\\sekha\\OneDrive\\Desktop\\visa  chargeback - Copy\\client\\src\\App.jsx';
let lines=fs.readFileSync(p,'utf8').split('\n');
const idx=lines.findIndex(l=>l.includes('m.tid'));
console.log('idx:',idx,'content:',idx>=0?lines[idx]:'not found');
if(idx>=0){lines.splice(idx,1);fs.writeFileSync(p,lines.join('\n'),'utf8');console.log('Done');}
