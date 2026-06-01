import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { sendVerificationEmail } from '../../backend/src/config/email.js';
import { generateVerificationCode, getCodeExpiry, validateCodeFormat } from '../../backend/src/utils/twoFaUtils.js';

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
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    console.log(`📝 New signup request for ${email}`);

    // Check if user already exists
    const { data: { users: existingUsers }, error: checkError } = await supabase.auth.admin.listUsers();
    
    if (checkError) {
      console.error('Auth lookup error:', checkError);
      return res.status(500).json({ error: 'Failed to check user' });
    }

    const userExists = existingUsers?.some(u => u.email === email);
    if (userExists) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create user in Supabase Auth
    const { data: { user }, error: signupError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false
    });

    if (signupError) {
      console.error('Signup error:', signupError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    const userId = user.id;
    console.log(`✅ User created with ID: ${userId}`);

    // Generate and store verification code
    const code = generateVerificationCode();
    const expiresAt = getCodeExpiry();

    const { error: codeError } = await supabase
      .from('two_factor_codes')
      .insert([
        {
          user_id: userId,
          email,
          code,
          code_type: 'email_verification',
          expires_at: expiresAt
        }
      ]);

    if (codeError) {
      console.error('Code storage error:', codeError);
      return res.status(500).json({ error: 'Failed to generate verification code' });
    }

    // Send verification email
    try {
      await sendVerificationEmail(email, code, 'email_verification');
    } catch (emailError) {
      console.error('Email send error:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.status(201).json({
      success: true,
      message: 'User created. Verification code sent to email',
      email,
      userId
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
