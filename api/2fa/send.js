import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { sendVerificationEmail } from '../../backend/src/config/email.js';
import { generateVerificationCode, getCodeExpiry } from '../../backend/src/utils/twoFaUtils.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, type = 'login' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!['login', 'withdrawal'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "login" or "withdrawal"' });
    }

    console.log(`📧 Sending 2FA code to ${email} (type: ${type})`);

    // Get user_id from Supabase auth by email
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Auth lookup error:', authError);
      return res.status(500).json({ error: 'Failed to lookup user' });
    }

    const user = users?.find(u => u.email === email);
    
    if (!user) {
      console.log(`User not found for email: ${email}`);
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user.id;

    // Generate code
    const code = generateVerificationCode();
    const expiresAt = getCodeExpiry();

    // Store code in Supabase
    const { data, error } = await supabase
      .from('two_factor_codes')
      .insert([
        {
          user_id: userId,
          email,
          code,
          type: type === 'login' ? 'login' : 'withdrawal',
          code_type: type,
          expires_at: expiresAt
        }
      ])
      .select();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create verification code' });
    }

    // Send email
    await sendVerificationEmail(email, code);

    res.json({
      success: true,
      message: 'Verification code sent to email',
      email,
      type
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
