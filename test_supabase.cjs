const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('seller_applications')
    .select('*, user:profiles(full_name, email)');
  console.log('Applications:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

check();
