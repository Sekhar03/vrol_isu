const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');

const Chargeback = require('../models/Chargeback');
const mockStore = require('../mockStore');

const upload = multer({ dest: 'uploads/vrol/' });

// In-memory file imports log for demo purposes
const fileImports = [];

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: filePath, originalname, mimetype } = req.file;
    const uploadedBy = req.body.uploadedBy || 'Admin';

    // Log the file import in memory
    const fileImport = {
      id: 'import_' + Date.now(),
      fileName: originalname,
      fileType: mimetype,
      uploadedBy,
      status: 'PROCESSING',
      createdAt: new Date().toISOString()
    };
    fileImports.unshift(fileImport);

    const parsedData = [];
    
    if (originalname.endsWith('.csv')) {
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => parsedData.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
    } else if (originalname.endsWith('.xlsx')) {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(sheet);
      parsedData.push(...json);
    } else {
      fileImport.status = 'FAILED';
      fileImport.logs = 'Unsupported file format';
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    let processedCount = 0;

    for (const row of parsedData) {
      const visaCaseNumber = row['Visa Case Number'] || row['visa_case_no'] || row['visaId'] || row['Visa ID'] || '';
      const disputeId = row['Dispute ID'] || row['dispute_id'] || row['id'] || `DISP-${Date.now()}-${Math.floor(Math.random()*1000)}`;
      const rrn = row['RRN'] || row['rrn'] || 'RRN-' + Math.floor(Math.random()*1000000);
      const txnId = row['Txn ID'] || row['txnId'] || row['txn_id'] || 'TXN-' + Math.floor(Math.random()*1000000);
      const adjAmt = parseFloat(row['Dispute Amount'] || row['dispute_amount'] || row['adjAmt'] || row['amount'] || 100);
      const txnAmt = parseFloat(row['Transaction Amount'] || row['transaction_amount'] || row['txnAmt'] || row['amount'] || 100);
      const reasonCode = String(row['Reason Code'] || row['reason_code'] || '10.4');
      const adjType = row['Dispute Type'] || row['dispute_type'] || row['adjType'] || 'Chargeback';
      const userName = row['Merchant Name'] || row['merchant_name'] || row['userName'] || 'masteruser';
      const userId = row['MID'] || row['mid'] || row['userId'] || 'MID-10515104';
      const partnerId = row['Partner ID'] || row['partner_id'] || row['partnerId'] || 'partner1';
      
      const createdDate = row['Created Date'] || row['created_date'] || new Date().toISOString().split('T')[0];
      const txnDate = row['Txn Date'] || row['txn_date'] || row['transactionDate'] || new Date().toISOString().split('T')[0];
      const adjDate = row['Adj Date'] || row['adj_date'] || new Date().toISOString().split('T')[0];
      
      let respondByDate = row['Respond By Date'] || row['respond_by_date'] || row['respondByDate'];
      if (!respondByDate) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        respondByDate = d.toISOString().split('T')[0];
      }

      const timelineEntry = {
        by: 'VROL System',
        time: new Date().toLocaleString(),
        title: 'Dispute Imported via VROL',
        remarks: `Dispute Case imported/updated via VROL Import by ${uploadedBy}.`,
        file: null
      };

      if (global.MOCK_MODE) {
        let dispute = mockStore.findChargebackById(disputeId);
        if (dispute) {
          // Update existing
          dispute.mSubStatus = 'Document pending for Merchant';
          dispute.mStatus = adjType + ' Raise';
          dispute.adjAmt = adjAmt;
          dispute.reasonCode = reasonCode;
          dispute.respondByDate = respondByDate;
          dispute.timeline = dispute.timeline || [];
          dispute.timeline.unshift({
            ...timelineEntry,
            title: 'Dispute Updated via VROL',
            remarks: `Dispute Case updated via VROL Import. Previous Sub-Status: ${dispute.mSubStatus}`
          });
          await dispute.save();
        } else {
          // Create new
          mockStore.addChargeback({
            id: disputeId,
            caseId: disputeId,
            visaId: visaCaseNumber || disputeId,
            userName,
            userId,
            rrn,
            txnId,
            createdDate,
            txnDate,
            adjDate,
            respondByDate,
            mStatus: adjType + ' Raise',
            mSubStatus: 'Document pending for Merchant',
            adjType,
            txnAmt,
            adjAmt,
            partnerId,
            timeline: [timelineEntry],
            documents: []
          });
        }
      } else {
        // MongoDB mode
        let dispute = await Chargeback.findOne({ $or: [{ id: disputeId }, { visaId: visaCaseNumber }] });
        if (dispute) {
          dispute.mSubStatus = 'Document pending for Merchant';
          dispute.mStatus = adjType + ' Raise';
          dispute.adjAmt = adjAmt;
          dispute.reasonCode = reasonCode;
          dispute.respondByDate = respondByDate;
          dispute.timeline.unshift({
            ...timelineEntry,
            title: 'Dispute Updated via VROL',
            remarks: `Dispute Case updated via VROL Import. Previous Sub-Status: ${dispute.mSubStatus}`
          });
          await dispute.save();
        } else {
          dispute = new Chargeback({
            id: disputeId,
            caseId: disputeId,
            visaId: visaCaseNumber || disputeId,
            userName,
            userId,
            rrn,
            txnId,
            createdDate,
            txnDate,
            adjDate,
            respondByDate,
            mStatus: adjType + ' Raise',
            mSubStatus: 'Document pending for Merchant',
            adjType,
            txnAmt,
            adjAmt,
            partnerId,
            timeline: [timelineEntry],
            documents: []
          });
          await dispute.save();
        }
      }
      processedCount++;
    }

    fileImport.status = 'COMPLETED';
    fileImport.logs = `Successfully processed ${processedCount} records.`;

    res.json({ message: 'File processed successfully', recordsProcessed: processedCount });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
