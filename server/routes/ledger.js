const express = require('express');
const router = express.Router();
const Ledger = require('../models/Ledger');
const User = require('../models/User');

// Get adjustment ledger logs
router.get('/', async (req, res) => {
  try {
    const logs = await Ledger.find({}).sort({ createdAt: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Post a new wallet adjustment (modifies target merchant's wallet balance)
router.post('/', async (req, res) => {
  try {
    const { merchant, type, amount, remarks } = req.body;
    
    if (!merchant || !type || !amount || !remarks) {
      return res.status(400).json({ message: 'Merchant, type, amount, and remarks are required' });
    }

    // Find target merchant
    const user = await User.findOne({ username: merchant });
    if (!user) {
      return res.status(404).json({ message: `Merchant '${merchant}' not found` });
    }

    // Apply adjustments
    const adjAmt = parseFloat(amount);
    if (type === 'Credit') {
      user.walletBalance += adjAmt;
    } else if (type === 'Debit') {
      user.walletBalance -= adjAmt;
    } else {
      return res.status(400).json({ message: 'Invalid adjustment type (must be Credit or Debit)' });
    }

    // Save target user balance
    await user.save();

    // Create ledger entry
    const TODAY = new Date();
    const fmtDate = d => d.toISOString().split('T')[0];
    const logId = 'ADJ' + (await Ledger.countDocuments() + 101);

    const newLog = new Ledger({
      id: logId,
      merchant,
      type,
      amount: adjAmt,
      date: fmtDate(TODAY),
      remarks
    });

    const savedLog = await newLog.save();
    res.status(201).json({ ledgerLog: savedLog, walletBalance: user.walletBalance });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
