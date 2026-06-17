const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client', 'src', 'App.jsx');
let content = fs.readFileSync(filePath, 'utf8');
let lines = content.split('\n');

console.log('Starting file has', lines.length, 'lines');

// ============================================================
// 1. INSERT MERCHANT FAQ PAGE before </main> in MerchantPortal
// ============================================================
// Find the MerchantPortal's </main> - it's the first </main> in the file
// It should be around line 2197
let merchantMainIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === '</main>' && i > 2000 && i < 2500) {
    merchantMainIdx = i;
    break;
  }
}
console.log('Merchant </main> found at line:', merchantMainIdx + 1);

const merchantFaqJSX = `
          {/* FAQ & Help Page */}
          {activePage === 'faq' && (() => {
            const FAQS = [
              { id: 1, cat: 'getting-started', q: 'What is a chargeback dispute?', a: 'A chargeback is a reversal of a credit card transaction initiated by the cardholder\\'s bank. When a customer disputes a charge, the amount is temporarily debited from your account. You can contest this by submitting evidence through this portal.' },
              { id: 2, cat: 'getting-started', q: 'How do I know when I have a new dispute?', a: 'New disputes will appear in your Dashboard under "Action Required". Check your portal regularly for new cases requiring your response.' },
              { id: 3, cat: 'getting-started', q: 'What are the different dispute statuses?', a: 'Chargeback New = action required. In Progress = under review. Won/Lost = final outcome. Closed = fully resolved, no further action.' },
              { id: 4, cat: 'disputes', q: 'How do I accept liability for a dispute?', a: 'Open the dispute from Action Required, click "Take Action", then choose "Accept Liability". You can accept full or partial liability. The amount will be debited from your wallet.' },
              { id: 5, cat: 'disputes', q: 'How do I submit evidence to contest?', a: 'Go to All Disputes, Action Required tab, click "Take Action", select "Contest / Submit Evidence", upload proof documents (max 20MB each, PDF/PNG/JPEG) and add remarks.' },
              { id: 6, cat: 'disputes', q: 'What happens after I submit evidence?', a: 'The dispute moves to "Under Review". The acquirer and scheme network will review your materials. The final outcome will appear in the Closed tab.' },
              { id: 7, cat: 'disputes', q: 'Can I view closed disputes?', a: 'Yes. Go to Dispute Management, Closed tab. All resolved disputes are visible there. Click the eye icon to view full details.' },
              { id: 8, cat: 'documents', q: 'What documents should I upload?', a: 'Upload proof of delivery, signed service agreements, communication records, transaction receipts, or refund proof as applicable.' },
              { id: 9, cat: 'documents', q: 'What file formats are accepted?', a: 'PDF, JPEG, PNG. Maximum 20MB per file. Up to 3 supporting files per dispute response.' },
              { id: 10, cat: 'sla', q: 'What is the TAT for disputes?', a: 'Each dispute has a "Remaining Days" deadline. Chargebacks: 20-45 days. Pre-Arbitration: 10-15 days. Missing the deadline = automatic loss.' },
              { id: 11, cat: 'sla', q: 'What does "TAT Expired" mean?', a: 'If you did not respond in time, the dispute is auto-marked "Dispute Lost - TAT Expired". No further action is possible.' },
              { id: 12, cat: 'account', q: 'How do I contact support?', a: 'Email support@isu-disputes.com or contact your relationship manager. Include your Case ID for faster resolution.' },
            ];
            const cats = [
              { key: 'all', label: 'All Topics' },
              { key: 'getting-started', label: 'Getting Started' },
              { key: 'disputes', label: 'Disputes' },
              { key: 'documents', label: 'Documents' },
              { key: 'sla', label: 'TAT & SLA' },
              { key: 'account', label: 'Account' },
            ];
            const filtered = FAQS.filter(f => {
              const matchCat = faqCategory === 'all' || f.cat === faqCategory;
              const matchSearch = !faqSearch || f.q.toLowerCase().includes(faqSearch.toLowerCase());
              return matchCat && matchSearch;
            });
            const grouped = cats.filter(c => c.key !== 'all').map(c => ({ ...c, items: filtered.filter(f => f.cat === c.key) })).filter(c => c.items.length > 0);
            return (
              <div className="page active">
                <div className="page-inner">
                  <div className="faq-page">
                    <div className="faq-hero">
                      <div className="faq-hero-icon">{String.fromCodePoint(0x2753)}</div>
                      <div>
                        <h1>FAQ & Help Center</h1>
                        <p>Find answers to common questions about managing your disputes on the ISU Merchant Portal.</p>
                      </div>
                    </div>
                    <div className="faq-search">
                      <span className="faq-search-icon">{String.fromCodePoint(0x1F50D)}</span>
                      <input type="text" placeholder="Search your question..." value={faqSearch} onChange={e => setFaqSearch(e.target.value)} />
                    </div>
                    <div className="faq-categories">
                      {cats.map(c => (
                        <button key={c.key} className={'faq-cat-btn ' + (faqCategory === c.key ? 'active' : '')} onClick={() => setFaqCategory(c.key)}>{c.label}</button>
                      ))}
                    </div>
                    {faqCategory === 'all' ? (
                      grouped.map(grp => (
                        <div className="faq-section" key={grp.key}>
                          <div className="faq-section-title">{grp.label}</div>
                          {grp.items.map(f => (
                            <div key={f.id} className={'faq-item ' + (faqOpenItem === f.id ? 'open' : '')}>
                              <div className="faq-q" onClick={() => setFaqOpenItem(faqOpenItem === f.id ? null : f.id)}>
                                <span className="faq-q-text">{f.q}</span>
                                <span className="faq-q-icon">{String.fromCodePoint(0x25BC)}</span>
                              </div>
                              <div className="faq-answer">{f.a}</div>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="faq-section">
                        {filtered.map(f => (
                          <div key={f.id} className={'faq-item ' + (faqOpenItem === f.id ? 'open' : '')}>
                            <div className="faq-q" onClick={() => setFaqOpenItem(faqOpenItem === f.id ? null : f.id)}>
                              <span className="faq-q-text">{f.q}</span>
                              <span className="faq-q-icon">{String.fromCodePoint(0x25BC)}</span>
                            </div>
                            <div className="faq-answer">{f.a}</div>
                          </div>
                        ))}
                        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No results found. Try a different search or category.</div>}
                      </div>
                    )}
                    <div className="faq-cta">
                      <h3>Still need help?</h3>
                      <p>Our support team is available Monday-Friday, 9 AM - 6 PM IST. Response time: under 4 hours.</p>
                      <div className="faq-cta-btns">
                        <button className="btn btn-primary" onClick={() => showToast('Support request sent! Our team will contact you shortly.', 'success')}>Email Support</button>
                        <button className="btn btn-outline" onClick={() => { setShowTour(true); setTourStep(0); setActivePage('dashboard'); }}>Restart Portal Tour</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
`;

