const http = require('http');

const testCode = `# A simple Python script
def greet(name):
    return "Hello, {name}!"

# Using a list and a loop
uss = ["Alice", "Bob", "Charlie"
for user in users:
    print(greet(user)`;

const data = JSON.stringify({
  code: testCode,
  language: 'auto'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/ai/ai-review',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => { responseData += chunk; });
  res.on('end', () => {
    console.log('=== RESPONSE STATUS:', res.statusCode, '===\n');
    console.log(responseData);
    console.log('\n=== END ===');
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});

req.write(data);
req.end();
