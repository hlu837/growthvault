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

const url = new URL(`${supabaseUrl}/rest/v1/seller_applications?select=id,status,business_name`);

const options = {
  headers: {
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`
  }
};

https.get(url, options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log("Current Applications:");
    console.log(JSON.parse(data));
  });
}).on('error', err => console.error(err));
