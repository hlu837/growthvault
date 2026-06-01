# PayPal Integration Setup Guide

## Overview

This document outlines the PayPal integration setup for GrowthVault. The system includes:
- Secure payment creation and capture via Supabase Edge Functions
- Webhook handling for real-time payment status updates
- Automatic wallet funding upon successful payment
- Complete audit trail and transaction logging

## Required Environment Variables

### Supabase Configuration

These environment variables must be set in your **Supabase Dashboard** under Settings > Secrets:

```
PAYPAL_CLIENT_ID=<Your PayPal App ID>
PAYPAL_CLIENT_SECRET=<Your PayPal Secret>
PAYPAL_WEBHOOK_ID=<Your PayPal Webhook ID>
PAYPAL_MODE=sandbox  # or "live" for production
PAYPAL_RETURN_URL=https://yourdomain.com/payment/success
PAYPAL_CANCEL_URL=https://yourdomain.com/payment/cancel
```

### Getting Your PayPal Credentials

1. **Sign up for a PayPal Developer Account:**
   - Go to https://developer.paypal.com
   - Click "Sign up" and follow the registration process
   - Create a Business account (required for marketplace payments)

2. **Create an Application:**
   - Navigate to **Apps & Credentials** in the dashboard
   - Select **Sandbox** mode (for testing)
   - Click **Create App** under the **REST API apps** section
   - Name your app (e.g., "GrowthVault Marketplace")
   - Copy your **Client ID** and **Secret**

3. **Get Webhook ID:**
   - Go to **Webhooks** in the left sidebar
   - Click **Create Webhook**
   - Enter your webhook URL: `https://yourdomain.com/functions/v1/paypal-webhook`
   - Select the following event types:
     - `CHECKOUT.ORDER.COMPLETED`
     - `CHECKOUT.ORDER.APPROVED`
     - `PAYMENT.CAPTURE.COMPLETED`
     - `PAYMENT.CAPTURE.DENIED`
     - `PAYMENT.CAPTURE.REFUNDED`
     - `CHECKOUT.ORDER.EXPIRED`
   - Copy the **Webhook ID** from the details page

4. **Enable Express Checkout:**
   - In Settings > Merchant Profile, enable PayPal Standard
   - Configure your return URLs

## Database Migrations

Before the system works, you must run the PayPal migration SQL:

```bash
# Copy the SQL migration to your Supabase database
# File: sql/paypal_integration_migration.sql

# This creates:
# - paypal_transactions table
# - payment_logs table for audit trail
# - RLS policies
# - Functions: fund_wallet_from_paypal(), process_paypal_refund()
# - Triggers for automatic timestamp and status logging
```

Run via Supabase Dashboard:
1. Open **SQL Editor**
2. Click **New Query**
3. Paste the contents of `sql/paypal_integration_migration.sql`
4. Click **Run**

## Edge Functions Setup

### 1. PayPal Payment Function

**Location:** `supabase/functions/paypal-payment/index.ts`

Handles:
- Creating PayPal orders
- Capturing PayPal orders
- Recording transactions in database

**Deploy:**
```bash
supabase functions deploy paypal-payment
```

**API Usage:**

Create an order:
```javascript
const { createPayPalOrder } = await import('./src/integrations/paypal.ts');

const result = await createPayPalOrder({
  amount: 100.00,
  currency: 'USD',
  description: 'Marketplace Payment',
  escrowTransactionId: 'uuid-here'
});

// result.orderId - Send user to PayPal approval URL
// result.approvalUrl - Redirect user here
```

Capture (after user approves):
```javascript
const { capturePayPalOrder } = await import('./src/integrations/paypal.ts');

const result = await capturePayPalOrder(
  orderId,
  escrowTransactionId,
  marketplaceOrderId
);

// Wallet will be automatically funded via trigger
```

### 2. PayPal Webhook Function

**Location:** `supabase/functions/paypal-webhook/index.ts`

Handles:
- Verifying PayPal webhook signatures
- Processing payment confirmations
- Updating transaction status
- Triggering wallet funding

**Deploy:**
```bash
supabase functions deploy paypal-webhook
```

**Webhook URL:** `https://yourdomain.com/functions/v1/paypal-webhook`

Register this URL in PayPal Dashboard under Webhooks.

## How the System Works

### Payment Flow

1. **User Initiates Payment**
   - Frontend calls `createPayPalOrder()`
   - Edge Function creates PayPal order
   - Transaction recorded as "pending"
   - User redirected to PayPal

2. **User Approves on PayPal**
   - User completes payment on PayPal
   - Redirected back to your app (via PAYPAL_RETURN_URL)

3. **Frontend Captures Order**
   - Frontend calls `capturePayPalOrder()`
   - Edge Function captures the PayPal order
   - Transaction status updated to "completed"

4. **Webhook Confirmation (Backup)**
   - PayPal sends webhook notification
   - Webhook handler verifies signature
   - Updates transaction status
   - Triggers wallet funding via database function

5. **Automatic Wallet Funding**
   - `fund_wallet_from_paypal()` function called
   - Debits payment from escrow transaction
   - Escrow status updated to "funded"
   - Payment logged in audit trail

### Database Tables

