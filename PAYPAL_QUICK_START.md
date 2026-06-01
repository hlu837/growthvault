# PayPal Integration - Quick Start Checklist

## ✅ Complete Checklist for PayPal Setup

### Step 1: Get PayPal Credentials (15 minutes)
- [ ] Go to https://developer.paypal.com
- [ ] Create/log into Business account
- [ ] Go to "Apps & Credentials"
- [ ] Switch to "Sandbox" (top right)
- [ ] Click "Create App" under "REST API apps"
- [ ] Name it "GrowthVault Marketplace"
- [ ] Copy **Client ID** - save to notes
- [ ] Copy **Client Secret** - save to notes
- [ ] Go to "Webhooks" in left sidebar
- [ ] Click "Create Webhook"
- [ ] Webhook URL: `https://yourdomain.com/functions/v1/paypal-webhook`
- [ ] Select these event types:
  - [ ] CHECKOUT.ORDER.COMPLETED
  - [ ] CHECKOUT.ORDER.APPROVED
  - [ ] PAYMENT.CAPTURE.COMPLETED
  - [ ] PAYMENT.CAPTURE.DENIED
  - [ ] PAYMENT.CAPTURE.REFUNDED
  - [ ] CHECKOUT.ORDER.EXPIRED
- [ ] Copy **Webhook ID** - save to notes

### Step 2: Set Environment Variables (5 minutes)
- [ ] Open Supabase Dashboard → Settings → Secrets
- [ ] Click "New Secret"
- [ ] Add: `PAYPAL_CLIENT_ID` = (your client ID)
- [ ] Add: `PAYPAL_CLIENT_SECRET` = (your client secret)
- [ ] Add: `PAYPAL_WEBHOOK_ID` = (your webhook ID)
- [ ] Add: `PAYPAL_MODE` = `sandbox`
- [ ] Add: `PAYPAL_RETURN_URL` = `https://yourdomain.com/payment/success`
- [ ] Add: `PAYPAL_CANCEL_URL` = `https://yourdomain.com/payment/cancel`

### Step 3: Run Database Migration (10 minutes)
- [ ] Open Supabase Dashboard → SQL Editor
- [ ] Click "New Query"
- [ ] Copy entire contents of `sql/paypal_integration_migration.sql`
- [ ] Paste into SQL Editor
- [ ] Click "Run"
- [ ] Wait for success message
- [ ] Verify these tables created:
  - [ ] `paypal_transactions`
  - [ ] `payment_logs`

### Step 4: Deploy Edge Functions (5 minutes)
**Terminal Commands:**
```bash
# Terminal 1: Deploy payment function
supabase functions deploy paypal-payment

# Terminal 2: Deploy webhook function
supabase functions deploy paypal-webhook
```

- [ ] `paypal-payment` deployed successfully
- [ ] `paypal-webhook` deployed successfully
- [ ] No errors in deployment output

### Step 5: Configure Router (10 minutes)
Add these routes to your React Router configuration:

```typescript
// In your App.tsx or router config file
import { PaymentSuccess, PaymentCancel } from '@/components/PayPalPayment';

<Routes>
  {/* ... other routes ... */}
  <Route path="/payment/success" element={<PaymentSuccess />} />
  <Route path="/payment/cancel" element={<PaymentCancel />} />
</Routes>
```

- [ ] `/payment/success` route added
- [ ] `/payment/cancel` route added
- [ ] Routes import correct components

### Step 6: Test Basic Flow (10 minutes)

**Sandbox Testing:**

1. **Create Test Buyer Account**
   - [ ] Go to PayPal Dashboard → Accounts
   - [ ] Create or note test buyer email/password
   
2. **Test Payment Creation**
   ```bash
   # Use any test amount like $50
   # Should see: orderId returned, approvalUrl returned
   ```
   - [ ] Payment button appears
   - [ ] Click "Pay with PayPal"
   - [ ] Redirected to PayPal.com (sandbox)

3. **Approve Payment**
   - [ ] Log in with test buyer account
   - [ ] Review order details
   - [ ] Click "Approve" or "Pay Now"
   - [ ] Redirected back to `/payment/success`

4. **Verify Success**
   - [ ] Success page shows "Payment Successful!"
   - [ ] Check database: `SELECT * FROM paypal_transactions`
   - [ ] Status should be "completed"
   - [ ] Check escrow_transactions: status should be "funded"

5. **Check Wallet**
   - [ ] Verify user's wallet was debited
   - [ ] Check wallet_transactions table
   - [ ] Entry should be type "debit"

6. **Review Audit Trail**
   - [ ] Check payment_logs table
   - [ ] Should see status_changed entries
   - [ ] Should see wallet_funded entry

### Step 7: Test Error Cases (10 minutes)

- [ ] Test Payment Cancellation
  - [ ] Click payment button
  - [ ] Cancel on PayPal
  - [ ] Should show cancellation page
  - [ ] Database status should stay "pending"

