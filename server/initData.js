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
    const { seedAllDemoData } = require('./seed/demoData');
    const counts = await seedAllDemoData();
    console.log('[data] MongoDB demo seeded fresh:', counts);
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
