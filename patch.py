import sys

filepath = 'client/src/App.jsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

old1 = '''  const [dashFilterFrom, setDashFilterFrom] = useState(DEFAULT_FROM);
  const [dashFilterTo, setDashFilterTo] = useState(TODAY_STR);
  const [dashDateRangeType, setDashDateRangeType] = useState('custom');'''

new1 = '''  const [dashDateRangeType, setDashDateRangeType] = useState('7days');
  const [dashFilterFrom, setDashFilterFrom] = useState(() => { let d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
  const [dashFilterTo, setDashFilterTo] = useState(TODAY_STR);'''

content = content.replace(old1, new1)

old2 = '''        if (filterSearchBy === 'Case ID' && !cb.caseId?.includes(filterRrn) && !cb.id?.includes(filterRrn)) return false;
        if (!filterSearchBy && !cb.rrn.includes(filterRrn) && !cb.txnId.includes(filterRrn) && !cb.userId.includes(filterRrn) && !cb.id?.includes(filterRrn)) return false;'''

new2 = '''        if (filterSearchBy === 'Case ID' && !cb.caseId?.includes(filterRrn) && !cb.id?.includes(filterRrn)) return false;
        if (filterSearchBy === 'Merchant Name' && !cb.userName?.toLowerCase().includes(filterRrn.toLowerCase())) return false;
        if (!filterSearchBy && !cb.rrn.includes(filterRrn) && !cb.txnId.includes(filterRrn) && !cb.userId.includes(filterRrn) && !cb.id?.includes(filterRrn) && !cb.userName?.toLowerCase().includes(filterRrn.toLowerCase())) return false;'''

content = content.replace(old2, new2)

old3 = '''                    <select
                      style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }}
                      value={dashDateRangeType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDashDateRangeType(val);
                        const today = new Date();
                        const todayStr = today.toISOString().split('T')[0];
                        if (val === 'yesterday') {
                          const y = new Date(today);
                          y.setDate(y.getDate() - 1);
                          setDashFilterFrom(y.toISOString().split('T')[0]);
                          setDashFilterTo(y.toISOString().split('T')[0]);
                        } else if (val === '7days') {
                          const d7 = new Date(today);
                          d7.setDate(d7.getDate() - 7);
                          setDashFilterFrom(d7.toISOString().split('T')[0]);
                          setDashFilterTo(todayStr);
                        } else if (val === 'lastmonth') {
                          const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                          const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                          setDashFilterFrom(lmStart.toISOString().split('T')[0]);
                          setDashFilterTo(lmEnd.toISOString().split('T')[0]);
                        }
                      }}
                    >
                      <option value="custom">Custom Date Range</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="lastmonth">Last Month</option>
                    </select>'''

new3 = '''                    <select
                      style={{ padding: '8px 12px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'var(--card)', fontSize: '13px' }}
                      value={dashDateRangeType}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDashDateRangeType(val);
                        const today = new Date();
                        const todayStr = today.toISOString().split('T')[0];
                        if (val === 'today') {
                          setDashFilterFrom(todayStr);
                          setDashFilterTo(todayStr);
                        } else if (val === 'yesterday') {
                          const y = new Date(today);
                          y.setDate(y.getDate() - 1);
                          setDashFilterFrom(y.toISOString().split('T')[0]);
                          setDashFilterTo(y.toISOString().split('T')[0]);
                        } else if (val === '7days') {
                          const d7 = new Date(today);
                          d7.setDate(d7.getDate() - 7);
                          setDashFilterFrom(d7.toISOString().split('T')[0]);
                          setDashFilterTo(todayStr);
                        } else if (val === 'lastmonth') {
                          const lmStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                          const lmEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                          setDashFilterFrom(lmStart.toISOString().split('T')[0]);
                          setDashFilterTo(lmEnd.toISOString().split('T')[0]);
                        }
                      }}
                    >
                      <option value="today">Today</option>
                      <option value="custom">Custom Date Range</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="lastmonth">Last Month</option>
                    </select>'''

content = content.replace(old3, new3)