- [ ] Test Missing Escrow
  - [ ] Try to pay without valid escrow ID
  - [ ] Should show error
  - [ ] Check Edge Function logs

- [ ] Test Webhook
  - [ ] Go to PayPal Dashboard → Webhooks
  - [ ] Click your webhook
  - [ ] Click "Send a test event"
  - [ ] Should process successfully

### Step 8: Prepare for Production (5 minutes)

**When ready to go live:**

1. **Get Live Credentials**
   - [ ] Go to PayPal Dashboard
   - [ ] Switch from "Sandbox" to "Live"
   - [ ] Create new app for production
   - [ ] Copy live Client ID
   - [ ] Copy live Client Secret
   - [ ] Create webhook for live
   - [ ] Copy live Webhook ID

2. **Update Environment Variables**
   - [ ] Update `PAYPAL_CLIENT_ID` (live)
   - [ ] Update `PAYPAL_CLIENT_SECRET` (live)
   - [ ] Update `PAYPAL_WEBHOOK_ID` (live)
   - [ ] Change `PAYPAL_MODE` to `live`
   - [ ] Update return URLs to production domain

3. **Redeploy Functions**
   ```bash
   supabase functions deploy paypal-payment
   supabase functions deploy paypal-webhook
   ```

4. **Test with Small Transaction**
   - [ ] Process $1-5 transaction
   - [ ] Verify it completes
   - [ ] Check logs for any errors
   - [ ] Monitor for 24 hours

5. **Scale Gradually**
   - [ ] Increase transaction limits
   - [ ] Monitor for issues
   - [ ] Watch payment success rate
   - [ ] Check refund requests

---

## 📋 Files Created/Modified

### New Files Created:
```
supabase/functions/paypal-payment/index.ts          (main payment handler)
supabase/functions/paypal-webhook/index.ts          (webhook listener)
supabase/functions/_shared/cors.ts                  (CORS headers)
src/integrations/paypal.ts                          (client utilities)
src/components/PayPalPayment.tsx                    (React components)
src/config/paypal-env.config.ts                     (env configuration)
sql/paypal_integration_migration.sql                (database schema)
PAYPAL_INTEGRATION.md                               (full documentation)
PAYPAL_IMPLEMENTATION_SUMMARY.md                    (implementation guide)
```

### Database Tables Created:
```
paypal_transactions                 (tracks all payments)
payment_logs                        (audit trail)
```

### Database Functions Created:
```
fund_wallet_from_paypal()           (auto-funds wallet)
process_paypal_refund()             (handles refunds)
```

### Database Triggers Created:
```
paypal_transactions_update_timestamp (auto-update timestamp)
paypal_log_status_change             (logs status changes)
```

---

## 🧪 Test Cards for Sandbox

Use these test card numbers when paying in Sandbox:

### Successful Payment:
- **Card:** 4532-3488-0343-6467
- **Expiry:** Any future date (e.g., 12/2025)
- **CVC:** Any 3-digit number (e.g., 123)
- **Result:** Payment completes

### Denied Payment:
- **Card:** 5105-1051-0510-5100
- **Expiry:** Any future date
- **CVC:** Any 3-digit number
- **Result:** Payment denied

Use PayPal's official test credentials for buyer account.

---

## 🔍 Debugging Tips

### Check Edge Function Logs:
```bash
supabase functions fetch paypal-payment --logs
supabase functions fetch paypal-webhook --logs
```

### Query Database for Issues:
```sql
-- View all transactions
SELECT * FROM paypal_transactions ORDER BY created_at DESC LIMIT 10;

-- View failed transactions
SELECT * FROM paypal_transactions WHERE status = 'failed' OR status = 'denied';

-- View audit trail
SELECT * FROM payment_logs ORDER BY created_at DESC LIMIT 20;

-- View webhook events
SELECT * FROM payment_logs WHERE event_type LIKE 'webhook_%';
```

### Common Error Messages:

| Error | Solution |
|-------|----------|
| "Missing PayPal credentials" | Check Supabase Secrets are set, redeploy function |
| "Invalid signature" | Webhook ID incorrect, verify in PayPal Dashboard |
| "Order not found" | Webhook may be outdated, test new one in PayPal |
| "Escrow transaction not found" | Verify escrow_transaction_id matches database |

---

## ✉️ Support Checklist

If you need support, provide:

- [ ] Error message (full text)
- [ ] Timestamp when error occurred
- [ ] PayPal transaction ID (if available)
- [ ] Relevant database records (sanitized)
- [ ] Edge Function logs
- [ ] Whether using Sandbox or Live mode
- [ ] Steps to reproduce

---

**Time to Complete:** ~60 minutes (first setup)

Start with Step 1 and work through sequentially. Each step depends on previous ones.
