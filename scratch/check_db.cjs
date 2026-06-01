const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

let supabaseUrl = 'https://ltzdpypjlgfwhbcivlpx.supabase.co';
let supabaseKey = '';

try {
  const envFile = fs.readFileSync('.env', 'utf8');
  envFile.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim();
      if (key === 'VITE_SUPABASE_URL') supabaseUrl = val;
      if (key === 'VITE_SUPABASE_PUBLISHABLE_KEY') supabaseKey = val;
    }
  });
} catch (e) {
  console.error("Could not read .env file:", e.message);
}

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key Length:", supabaseKey.length);

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: txs, error: err1 } = await supabase
    .from('paypal_transactions')
    .select('*')
    .limit(5);
    
  console.log('Existing transactions:', txs);
  console.log('Query error:', err1);
}

check();