**paypal_transactions**
- Stores all PayPal payment records
- Tracks: user, order ID, amount, status, timestamps
- Links to escrow_transactions and marketplace_orders
- RLS policies ensure users see only their own transactions

**payment_logs**
- Audit trail for all payment events
- Tracks status changes and PayPal responses
- IP address and user agent logged for security

**escrow_transactions**
- Updated automatically when payment completes
- Status changed from "pending_payment" → "funded"
- Metadata stores PayPal transaction ID

## Frontend Integration Example

### React Component

```typescript
import { useState } from 'react';
import { createPayPalOrder, capturePayPalOrder } from '@/integrations/paypal';
import { useNavigate } from 'react-router-dom';

export function PaymentButton({ escrowTransactionId, amount }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Create PayPal order
      const order = await createPayPalOrder({
        amount,
        currency: 'USD',
        description: 'Marketplace Purchase',
        escrowTransactionId
      });

      // Redirect to PayPal
      window.location.href = order.approvalUrl;
    } catch (error) {
      console.error('Payment failed:', error);
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handlePayment} 
      disabled={loading}
    >
      {loading ? 'Processing...' : 'Pay with PayPal'}
    </button>
  );
}
```

### Success Page

```typescript
import { useEffect, useSearchParams } from 'react-router-dom';
import { capturePayPalOrder } from '@/integrations/paypal';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('token');
  const escrowId = searchParams.get('escrow_id');

  useEffect(() => {
    const capture = async () => {
      try {
        const result = await capturePayPalOrder(orderId, escrowId);
        console.log('Payment completed:', result);
        // Redirect to confirmation page
      } catch (error) {
        console.error('Capture failed:', error);
      }
    };

    if (orderId) {
      capture();
    }
  }, [orderId, escrowId]);

  return <div>Processing your payment...</div>;
}
```

## Security Considerations

### Webhook Signature Verification
- All PayPal webhooks are cryptographically verified
- Invalid signatures are rejected
- Verification happens server-side before processing

### RLS Policies
- Users can only view/access their own transactions
- Service role handles all operations
- Admins can view all transactions for support

### Environment Variables
- Never commit credentials to git
- Use Supabase Secrets management
- Rotate credentials regularly

### PCI Compliance
- No payment card data stored locally
- All card processing handled by PayPal
- Transactions stored as references only

## Troubleshooting

### Issue: "Missing PayPal credentials"
- Check Supabase Secrets are properly set
- Verify client ID and secret are correct
- Ensure secrets are deployed with functions

### Issue: Webhook not receiving events
- Verify webhook URL is publicly accessible
- Check firewall/security rules allow HTTPS
- Ensure webhook ID is correctly registered
- Test webhook in PayPal Dashboard

### Issue: Payment shows pending but never completes
- Check database for transaction status
- Verify webhook was received (check payment_logs)
- Check Edge Function logs for errors
- May need manual capture via PayPal Dashboard

### Issue: Wallet not funding automatically
- Verify escrow transaction exists and matches
- Check that escrow_transactions RLS allows updates
- Review payment_logs for error messages
- Check database function response

## Testing

### Sandbox Testing

1. Use PayPal Sandbox credentials
2. Create test accounts in PayPal Dashboard
3. Use test card numbers provided by PayPal

Test card: **4532-3488-0343-6467**
- Any future expiration date
- Any 3-digit CVC

4. Process test payments without real charges

### Production Deployment

1. Switch `PAYPAL_MODE` to "live"
2. Use live credentials from PayPal
3. Update webhook URLs to production domain
4. Test with small real transactions first
5. Monitor payment_logs and payment success rate

## Monitoring and Logging

### Payment Logs
Check payment audit trail:
```sql
SELECT * FROM public.payment_logs
ORDER BY created_at DESC
LIMIT 10;
```

### Failed Transactions
Find issues:
```sql
SELECT * FROM public.paypal_transactions
WHERE status IN ('failed', 'denied', 'expired')
ORDER BY created_at DESC;
```

### Webhook Activity
Monitor webhook processing:
```sql
SELECT event_type, COUNT(*), MAX(created_at)
FROM public.payment_logs
WHERE event_type LIKE 'webhook_%'
GROUP BY event_type;
```

## API Reference

### Edge Function: POST /paypal-payment

**Create Order:**
```json
{
  "action": "create",
  "amount": 100.00,
  "currency": "USD",
  "description": "Payment for X",
  "escrowTransactionId": "uuid-optional",
  "marketplaceOrderId": "uuid-optional"
}
```

**Response:**
```json
{
  "orderId": "paypal-order-id",
  "transactionId": "db-uuid",
  "status": "CREATED",
  "approvalUrl": "https://sandbox.paypal.com/..."
}
```

**Capture Order:**
```json
{
  "action": "capture",
  "orderId": "paypal-order-id",
  "escrowTransactionId": "uuid-optional"
}
```

**Response:**
```json
{
  "orderId": "paypal-order-id",
  "captureId": "capture-id",
  "status": "completed",
  "amount": "100.00"
}
```

## Support

For issues:
1. Check Supabase logs (Functions dashboard)
2. Review payment_logs in database
3. Check PayPal Dashboard for webhook status
4. Contact PayPal support for payment issues
