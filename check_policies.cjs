const fs = require('fs');
const https = require('https');

const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].replace(/\r/g, '').trim();
    const val = match[2].replace(/\r/g, '').trim();
    env[key] = val;
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_PUBLISHABLE_KEY'];

const url = new URL(`${supabaseUrl}/rest/v1/rpc/exec_sql`);

const options = {
  method: 'POST',
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json'
  }
};

const req = https.request(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Response:", data);
  });
});

req.on('error', err => console.error(err));
req.write(JSON.stringify({ query: "SELECT * FROM pg_policies WHERE tablename = 'marketplace_products';" }));
req.end();
