const express = require('express');
const router = express.Router();
const Chargeback = require('../models/Chargeback');

// Get disputes with filtering and RBAC
router.get('/', async (req, res) => {
  try {
    const { from, to, rrn, status, subStatus, search } = req.query;
    const userRole = req.headers['x-user-role'];
    const userName = req.headers['x-user-name'];
    const partnerId = req.headers['x-partner-id'];

    let query = {};

    // Role-Based Access Control
    if (userRole === 'merchant') {
      if (!userName) return res.status(400).json({ message: 'Missing x-user-name header for merchant' });
      query.userName = userName;
    } else if (userRole === 'partner') {
      if (!partnerId) return res.status(400).json({ message: 'Missing x-partner-id header for partner' });
      query.partnerId = partnerId;
    }
    // Admin sees all, no query restriction needed

    if (from || to) {
      query.createdDate = {};
      if (from) query.createdDate.$gte = from;
      if (to) query.createdDate.$lte = to;
    }
    if (rrn) {
      query.rrn = new RegExp(rrn, 'i');
    }
    if (status) {
      query.mStatus = status;
    }
    if (subStatus) {
      query.mSubStatus = subStatus;
    }
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { rrn: searchRegex },
        { txnId: searchRegex },
        { userName: searchRegex },
        { mStatus: searchRegex },
        { mSubStatus: searchRegex }
      ];
    }

    if (global.MOCK_MODE) {
      const mockStore = require('../mockStore');
      return res.json(mockStore.getChargebacks(query));
    }

    const disputes = await Chargeback.find(query).sort({ createdDate: -1 });
    res.json(disputes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a single dispute
router.post('/', async (req, res) => {
  try {
    const newDispute = new Chargeback(req.body);
    const saved = await newDispute.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Bulk upload disputes
router.post('/bulk-upload', async (req, res) => {
  try {
    const records = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ message: 'Payload must be an array of disputes' });
    }
    const inserted = await Chargeback.insertMany(records);
    res.status(201).json({ message: `Successfully imported ${inserted.length} records`, inserted });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a dispute (Take merchant action, timeline post, admin review)
router.put('/:id', async (req, res) => {
  try {
    if (global.MOCK_MODE) {
      const mockStore = require('../mockStore');
      const dispute = mockStore.findChargebackById(req.params.id);
      if (!dispute) return res.status(404).json({ message: 'Dispute not found' });
      const updates = req.body;
      if (updates.merchantAction !== undefined) dispute.merchantAction = updates.merchantAction;
      if (updates.adminAction !== undefined) dispute.adminAction = updates.adminAction;
      if (updates.mStatus !== undefined) dispute.mStatus = updates.mStatus;
      if (updates.mSubStatus !== undefined) dispute.mSubStatus = updates.mSubStatus;
      if (updates.rejectReason !== undefined) dispute.rejectReason = updates.rejectReason;
      if (updates.visaPending !== undefined) dispute.visaPending = updates.visaPending;
      if (updates.timelineEntry) {
        dispute.timeline = dispute.timeline || [];
        dispute.timeline.unshift(updates.timelineEntry);
      }
      const { save, toObject, ...rest } = dispute;
      return res.json({ ...rest });
    }

    const dispute = await Chargeback.findOne({ id: req.params.id });
    if (!dispute) {
      return res.status(404).json({ message: 'Dispute not found' });
    }

    // Apply any updates passed in body
    const updates = req.body;
    
    if (updates.merchantAction !== undefined) dispute.merchantAction = updates.merchantAction;
    if (updates.adminAction !== undefined) dispute.adminAction = updates.adminAction;
    if (updates.mStatus !== undefined) dispute.mStatus = updates.mStatus;
    if (updates.mSubStatus !== undefined) dispute.mSubStatus = updates.mSubStatus;
    if (updates.rejectReason !== undefined) dispute.rejectReason = updates.rejectReason;
    if (updates.visaPending !== undefined) dispute.visaPending = updates.visaPending;
    
    // If a timeline entry is provided in updates, push it to timeline array
    if (updates.timelineEntry) {
      dispute.timeline.unshift(updates.timelineEntry); // Prepend to show newest first
    }

    const updated = await dispute.save();
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});
// Process dispute action (accept, contest, escalate)
router.post('/:id/action', async (req, res) => {
  try {
    const { action, evidence, comments } = req.body;
    const dispute = await Chargeback.findOne({ id: req.params.id });
    if (!dispute) return res.status(404).json({ message: 'Dispute not found' });

    if (action === 'accept') {
      dispute.resolution = 'Lost';
      dispute.mSubStatus = 'Chargeback Lost';
      dispute.merchantAction = 'accepted';
      dispute.timeline.unshift({ by: req.headers['x-user-name'] || 'System', time: new Date().toISOString(), title: 'Accepted Liability', remarks: 'Merchant accepted the dispute loss.', file: null });
    } else if (action === 'contest') {
      dispute.mSubStatus = 'Chargeback in Progress';
      dispute.merchantAction = 'evidence';
      dispute.timeline.unshift({ by: req.headers['x-user-name'] || 'System', time: new Date().toISOString(), title: 'Evidence Submitted', remarks: comments || 'Evidence provided to fight dispute.', file: evidence || null });
    } else if (action === 'escalate') {
      dispute.mStatus = 'Pre-Arbitration';
      dispute.mSubStatus = 'Pending Visa Review';
      dispute.timeline.unshift({ by: 'Admin', time: new Date().toISOString(), title: 'Escalated to Pre-Arb', remarks: 'Case sent to Visa for Pre-Arbitration.', file: null });
    }

    const updated = await dispute.save();
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
