const { buildDefaultUsers, buildSeedLedger, PARTNER_ID } = require('./seed/demoData');

let users = [];
let chargebacks = [];
let ledger = [];

function resetDemo() {
  const TODAY = new Date();
  const { buildSeedData } = require('./routes/auth');

  users = buildDefaultUsers().map((u) => ({
    ...u,
    _id: u.username,
    toObject: () => ({ ...u, _id: u.username }),
    save: async function save() { return this; }
  }));

  chargebacks = attachPartnerId(buildSeedData(TODAY)).map((cb) => ({
    ...cb,
    _id: cb.id,
    toObject: () => ({ ...cb }),
    save: async function save() {
      const idx = chargebacks.findIndex((c) => c.id === this.id);
      if (idx >= 0) chargebacks[idx] = { ...this };
      return this;
    }
  }));

  ledger = buildSeedLedger(TODAY).map((row) => ({
    ...row,
    _id: row.id
  }));

  return { users: users.length, chargebacks: chargebacks.length, ledger: ledger.length };
}

function attachPartnerId(rows) {
  return rows.map((cb) => ({ ...cb, partnerId: PARTNER_ID }));
}

function getUsers() {
  return users.map((u) => {
    const { toObject, save, ...rest } = u;
    return { ...rest };
  });
}

function findUser(query) {
  if (query.username) return users.find((u) => u.username === query.username) || null;
  return null;
}

function updateUserWallet(username, newBalance) {
  const u = users.find((x) => x.username === username);
  if (u) u.walletBalance = newBalance;
}

function getChargebacks(query = {}) {
  let list = [...chargebacks];
  if (query.userName) list = list.filter((c) => c.userName === query.userName);
  if (query.partnerId) list = list.filter((c) => c.partnerId === query.partnerId);
  if (query.id) list = list.filter((c) => c.id === query.id);
  return list.map((c) => {
    const { save, toObject, ...rest } = c;
    return { ...rest };
  }).sort((a, b) => (b.createdDate || '').localeCompare(a.createdDate || ''));
}

function findChargebackById(id) {
  return chargebacks.find((c) => c.id === id) || null;
}

function getLedger(query = {}) {
  let list = [...ledger];
  if (query.merchant) list = list.filter((l) => l.merchant === query.merchant);
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function addLedgerEntry(entry) {
  ledger.unshift({ ...entry, _id: entry.id });
  return entry;
}

function countLedger() {
  return ledger.length;
}

// Preload demo data for cold starts (refreshed again when MOCK_MODE is confirmed)
resetDemo();

module.exports = {
  PARTNER_ID,
  resetDemo,
  getUsers,
  findUser,
  updateUserWallet,
  getChargebacks,
  findChargebackById,
  getLedger,
  addLedgerEntry,
  countLedger
};
