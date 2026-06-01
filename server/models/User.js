const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['merchant', 'admin'],
    required: true
  },
  name: {
    type: String,
    required: true
  },
  walletBalance: {
    type: Number,
    required: true,
    default: 0
  }
});

module.exports = mongoose.model('User', userSchema);
