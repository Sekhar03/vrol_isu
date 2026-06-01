const connectDB = require('./config/db');
const mockStore = require('./mockStore');

let initPromise = null;

async function initData() {
  await connectDB();

  if (global.MOCK_MODE) {
    const counts = mockStore.resetDemo();
    console.log('[data] In-memory demo ready:', counts);
    return;
  }

  try {
    const Chargeback = require('./models/Chargeback');
    const count = await Chargeback.countDocuments();
    if (count === 0) {
      const { seedAllDemoData } = require('./seed/demoData');
      const counts = await seedAllDemoData();
      console.log('[data] MongoDB demo seeded:', counts);
    } else {
      const missingPartner = await Chargeback.countDocuments({
        $or: [{ partnerId: null }, { partnerId: { $exists: false } }]
      });
      if (missingPartner > 0) {
        await Chargeback.updateMany(
          { $or: [{ partnerId: null }, { partnerId: { $exists: false } }] },
          { $set: { partnerId: mockStore.PARTNER_ID } }
        );
        console.log(`[data] Backfilled partnerId on ${missingPartner} chargebacks`);
      }
    }
  } catch (err) {
    console.warn('[data] Mongo unavailable, using in-memory demo:', err.message);
    global.MOCK_MODE = true;
    mockStore.resetDemo();
  }
}

function ensureDataReady() {
  if (!initPromise) {
    initPromise = initData().catch((err) => {
      console.error('[data] init failed:', err);
      global.MOCK_MODE = true;
      mockStore.resetDemo();
    });
  }
  return initPromise;
}

module.exports = { ensureDataReady, initData };
