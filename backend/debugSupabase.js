// debugSupabase.js
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
  try {
    console.log('📋 Listing all users in auth.users...');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error listing users:', usersError);
      return;
    }

    console.log(`Found ${users.length} users:`);
    users.forEach(u => {
      console.log(`  - ${u.email} (ID: ${u.id})`);
    });

    if (users.length === 0) {
      console.log('\n⚠️  No users found. Creating a test user...');
      const { data: newUser, error: signUpError } = await supabase.auth.admin.createUser({
        email: 'test@growthvault.com',
        password: 'TestPassword123!',
        email_confirm: true
      });

      if (signUpError) {
        console.error('❌ Error creating user:', signUpError);
        return;
      }

      console.log(`✅ Created test user: ${newUser.user.email} (ID: ${newUser.user.id})`);
      users.push(newUser.user);
    }

    // Now test 2FA code insertion with the first user
    const testUser = users[0];
    console.log(`\n🛠️  Attempting 2FA code insert for ${testUser.email}...`);
    
    const { data, error } = await supabase
      .from('two_factor_codes')
      .insert([
        {
          user_id: testUser.id,
          email: testUser.email,
          code: '123456',
          code_type: 'login',
          expires_at: new Date(Date.now() + 600000).toISOString()
        }
      ])
      .select();

    console.log('Response:');
    console.log({ data, error, status: error ? 'ERROR' : 'SUCCESS' });
    
    if (!error) {
      console.log('✅ 2FA code stored successfully!');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

run();
