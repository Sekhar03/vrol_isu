const mongoose = require('mongoose');

const connectDB = async () => {
  const connString = process.env.MONGO_URI;

  if (!connString) {
    console.warn('[data] MONGO_URI not set — using in-memory demo store');
    global.MOCK_MODE = true;
    return;
  }

  try {
    const conn = await mongoose.connect(connString, { serverSelectionTimeoutMS: 8000 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    global.MOCK_MODE = false;
  } catch (error) {
    console.warn(`[WARN] MongoDB Connection Failed: ${error.message}`);
    console.warn(`[WARN] Falling back to IN-MEMORY MOCK MODE`);
    global.MOCK_MODE = true;
  }
};

module.exports = connectDB;
