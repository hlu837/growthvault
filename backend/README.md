# GrowthVault 2FA Backend

A Node.js/Express backend service for handling two-factor authentication with Gmail integration.

## Features

- ✅ 2FA code generation and verification
- ✅ Gmail SMTP email integration
- ✅ Supabase database integration
- ✅ Admin MFA session validation
- ✅ Code expiration (10 minutes)
- ✅ CORS enabled for frontend integration

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `GMAIL_USER` - Already set to: `hilinayared140@gmail.com`
- `GMAIL_APP_PASSWORD` - Already set to: `sxhe zijq irlc xxuw`
- `FRONTEND_URL` - Your React app URL (default: `http://localhost:5173`)

### 3. Get Supabase Keys

1. Go to https://app.supabase.com
2. Select your project: `growthvault`
3. Go to Settings → API
4. Copy:
   - `Project URL` → `SUPABASE_URL`
   - `Service Role Secret` → `SUPABASE_SERVICE_ROLE_KEY`

### 4. Start the Server

Development (with auto-reload):
```bash
npm run dev
```

Production:
```bash
npm start
```

Server runs on `http://localhost:5000`

## API Endpoints

### 1. Send 2FA Code

**POST** `/api/2fa/send`

Generates and sends a verification code to the user's email.

**Request:**
```json
{
  "email": "user@example.com",
  "type": "login"  // or "withdrawal"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to email",
  "email": "user@example.com",
  "type": "login"
}
```

### 2. Verify 2FA Code

**POST** `/api/2fa/verify`

Verifies the code submitted by the user.

**Request:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "type": "login"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Code verified successfully",
  "email": "user@example.com",
  "type": "login"
}
```

### 3. Validate MFA Session

**POST** `/api/2fa/validate-session`

Checks if user has an active admin MFA session.

**Request:**
```json
{
  "userId": "user-uuid"
}
```

**Response:**
```json
{
  "valid": true,
  "session": {
    "userId": "user-uuid",
    "createdAt": "2026-05-27T10:00:00Z",
    "expiresAt": "2026-05-27T10:10:00Z"
  }
}
```

### 4. Health Check

**GET** `/health`

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-05-27T10:00:00Z"
}
```

## Frontend Integration

Update your `AuthContext.tsx` to call the backend endpoints:

```typescript
// Send 2FA code
const response = await fetch('http://localhost:5000/api/2fa/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, type: 'login' })
});

// Verify 2FA code
const response = await fetch('http://localhost:5000/api/2fa/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, code, type: 'login' })
});
```

## Troubleshooting

### Gmail not sending emails
- Ensure app password is correct (check Gmail account security settings)
- Verify "Less secure app access" is enabled if using regular password
- Check spam folder for test emails

### Supabase connection error
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct
- Check that database tables exist (run migrations)
- Ensure your IP is allowed in Supabase firewall

### CORS errors
- Update `FRONTEND_URL` in `.env` to match your React app URL
- Ensure frontend is using the correct backend URL

## Database Tables Required

These should already exist from your migrations:
- `two_factor_codes` - Stores verification codes
- `admin_mfa_sessions` - Stores admin MFA sessions

## License

ISC