if (merchantMainIdx >= 0) {
  lines.splice(merchantMainIdx, 0, merchantFaqJSX);
  console.log('Merchant FAQ inserted before line', merchantMainIdx + 1);
}

// ============================================================
// 2. PARTNER PORTAL - Add state, FAQ page, and Tour overlay
// ============================================================
content = lines.join('\n');
lines = content.split('\n');

// Find PartnerPortal function
let partnerFnLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function PartnerPortal(')) {
    partnerFnLine = i;
    break;
  }
}
console.log('PartnerPortal at line:', partnerFnLine + 1);

// Find profileMenuOpen in PartnerPortal
let pProfileLine = -1;
for (let i = partnerFnLine; i < partnerFnLine + 30; i++) {
  if (lines[i] && lines[i].includes('profileMenuOpen') && lines[i].includes('useState')) {
    pProfileLine = i;
    break;
  }
}
console.log('Partner profileMenuOpen at line:', pProfileLine + 1);

if (pProfileLine >= 0) {
  const stateBlock = [
    '  // Onboarding tour',
    "  const [showTour, setShowTour] = useState(() => !sessionStorage.getItem('partner_tour_done'));",
    '  const [tourStep, setTourStep] = useState(0);',
    '  // FAQ state',
    "  const [faqSearch, setFaqSearch] = useState('');",
    '  const [faqOpenItem, setFaqOpenItem] = useState(null);',
    "  const [faqCategory, setFaqCategory] = useState('all');"
  ];
  lines.splice(pProfileLine + 1, 0, ...stateBlock);
  console.log('Partner state added after line', pProfileLine + 1);
}

content = lines.join('\n');
lines = content.split('\n');

// Find partner </main>
let partnerMainIdx = -1;
for (let i = partnerFnLine + 100; i < lines.length; i++) {
  if (lines[i] && lines[i].trim() === '</main>') {
    partnerMainIdx = i;
    break;
  }
}
console.log('Partner </main> at line:', partnerMainIdx + 1);

