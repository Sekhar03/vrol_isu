const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const connString = process.env.MONGO_URI || 'mongodb://localhost:27017/iserveu_chargebacks';
    const conn = await mongoose.connect(connString);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
