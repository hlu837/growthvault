import nodemailer from 'nodemailer';

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

if (!gmailUser || !gmailAppPassword) {
  throw new Error('Missing Gmail configuration. Check .env file.');
}

export const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: gmailUser,
    pass: gmailAppPassword
  }
});

export const sendVerificationEmail = async (email, code, type = 'verification') => {
  try {
    let subject, headerText;
    
    if (type === 'email_verification') {
      subject = '📧 Verify Your GrowthVault Email Address';
      headerText = 'Email Verification';
    } else if (type === 'password_reset') {
      subject = '🔑 Reset Your GrowthVault Password';
      headerText = 'Password Reset Code';
    } else {
      subject = '🔐 Your GrowthVault 2-Step Verification Code';
      headerText = '2-Step Verification';
    }

    const mailOptions = {
      from: 'Golden Wealth Achievers <' + gmailUser + '>',
      to: email,
      subject: subject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
            .header { text-align: center; color: #333; }
            .code-container { background-color: #f0f4ff; border: 2px solid #4f46e5; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center; }
            .code { font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 5px; }
            .expiry { color: #666; font-size: 14px; margin-top: 20px; }
            .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 ${headerText}</h1>
              <p>Your verification code is:</p>
            </div>
            <div class="code-container">
              <div class="code">${code}</div>
            </div>
            <div class="expiry">
              ⏱️ This code expires in 10 minutes
            </div>
            <p>If you didn't request this code, please ignore this email.</p>
            <div class="footer">
              <p>Golden Wealth Achievers</p>
              <p>© 2026 GrowthVault. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${email}:`, info.response);
    return true;
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, code) => {
  try {
    const mailOptions = {
      from: 'Golden Wealth Achievers <' + gmailUser + '>',
      to: email,
      subject: '🔑 Reset Your GrowthVault Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
            .header { text-align: center; color: #333; }
            .code-container { background-color: #f0f4ff; border: 2px solid #4f46e5; border-radius: 8px; padding: 20px; margin: 30px 0; text-align: center; }
            .code { font-size: 32px; font-weight: bold; color: #4f46e5; letter-spacing: 5px; }
            .expiry { color: #666; font-size: 14px; margin-top: 20px; }
            .footer { color: #999; font-size: 12px; text-align: center; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔑 Password Reset</h1>
              <p>Your password reset code is:</p>
            </div>
            <div class="code-container">
              <div class="code">${code}</div>
            </div>
            <div class="expiry">
              ⏱️ This code expires in 10 minutes
            </div>
            <p>If you didn't request this, please ignore this email.</p>
            <div class="footer">
              <p>Golden Wealth Achievers</p>
              <p>© 2026 GrowthVault. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}:`, info.response);
    return true;
  } catch (error) {
    console.error('❌ Email send error:', error);
    throw error;
  }
};
