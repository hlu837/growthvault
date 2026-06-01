import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { sendPasswordResetEmail } from '../../backend/src/config/email.js';
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
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log(`🔐 Password reset requested for ${email}`);

    // Check if user exists
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('Auth lookup error:', authError);
      return res.status(500).json({ error: 'Failed to lookup user' });
    }

    const user = users?.find(u => u.email === email);
    
    if (!user) {
      return res.status(404).json({ error: 'Account does not exist' });
    }

    const userId = user.id;

    // Generate and store reset code
    const code = generateVerificationCode();
    const expiresAt = getCodeExpiry();

    const { error: codeError } = await supabase
      .from('two_factor_codes')
      .insert([
        {
          user_id: userId,
          email,
          code,
          code_type: 'password_reset',
          expires_at: expiresAt
        }
      ]);

    if (codeError) {
      console.error('Code storage error:', codeError);
      return res.status(500).json({ error: 'Failed to generate reset code' });
    }

    // Send password reset email
    try {
      await sendPasswordResetEmail(email, code);
    } catch (emailError) {
      console.error('Email send error:', emailError);
      return res.status(500).json({ error: 'Failed to send reset email' });
    }

    res.json({
      success: true,
      message: 'Password reset code sent to email'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
