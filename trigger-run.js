// Simple script to trigger a run via API
const http = require('http');

const runId = process.argv[2] || 'ed818629-00c4-49b0-9e35-f1b8fe4ecdea';

console.log(`🚀 Attempting to start Run ID: ${runId}`);
console.log('   Checking if server is running at http://localhost:3000...\n');

const postData = JSON.stringify({});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: `/api/runs/${runId}/start`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log(`📊 Response Status: ${res.statusCode}`);
  console.log(`📊 Response Headers:`, res.headers);
  console.log('');

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      if (res.statusCode === 200) {
        console.log('✅ SUCCESS! Analysis has been started.');
        console.log('');
        console.log('📋 Response:', JSON.stringify(response, null, 2));
        console.log('');
        console.log('💡 The analysis is now running in the background.');
        console.log('💡 Check the analysis log file for progress:');
        console.log(`   analysis-run-${runId}.log`);
        console.log('');
        console.log('💡 Or watch the dashboard at http://localhost:3000');
      } else {
        console.log('❌ FAILED to start analysis.');
        console.log('');
        console.log('📋 Error Response:', JSON.stringify(response, null, 2));
        console.log('');
        if (response.error) {
          console.log('💡 Error details:', response.error);
        }
      }
    } catch (e) {
      console.log('📄 Raw Response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ ERROR: Failed to connect to server');
  console.error('   Error:', error.message);
  console.error('');
  console.error('💡 Make sure the server is running:');
  console.error('   npm run dev');
});

req.write(postData);
req.end();


