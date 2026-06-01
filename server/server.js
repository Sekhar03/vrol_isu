const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// MOCK_MODE Interceptor for Vercel Demo
app.use((req, res, next) => {
  if (global.MOCK_MODE && req.method === 'GET') {
    if (req.path === '/api/users' || req.path === '/api/users/') {
      return res.json([
        { username: 'Test@isu', password: 'Test@2026', role: 'merchant', name: 'masteruser' },
        { username: 'masteruser', password: 'Test@2026', role: 'merchant', name: 'masteruser' },
        { username: 'Test@Ad', password: 'Test@2027', role: 'admin', name: 'Krishna Das' },
        { username: 'partneruser', password: 'Test@2028', role: 'partner', name: 'Arjun Mehta (Partner)' }
      ]);
    }
    if (req.path.startsWith('/api/users/')) {
       // mock single user
       return res.json({ username: 'masteruser', password: 'Test@2026', role: 'merchant', name: 'masteruser' });
    }
    if (req.path === '/api/disputes' || req.path === '/api/disputes/') {
      const auth = require('./routes/auth');
      return res.json(auth.buildSeedData(new Date()));
    }
  }
  
  if (global.MOCK_MODE && req.method === 'POST') {
     return res.json({ message: 'Success (Mock Mode)' });
  }

  next();
});

// Mount routers
app.use('/api/users', require('./routes/auth'));
app.use('/api/disputes', require('./routes/disputes'));
const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

module.exports = app;