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
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'Email, code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!validateCodeFormat(code)) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    console.log(`🔑 Password reset attempt for ${email}`);

    // Get the latest unused reset code
    const { data: codes, error: queryError } = await supabase
      .from('two_factor_codes')
      .select('*')
      .eq('email', email)
      .eq('code_type', 'password_reset')
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1);

    if (queryError) {
      console.error('Database error:', queryError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!codes || codes.length === 0) {
      return res.status(404).json({ error: 'No reset code found' });
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
    const { error: updateCodeError } = await supabase
      .from('two_factor_codes')
      .update({ used: true })
      .eq('id', codeRecord.id);

    if (updateCodeError) {
      console.error('Update error:', updateCodeError);
      return res.status(500).json({ error: 'Failed to mark code as used' });
    }

    // Update password in auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      codeRecord.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return res.status(500).json({ error: 'Failed to update password' });
    }

    console.log(`✅ Password reset for ${email}`);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
