const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  merchant: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Credit', 'Debit'],
    required: true
  },
  amount: {
    type: String, // Keep amount formatted or store as Number. Let's store as Number.
    type: Number,
    required: true
  },
  date: {
    type: String, // Store formatted date (YYYY-MM-DD)
    required: true
  },
  remarks: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Ledger', ledgerSchema);
