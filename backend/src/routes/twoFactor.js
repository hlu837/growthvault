import express from 'express';
import { supabase } from '../config/supabase.js';
import { sendVerificationEmail } from '../config/email.js';
import { 
  generateVerificationCode, 
  getCodeExpiry, 
  isCodeExpired,
  validateCodeFormat 
} from '../utils/twoFaUtils.js';

export const router = express.Router();

/**
 * POST /api/2fa/send
 * Generates and sends a 2FA code to the user's email
 * Body: { email: string, type: 'login' | 'withdrawal' }
 */
router.post('/send', async (req, res, next) => {
  try {
    const { email, type = 'login' } = req.body;

    // Validate input
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
          type: type === 'login' ? 'login' : 'withdrawal', // For legacy compatibility
          code_type: type,
          expires_at: expiresAt
          // is_used and used default to false, created_at defaults to NOW()
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
    next(error);
  }
});

/**
 * POST /api/2fa/verify
 * Verifies the 2FA code provided by the user
 * Body: { email: string, code: string, type: 'login' | 'withdrawal' }
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { email, code, type = 'login' } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    if (!validateCodeFormat(code)) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    console.log(`🔍 Verifying 2FA code for ${email}`);

    // Get the latest unused code for this email and type
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
      return res.status(404).json({ error: 'No verification code found' });
    }

    const codeRecord = codes[0];

    // Check if code is expired
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

    console.log(`✅ 2FA code verified for ${email}`);

    res.json({
      success: true,
      message: 'Code verified successfully',
      email,
      type
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/2fa/validate-session
 * Validates that user has a valid MFA session (for admins)
 * Body: { userId: string }
 */
router.post('/validate-session', async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const { data: sessions, error } = await supabase
      .from('admin_mfa_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!sessions || sessions.length === 0) {
      return res.status(401).json({ valid: false, message: 'No active MFA session' });
    }

    const session = sessions[0];
    if (new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ valid: false, message: 'MFA session expired' });
    }

    res.json({
      valid: true,
      session: {
        userId: session.user_id,
        createdAt: session.created_at,
        expiresAt: session.expires_at
      }
    });
  } catch (error) {
    next(error);
  }
});

export const twoFactorRoutes = router;
