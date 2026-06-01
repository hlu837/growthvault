import express from 'express';
import { supabase } from '../config/supabase.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../config/email.js';
import { 
  generateVerificationCode, 
  getCodeExpiry, 
  isCodeExpired,
  validateCodeFormat 
} from '../utils/twoFaUtils.js';

export const router = express.Router();

/**
 * POST /api/auth/signup
 * Creates a new user and sends verification code
 * Body: { email: string, password: string }
 */
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
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
      email_confirm: false // User must verify email first
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
    next(error);
  }
});

/**
 * POST /api/auth/verify-email
 * Verifies email with code during signup
 * Body: { email: string, code: string }
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    if (!validateCodeFormat(code)) {
      return res.status(400).json({ error: 'Invalid code format' });
    }

    console.log(`🔍 Verifying email for ${email}`);

    // Get the latest unused verification code
    const { data: codes, error: queryError } = await supabase
      .from('two_factor_codes')
      .select('*')
      .eq('email', email)
      .eq('code_type', 'email_verification')
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

    // Confirm user's email in auth
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      codeRecord.user_id,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error('Email confirm error:', confirmError);
      return res.status(500).json({ error: 'Failed to confirm email' });
    }

    console.log(`✅ Email verified for ${email}`);

    res.json({
      success: true,
      message: 'Email verified successfully',
      email
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/forgot-password
 * Sends password reset code to email
 * Body: { email: string }
 */
router.post('/forgot-password', async (req, res, next) => {
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
    next(error);
  }
});

/**
 * POST /api/auth/reset-password
 * Resets password with verification code
 * Body: { email: string, code: string, newPassword: string }
 */
router.post('/reset-password', async (req, res, next) => {
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
    next(error);
  }
});

export const authRoutes = router;