const partnerFaqJSX = `
          {/* Partner FAQ & Help Page */}
          {activePage === 'p-faq' && (() => {
            const FAQS = [
              { id: 1, cat: 'getting-started', q: 'What is the Partner Portal?', a: 'The Partner Portal lets you monitor and manage disputes on behalf of your onboarded merchants from a single dashboard.' },
              { id: 2, cat: 'getting-started', q: 'How do I see disputes for my merchants?', a: 'All disputes for your affiliated merchants are displayed on the Portfolio Analytics dashboard. Click any stat card or go to Dispute Management to see individual cases.' },
              { id: 3, cat: 'getting-started', q: 'What are the different dispute tabs?', a: 'Action Required = disputes needing your action. Under Review = cases submitted, awaiting decision. Closed = fully resolved disputes.' },
              { id: 4, cat: 'disputes', q: 'How do I submit evidence for a merchant?', a: 'Open the dispute from Action Required, click "Take Action", select "Reject & Upload Evidence", then upload supporting documents. Max 20MB per file.' },
              { id: 5, cat: 'disputes', q: 'Can I view closed disputes?', a: 'Yes. Navigate to the Closed tab. All resolved cases are visible with their final status. Click the eye icon for full details.' },
              { id: 6, cat: 'disputes', q: 'What happens after I submit evidence?', a: 'The dispute moves to Under Review while the acquirer and scheme network examine your submission. The final outcome appears in the Closed tab.' },
              { id: 7, cat: 'merchants', q: 'How do I view merchant details?', a: 'Go to "Merchant Details" in the sidebar. Search by name or MID, and click "View" to see the full profile and business information.' },
              { id: 8, cat: 'merchants', q: 'Can I onboard new merchants?', a: 'Merchant onboarding is handled through the admin portal. Contact your ISU account manager to register new merchants.' },
              { id: 9, cat: 'documents', q: 'What documents are needed for evidence?', a: 'Upload proof of delivery, signed agreements, communication records, transaction receipts, or refund proof as applicable.' },
              { id: 10, cat: 'documents', q: 'What file formats are accepted?', a: 'PDF, JPEG, PNG. Max 20MB each. Up to 3 documents per dispute response.' },
              { id: 11, cat: 'sla', q: 'What is the TAT for partner actions?', a: 'Each dispute has a response deadline. Chargebacks: 20-45 days. Pre-Arbitration: 10-15 days. Missing the deadline = automatic loss.' },
              { id: 12, cat: 'account', q: 'How do I contact support?', a: 'Email support@isu-disputes.com or contact your ISU relationship manager. Include the Case ID for faster resolution.' },
            ];
            const cats = [
              { key: 'all', label: 'All Topics' },
              { key: 'getting-started', label: 'Getting Started' },
              { key: 'disputes', label: 'Disputes' },
              { key: 'merchants', label: 'Merchants' },
              { key: 'documents', label: 'Documents' },
              { key: 'sla', label: 'TAT & SLA' },
              { key: 'account', label: 'Account' },
            ];
            const filtered = FAQS.filter(f => {
              const matchCat = faqCategory === 'all' || f.cat === faqCategory;
              const matchSearch = !faqSearch || f.q.toLowerCase().includes(faqSearch.toLowerCase());
              return matchCat && matchSearch;
            });
            const grouped = cats.filter(c => c.key !== 'all').map(c => ({ ...c, items: filtered.filter(f => f.cat === c.key) })).filter(c => c.items.length > 0);
            return (
              <div className="page active">
                <div className="page-inner">
                  <div className="faq-page">
                    <div className="faq-hero">
                      <div className="faq-hero-icon">{String.fromCodePoint(0x2753)}</div>
                      <div>
                        <h1>FAQ & Help Center</h1>
                        <p>Answers to common questions about managing disputes through the ISU Partner Portal.</p>
                      </div>
                    </div>
                    <div className="faq-search">
                      <span className="faq-search-icon">{String.fromCodePoint(0x1F50D)}</span>
                      <input type="text" placeholder="Search your question..." value={faqSearch} onChange={e => setFaqSearch(e.target.value)} />
                    </div>
                    <div className="faq-categories">
                      {cats.map(c => (
                        <button key={c.key} className={'faq-cat-btn ' + (faqCategory === c.key ? 'active' : '')} onClick={() => setFaqCategory(c.key)}>{c.label}</button>
                      ))}
                    </div>
                    {faqCategory === 'all' ? (
                      grouped.map(grp => (
                        <div className="faq-section" key={grp.key}>
                          <div className="faq-section-title">{grp.label}</div>
                          {grp.items.map(f => (
                            <div key={f.id} className={'faq-item ' + (faqOpenItem === f.id ? 'open' : '')}>
                              <div className="faq-q" onClick={() => setFaqOpenItem(faqOpenItem === f.id ? null : f.id)}>
                                <span className="faq-q-text">{f.q}</span>
                                <span className="faq-q-icon">{String.fromCodePoint(0x25BC)}</span>
                              </div>
                              <div className="faq-answer">{f.a}</div>
                            </div>
                          ))}
                        </div>
                      ))
                    ) : (
                      <div className="faq-section">
                        {filtered.map(f => (
                          <div key={f.id} className={'faq-item ' + (faqOpenItem === f.id ? 'open' : '')}>
                            <div className="faq-q" onClick={() => setFaqOpenItem(faqOpenItem === f.id ? null : f.id)}>
                              <span className="faq-q-text">{f.q}</span>
                              <span className="faq-q-icon">{String.fromCodePoint(0x25BC)}</span>
                            </div>
                            <div className="faq-answer">{f.a}</div>
                          </div>
                        ))}
                        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No results found. Try a different search or category.</div>}
                      </div>
                    )}
                    <div className="faq-cta">
                      <h3>Still need help?</h3>
                      <p>Our support team is available Monday-Friday, 9 AM - 6 PM IST.</p>
                      <div className="faq-cta-btns">
                        <button className="btn btn-primary" onClick={() => showToast('Support request sent! Our team will contact you shortly.', 'success')}>Email Support</button>
                        <button className="btn btn-outline" onClick={() => { setShowTour(true); setTourStep(0); setActivePage('p-dashboard'); }}>Restart Portal Tour</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
`;

