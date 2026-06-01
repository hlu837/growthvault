import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { data } = await supabase
    .from('two_factor_codes')
    .select('*')
    .eq('email', 'ronkeolakulehin@gmail.com')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('All codes for ronkeolakulehin@gmail.com:', JSON.stringify(data, null, 2));
}

run();
