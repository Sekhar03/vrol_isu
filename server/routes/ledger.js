const express = require('express');
const router = express.Router();
const Ledger = require('../models/Ledger');
const User = require('../models/User');

router.get('/', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    const userName = req.headers['x-user-name'];

    let query = {};
    if (userRole === 'merchant' && userName) {
      query.merchant = userName;
    }

    if (global.MOCK_MODE) {
      return res.json(require('../mockStore').getLedger(query));
    }

    const entries = await Ledger.find(query).sort({ date: -1, createdAt: -1 });
    res.json(entries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { merchant, type, amount, remarks } = req.body;
    if (!merchant || !type || amount == null) {
      return res.status(400).json({ message: 'merchant, type, and amount are required' });
    }
    if (!['Credit', 'Debit'].includes(type)) {
      return res.status(400).json({ message: 'type must be Credit or Debit' });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    if (global.MOCK_MODE) {
      const mockStore = require('../mockStore');
      const user = mockStore.findUser({ username: merchant });
      if (!user) return res.status(404).json({ message: 'Merchant not found' });

      let balance = user.walletBalance;
      if (type === 'Credit') balance += parsedAmount;
      else balance -= parsedAmount;
      mockStore.updateUserWallet(merchant, balance);

      const entry = {
        id: `ADJ${mockStore.countLedger() + 101}`,
        merchant,
        type,
        amount: parsedAmount,
        date: new Date().toISOString().split('T')[0],
        remarks: remarks || ''
      };
      mockStore.addLedgerEntry(entry);
      return res.status(201).json(entry);
    }

    const user = await User.findOne({ username: merchant });
    if (!user) {
      return res.status(404).json({ message: 'Merchant not found' });
    }

    if (type === 'Debit' && user.walletBalance < parsedAmount) {
      user.walletBalance = user.walletBalance - parsedAmount;
    } else if (type === 'Credit') {
      user.walletBalance += parsedAmount;
    } else {
      user.walletBalance -= parsedAmount;
    }
    await user.save();

    const count = await Ledger.countDocuments();
    const entry = await Ledger.create({
      id: `ADJ${count + 101}`,
      merchant,
      type,
      amount: parsedAmount,
      date: new Date().toISOString().split('T')[0],
      remarks: remarks || ''
    });

    res.status(201).json(entry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
