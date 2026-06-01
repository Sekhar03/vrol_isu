const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/users',
  method: 'GET'
};

console.log('Sending GET request to /api/users to check API status...');

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('API Status: OK (200)');
      try {
        const users = JSON.parse(data);
        console.log(`Successfully verified! Found ${users.length} users in database.`);
        users.forEach(u => {
          console.log(`- User: ${u.username} (${u.name}), Wallet Balance: ${u.walletBalance}`);
        });
      } catch (err) {
        console.error('Error parsing JSON response:', err.message);
      }
    } else {
      console.error(`API returned error code: ${res.statusCode}`);
      console.log('Response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error(`Verification failed. Is the Express server running on port 5000? Error: ${e.message}`);
});

req.end();