old4 = '''                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>
                    <legend style={{ padding: '0 8px', color: '#50BDC9', fontWeight: '600', fontSize: '15px', marginLeft: '12px' }}>Search</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                      {/* Col 1 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#50BDC9' }}>??</span>
                          <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="From Date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                        </div>
                        <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }}>
                          <option value="ISU">ISU</option>
                        </select>
                        <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                          <option value="">Dispute Status</option>
                          <option value="Dispute Won Partially">Dispute Won Partially</option>
                          <option value="Dispute Won Fully">Dispute Won Fully</option>
                          <option value="Dispute Lost � TAT Expired">Dispute Lost � TAT Expired</option>
                          <option value="Dispute Lost � Accepted">Dispute Lost � Accepted</option>
                          <option value="Document Rejected">Document Rejected</option>
                          <option value="Document Pending Verification">Document Pending Verification</option>
                          <option value="Document Pending for Merchant">Document Pending for Merchant</option>
                        </select>
                      </div>
                      {/* Col 2 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#50BDC9' }}>??</span>
                          <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="To Date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                        </div>
                        <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }}>
                          <option value="Visa">Visa</option>
                        </select>
                        <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                          <option value="">Search By</option>
                          <option value="Txn ID">Transaction ID (Txn ID)</option>
                          <option value="RRN">RRN</option>
                          <option value="TID">TID</option>
                          <option value="MID">MID</option>
                          <option value="Case ID">Case ID</option>
                        </select>
                      </div>
                      {/* Col 3 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterSubStatus} onChange={(e) => setFilterSubStatus(e.target.value)}>
                          <option value="">Dispute Type</option>
                          <option value="Chargeback">Chargeback</option>
                          <option value="Pre-Arbitration">Pre-Arbitration</option>
                          <option value="Retrieval Request">Retrieval Request</option>
                          <option value="Arbitration">Arbitration</option>
                        </select>
                        <div style={{ height: '38px' }}></div> {/* Empty space to align with the rest */}
                        <input type="text" style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="Search" value={filterRrn} onChange={(e) => setFilterRrn(e.target.value)} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                      <button style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: 'transparent', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={resetAdminCb}>Reset</button>
                      <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={filterAdminCb}>Search</button>
                    </div>
                  </fieldset>'''

new4 = '''                  <fieldset style={{ border: '1px solid #d1c4e9', borderRadius: '8px', padding: '24px', marginBottom: '24px', position: 'relative' }}>
                    <legend style={{ padding: '0 8px', color: '#50BDC9', fontWeight: '600', fontSize: '15px', marginLeft: '12px' }}>Search</legend>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                      {/* Col 1 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>From Date</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#50BDC9' }}>??</span>
                            <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="From Date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Vendor</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }}>
                            <option value="ISU">ISU</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Dispute Status</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">Dispute Status</option>
                            <option value="Dispute Won Partially">Dispute Won Partially</option>
                            <option value="Dispute Won Fully">Dispute Won Fully</option>
                            <option value="Dispute Lost - TAT Expired">Dispute Lost - TAT Expired</option>
                            <option value="Dispute Lost - Accepted">Dispute Lost - Accepted</option>
                            <option value="Document Rejected">Document Rejected</option>
                            <option value="Document Pending Verification">Document Pending Verification</option>
                            <option value="Document Pending for Merchant">Document Pending for Merchant</option>
                          </select>
                        </div>
                      </div>
                      {/* Col 2 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>To Date</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#50BDC9' }}>??</span>
                            <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => { if (!e.target.value) e.target.type = 'text'; }} style={{ width: '100%', padding: '10px 10px 10px 36px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="To Date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Scheme</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }}>
                            <option value="Visa">Visa</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Search By</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterSearchBy} onChange={(e) => setFilterSearchBy(e.target.value)}>
                            <option value="">Search By</option>
                            <option value="Txn ID">Transaction ID (Txn ID)</option>
                            <option value="RRN">RRN</option>
                            <option value="TID">TID</option>
                            <option value="MID">MID</option>
                            <option value="Case ID">Case ID</option>
                            <option value="Merchant Name">Merchant Name</option>
                          </select>
                        </div>
                      </div>
                      {/* Col 3 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Dispute Type</label>
                          <select style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', appearance: 'auto', background: 'transparent' }} value={filterSubStatus} onChange={(e) => setFilterSubStatus(e.target.value)}>
                            <option value="">Dispute Type</option>
                            <option value="Chargeback">Chargeback</option>
                            <option value="Pre-Arbitration">Pre-Arbitration</option>
                            <option value="Retrieval Request">Retrieval Request</option>
                            <option value="Arbitration">Arbitration</option>
                          </select>
                        </div>
                        <div style={{ height: '0px' }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a' }}>Search String</label>
                          <input type="text" style={{ width: '100%', padding: '10px', border: '1px solid #e0e0e0', borderRadius: '4px', color: '#757575', outline: 'none', background: 'transparent' }} placeholder="Search" value={filterRrn} onChange={(e) => setFilterRrn(e.target.value)} />
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                      <button style={{ padding: '8px 24px', border: '1px solid #50BDC9', background: 'transparent', color: '#50BDC9', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={resetAdminCb}>Reset</button>
                      <button style={{ padding: '8px 24px', border: 'none', background: '#50BDC9', color: '#fff', borderRadius: '4px', cursor: 'pointer', fontWeight: '500' }} onClick={filterAdminCb}>Search</button>
                    </div>
                  </fieldset>'''

content = content.replace(old4, new4)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Successfully patched with Python!")
