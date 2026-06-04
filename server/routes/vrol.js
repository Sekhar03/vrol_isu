const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const prisma = require('../prismaClient');

const upload = multer({ dest: 'uploads/vrol/' });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { path: filePath, originalname, mimetype } = req.file;
    const uploadedBy = req.body.uploadedBy || 'Admin';

    // Log the file import
    const fileImport = await prisma.fileImport.create({
      data: {
        fileName: originalname,
        fileType: mimetype,
        uploadedBy,
        status: 'PROCESSING'
      }
    });

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
      await prisma.fileImport.update({
        where: { id: fileImport.id },
        data: { status: 'FAILED', logs: 'Unsupported file format' }
      });
      return res.status(400).json({ error: 'Unsupported file format' });
    }

    // Process data and map columns (Dynamic mapping can be injected here)
    let processedCount = 0;
    
    // Fallback default merchant if none exists
    let defaultMerchant = await prisma.merchant.findFirst();
    if (!defaultMerchant) {
        defaultMerchant = await prisma.merchant.create({
            data: { name: 'Default Merchant', mid: '999999999' }
        });
    }

    for (const row of parsedData) {
      const visaCaseNumber = row['Visa Case Number'] || row['visa_case_no'];
      const disputeId = row['Dispute ID'] || row['dispute_id'] || `DISP-${Date.now()}-${Math.random()}`;
      
      if (visaCaseNumber || disputeId) {
        await prisma.dispute.upsert({
          where: { disputeId: disputeId },
          update: {
            visaCaseNumber,
            reasonCode: row['Reason Code'] || row['reason_code'],
            disputeAmount: parseFloat(row['Dispute Amount']) || undefined,
            status: 'DISPUTE_RECEIVED',
            merchantId: defaultMerchant.id
          },
          create: {
            disputeId,
            visaCaseNumber,
            reasonCode: row['Reason Code'] || row['reason_code'],
            disputeAmount: parseFloat(row['Dispute Amount']) || 0,
            status: 'DISPUTE_RECEIVED',
            merchantId: defaultMerchant.id,
            arn: row['ARN'] || row['arn'],
            rrn: row['RRN'] || row['rrn']
          }
        });
        processedCount++;
      }
    }

    await prisma.fileImport.update({
      where: { id: fileImport.id },
      data: { status: 'COMPLETED', logs: `Successfully processed ${processedCount} records.` }
    });

    res.json({ message: 'File processed successfully', recordsProcessed: processedCount });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
