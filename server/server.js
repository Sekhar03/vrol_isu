const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { ensureDataReady } = require('./initData');

// Load env vars
dotenv.config();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Ensure MongoDB or in-memory demo data before API handlers (serverless-safe)
app.use(async (req, res, next) => {
  try {
    await ensureDataReady();
    next();
  } catch (err) {
    next(err);
  }
});

const fs = require('fs');
const path = require('path');
const multer = require('multer');

// Configure multer for evidence uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });
app.post('/api/upload', upload.single('evidence'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routers
app.use('/api/users', require('./routes/auth'));
app.use('/api/disputes', require('./routes/disputes'));
app.use('/api/ledger', require('./routes/ledger'));
app.use('/api/vrol', require('./routes/vrol'));
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  ensureDataReady().then(() => {
    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  });
}

module.exports = app;