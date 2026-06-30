const net = require('net');

const HOST = 'aws-1-ap-south-1.pooler.supabase.com';
const PORT = 6543;

console.log(`Attempting to connect to ${HOST}:${PORT} via TCP...`);

const client = new net.Socket();

client.setTimeout(5000);

client.connect(PORT, HOST, () => {
  console.log('SUCCESS: Connected to host successfully!');
  client.destroy();
});

client.on('error', (err) => {
  console.error('ERROR: Connection failed:', err.message);
  client.destroy();
});

client.on('timeout', () => {
  console.error('ERROR: Connection timed out after 5 seconds');
  client.destroy();
});