if (partnerMainIdx >= 0) {
  lines.splice(partnerMainIdx, 0, partnerFaqJSX);
  console.log('Partner FAQ inserted before line', partnerMainIdx + 1);
}

// Now insert Partner Tour overlay
content = lines.join('\n');
lines = content.split('\n');

// Find 'NATIVE CHART COMPONENTS'
let chartLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('NATIVE CHART COMPONENTS')) {
    chartLine = i;
    break;
  }
}

// PartnerPortal closing } is just before chart comments
// Search backward from chartLine for the function closing brace
let partnerEnd = -1;
for (let i = chartLine - 1; i > chartLine - 10; i--) {
  if (lines[i] && lines[i].trim() === '}') {
    partnerEnd = i;
    break;
  }
}
console.log('Partner function end } at line:', partnerEnd + 1);

// Find );  before that
let partnerReturnEnd = -1;
for (let i = partnerEnd - 1; i > partnerEnd - 5; i--) {
  if (lines[i] && lines[i].trim() === ');') {
    partnerReturnEnd = i;
    break;
  }
}

// Find last </div> before );
let lastDiv = -1;
for (let i = partnerReturnEnd - 1; i > partnerReturnEnd - 5; i--) {
  if (lines[i] && lines[i].trim().includes('</div>')) {
    lastDiv = i;
    break;
  }
}
console.log('Partner last </div> at line:', lastDiv + 1);

const partnerTourJSX = `
      {/* Partner Onboarding Tour Overlay */}
      {showTour && (() => {
        const STEPS = [
          { title: 'Welcome to Partner Portal', body: 'This quick tour shows you how to manage disputes on behalf of your merchants. Click "Skip Tour" anytime to dismiss.' },
          { title: 'Portfolio Analytics', body: 'Your home dashboard displays live stats: total disputes, evidence submitted, won & lost counts, and SLA alerts across all your merchants.' },
          { title: 'Dispute Management', body: 'View and manage disputes here. Use the Action Required, Under Review, and Closed tabs to track each case lifecycle.' },
          { title: 'Merchant Details', body: 'Browse your onboarded merchants, view their profiles, MIDs, TIDs, and business information from a single place.' },
          { title: 'FAQ & Help', body: 'Find answers to common partner questions, document requirements, and TAT guidelines in the FAQ section.' },
          { title: 'All set!', body: 'Your partner portal is ready. Monitor your merchants disputes and respond before TAT deadlines. Good luck!' },
        ];
        const step = STEPS[tourStep];
        const isLast = tourStep === STEPS.length - 1;
        const skipTour = () => { sessionStorage.setItem('partner_tour_done', '1'); setShowTour(false); };
        const nextStep = () => { if (isLast) { skipTour(); } else { setTourStep(tourStep + 1); } };
        return (
          <div className="tour-overlay" style={{ pointerEvents: 'all' }}>
            <div className="tour-backdrop" onClick={skipTour} />
            <div className="tour-popover" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
              <div className="tour-popover-header">
                <h3>{step.title}</h3>
                <span className="tour-popover-step">{tourStep + 1} / {STEPS.length}</span>
              </div>
              <div className="tour-popover-body"><p>{step.body}</p></div>
              <div className="tour-popover-footer">
                <button className="tour-btn-skip" onClick={skipTour}>Skip Tour</button>
                <div className="tour-dots">
                  {STEPS.map((_, i) => <span key={i} className={'tour-dot ' + (i === tourStep ? 'active' : '')} />)}
                </div>
                <button className={'tour-btn-next ' + (isLast ? 'tour-btn-finish' : '')} onClick={nextStep}>
                  {isLast ? 'Done' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
`;

if (lastDiv >= 0) {
  lines.splice(lastDiv, 0, partnerTourJSX);
  console.log('Partner tour inserted before line', lastDiv + 1);
}

content = lines.join('\n');
fs.writeFileSync(filePath, content, 'utf8');
console.log('\nDone! New file has', content.split('\n').length, 'lines');
