import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { isCodeExpired, validateCodeFormat } from '../../backend/src/utils/twoFaUtils.js';

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
    const { email, code, type = 'login' } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    if (!['login', 'withdrawal'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be "login" or "withdrawal"' });
    }

    if (!validateCodeFormat(code)) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    console.log(`✓ Verifying ${type} code for ${email}`);

    // Get the latest unused verification code
    const { data: codes, error: queryError } = await supabase
      .from('two_factor_codes')
      .select('*')
      .eq('email', email)
      .eq('code_type', type)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('Database error:', queryError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!codes || codes.length === 0) {
      return res.status(404).json({ error: 'No verification code found for this type' });
    }

    const codeRecord = codes[0];

    // Check if expired
    if (isCodeExpired(codeRecord.expires_at)) {
      return res.status(410).json({ error: 'Code has expired' });
    }

    // Check if code matches
    if (codeRecord.code !== code) {
      return res.status(401).json({ error: 'Invalid code' });
    }

    // Mark code as used
    const { error: updateError } = await supabase
      .from('two_factor_codes')
      .update({ used: true })
      .eq('id', codeRecord.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ error: 'Failed to mark code as used' });
    }

    console.log(`✅ Code verified for ${email}`);

    res.json({
      success: true,
      message: 'Code verified successfully',
      email,
      type
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
