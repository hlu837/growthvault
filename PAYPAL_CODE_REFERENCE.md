# PayPal Integration - Code Reference & Architecture

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React)                           │
│  PayPalPayment.tsx - Payment UI Components                     │
│  - PaymentButton: Initiates payment flow                       │
│  - PaymentSuccess: Handles post-approval                       │
│  - PaymentCancel: Handles cancellation                         │
│  - CheckoutPage: Complete checkout experience                 │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT UTILITIES                              │
│  src/integrations/paypal.ts                                    │
│  - createPayPalOrder(): Calls Edge Function (create)           │
│  - capturePayPalOrder(): Calls Edge Function (capture)         │
│  - getUserPayPalTransactions(): Queries Supabase               │
│  - pollTransactionStatus(): Polls for webhook completion       │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ↓ HTTPS Requests with JWT
                 │
┌─────────────────────────────────────────────────────────────────┐
│                   SUPABASE EDGE FUNCTIONS                        │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  paypal-payment/index.ts                                   │ │
│  │  ├─ action: "create"                                       │ │
│  │  │  ├─ Get PayPal access token                            │ │
│  │  │  ├─ Create PayPal order                                │ │
│  │  │  ├─ Record transaction (status: pending)               │ │
│  │  │  └─ Return orderId + approvalUrl                       │ │
│  │  │                                                         │ │
│  │  └─ action: "capture"                                      │ │
│  │     ├─ Verify order exists                                │ │
│  │     ├─ Capture with PayPal API                            │ │
│  │     ├─ Update transaction (status: completed)             │ │
│  │     └─ Trigger wallet funding via DB function             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  paypal-webhook/index.ts                                   │ │
│  │  ├─ Receive PayPal webhook event                           │ │
│  │  ├─ Verify cryptographic signature                        │ │
│  │  ├─ Process event (COMPLETED, DENIED, REFUNDED, etc)      │ │
│  │  ├─ Update transaction status                             │ │
│  │  └─ Trigger wallet funding if needed (backup)             │ │
│  └────────────────────────────────────────────────────────────┘ │
└────────────┬──────────────────────────────────────────────────────┘
             │
             ↓ SQL Queries & Functions
             │
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE DATABASE                            │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  paypal_transactions (table)                              │ │
│  │  ├─ id, user_id, paypal_order_id, capture_id             │ │
│  │  ├─ amount, currency, status                             │ │
│  │  ├─ escrow_transaction_id, marketplace_order_id          │ │
│  │  └─ Indexes on: user_id, status, order_id, created_at    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  payment_logs (table) - Audit Trail                       │ │
│  │  ├─ paypal_transaction_id, user_id                        │ │
│  │  ├─ event_type (order_created, captured, refunded, etc)  │ │
│  │  ├─ old_status, new_status, paypal_response              │ │
│  │  └─ ip_address, user_agent, created_at                   │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Functions                                                 │ │
│  │  ├─ fund_wallet_from_paypal()                             │ │
│  │  │  ├─ Validates escrow transaction                       │ │
│  │  │  ├─ Creates/gets wallet                                │ │
│  │  │  ├─ Records wallet transaction (debit)                 │ │
│  │  │  ├─ Updates escrow status → "funded"                   │ │
│  │  │  └─ Logs to payment_logs                               │ │
│  │  │                                                         │ │
│  │  └─ process_paypal_refund()                               │ │
│  │     ├─ Updates transaction status → "refunded"            │ │
│  │     ├─ Updates escrow status → "refunded"                 │ │
│  │     └─ Logs refund reason                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Triggers                                                  │ │
│  │  ├─ paypal_transactions_update_timestamp                  │ │
│  │  │  └─ Auto-updates updated_at on every change            │ │
│  │  │                                                         │ │
│  │  └─ paypal_log_status_change                              │ │
│  │     └─ Auto-logs status changes to payment_logs           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Related Tables (Already Exist)                            │ │
│  │  ├─ escrow_transactions - Linked via escrow_transaction_id │ │
│  │  ├─ marketplace_orders - Linked via marketplace_order_id  │ │
│  │  ├─ wallets - Updated by fund_wallet_from_paypal()       │ │
│  │  ├─ wallet_transactions - Created on payment              │ │
│  │  └─ auth.users - Linked via user_id                      │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      PAYPAL API                                  │
│  https://api.sandbox.paypal.com (sandbox)                       │
│  https://api.paypal.com (live)                                  │
│                                                                   │
│  ├─ /v1/oauth2/token - Get access token                        │
│  ├─ /v2/checkout/orders - Create order                         │
│  ├─ /v2/checkout/orders/{id}/capture - Capture order           │
│  ├─ /v1/notifications/verify-webhook-signature - Verify sig    │
│  └─ Webhooks - Send event notifications                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📂 Code File Locations & Purpose

### Frontend Components

**File:** `src/components/PayPalPayment.tsx`

```typescript
// Component 1: Initiates Payment
export function PaymentButton({
  escrowTransactionId,    // Link to escrow transaction
  amount,                 // Payment amount
  currency,               // USD, EUR, etc.
  description,            // What is being paid for
  onPaymentInitiated,     // Callback when payment starts
  disabled                // Disable button
}) → void               // Redirects to PayPal

// Component 2: Handles Success Return
export function PaymentSuccess({
  escrowTransactionId,    // For wallet funding
  onSuccess,              // Callback after capture
  redirectDelay           // Delay before redirect
}) → JSX.Element        // Shows success + redirects

// Component 3: Handles Cancellation
export function PaymentCancel() → JSX.Element  // Shows cancel message

// Component 4: Complete Checkout
export function CheckoutPage({
  escrowTransactionId,    // Escrow transaction ID
  amount,                 // Order total
  itemDescription,        // What item is
  buyerName              // Who's buying
}) → JSX.Element        // Full checkout UI
```

### Client Utilities

**File:** `src/integrations/paypal.ts`

```typescript
// Create a PayPal order (initiates payment)
export async function createPayPalOrder(
  options: {
    amount: number,
    currency: string,
    description: string,
    escrowTransactionId?: string,
    marketplaceOrderId?: string
  }
): Promise<{
  orderId: string,        // Return to PayPal for approval
  transactionId: string,  // Database transaction ID
  status: string,         // CREATED
  approvalUrl: string    // Redirect user here
}>

// Capture (finalize) a PayPal order
export async function capturePayPalOrder(
  orderId: string,
  escrowTransactionId?: string,
  marketplaceOrderId?: string
): Promise<{
  orderId: string,
  captureId: string,
  status: string,        // 'completed'
  amount: string
}>

// Get single transaction details
export async function getPayPalTransaction(
  transactionId: string
): Promise<PayPalTransaction>

// Poll for webhook processing (optional, has timeout)
export async function pollTransactionStatus(
  orderId: string,
  maxAttempts: number,
  delayMs: number
): Promise<string>  // 'completed' or 'pending'

// Get all user's PayPal transactions
export async function getUserPayPalTransactions()
: Promise<PayPalTransaction[]>
```

### Edge Functions

**File:** `supabase/functions/paypal-payment/index.ts`

```typescript
interface CreateOrderRequest {
  action: 'create',
  amount: number,
  currency: string,
  description: string,
  escrowTransactionId?: string,
  marketplaceOrderId?: string
}

interface CaptureOrderRequest {
  action: 'capture',
  orderId: string,
  escrowTransactionId?: string,
  marketplaceOrderId?: string
}

// Main handler
Deno.serve(async (req) => {
  if (body.action === 'create') {
    // 1. Get PayPal access token
    const accessToken = await getPayPalAccessToken()
    
    // 2. Create order with PayPal API
    const paypalOrder = await createPayPalOrder(...)
    
    // 3. Record in database
    const transactionId = await recordPaymentTransaction(...)
    
    // 4. Return result
    return {
      orderId: paypalOrder.id,
      transactionId,
      approvalUrl: paypalOrder.links.find(l => l.rel === 'approve')?.href
    }
  }
  
  if (body.action === 'capture') {
    // 1. Capture order with PayPal API
    const captureResponse = await capturePayPalOrder(...)
    
    // 2. Update transaction in database
    await supabase.from('paypal_transactions').update(...)
    
    // 3. Call database function to fund wallet
    const fundResult = await supabase.rpc('fund_wallet_from_paypal', ...)
    
    // 4. Return result
    return {
      orderId,
      captureId,
      status: 'completed',
      amount
    }
  }
})
```

**File:** `supabase/functions/paypal-webhook/index.ts`

```typescript
interface PayPalIPNNotification {
  event_type: string,  // CHECKOUT.ORDER.COMPLETED, PAYMENT.CAPTURE.COMPLETED, etc.
  resource: {
    id: string,        // Capture ID
    status: string,    // COMPLETED, DENIED, REFUNDED
    amount: { value, currency_code },
    supplementary_data: { related_ids: { order_id } }
  }
}

// Main handler
Deno.serve(async (req) => {
  // 1. Verify PayPal signature (critical for security)
  const isValid = await verifyPayPalSignature(req)
  if (!isValid) return 401
  
  // 2. Parse event
  const notification: PayPalIPNNotification = await req.json()
  
  // 3. Handle based on event type
  switch (notification.event_type) {
    case 'CHECKOUT.ORDER.COMPLETED':
      // Payment completed, fund wallet
      await handlePaymentCompleted(supabase, notification)
      break
    
    case 'PAYMENT.CAPTURE.DENIED':
      // Payment denied, update status
      await handlePaymentDenied(supabase, notification)
      break
    
    case 'PAYMENT.CAPTURE.REFUNDED':
      // Process refund
      await supabase.from('paypal_transactions').update({
        status: 'refunded'
      })
      break
    
    case 'CHECKOUT.ORDER.EXPIRED':
      // Order expired
      await handlePaymentExpired(supabase, notification)
      break
  }
  
  return 200
})
```

---

## 🗄️ Database Schema

### paypal_transactions Table

```sql
CREATE TABLE public.paypal_transactions (
  id UUID PRIMARY KEY,
  
  -- Who paid
  user_id UUID REFERENCES auth.users(id),
  
  -- PayPal identifiers
  paypal_order_id TEXT UNIQUE,    -- From PayPal
  capture_id TEXT,                -- From PayPal after capture
  
  -- Payment details
  amount NUMERIC(15,2),
  currency TEXT,
  
  -- Status tracking
  status TEXT CHECK (status IN (
    'pending',      -- Created but not approved
    'approved',     -- User approved on PayPal
    'completed',    -- Captured and finalized
    'denied',       -- Payment failed/denied
    'refunded',     -- Refunded to user
    'expired',      -- Order expired
    'cancelled',    -- User cancelled
    'failed'        -- Processing failed
  )),
  
  -- Links to other tables
  payment_type TEXT,              -- 'paypal'
  escrow_transaction_id UUID,     -- Which escrow transaction
  marketplace_order_id UUID,      -- Which marketplace order
  
  -- Timeline
  created_at TIMESTAMPTZ,         -- When order created
  approved_at TIMESTAMPTZ,        -- When user approved
  completed_at TIMESTAMPTZ,       -- When captured
  updated_at TIMESTAMPTZ,
  
  -- Extra data
  metadata JSONB,
  error_message TEXT,
  is_deleted BOOLEAN
)

-- Indexes for performance
CREATE INDEX idx_paypal_user ON paypal_transactions(user_id);
CREATE INDEX idx_paypal_status ON paypal_transactions(status);
CREATE INDEX idx_paypal_escrow ON paypal_transactions(escrow_transaction_id);
```

### payment_logs Table (Audit Trail)

```sql
CREATE TABLE public.payment_logs (
  id UUID PRIMARY KEY,
  
  -- What transaction
  paypal_transaction_id UUID REFERENCES paypal_transactions(id),
  user_id UUID REFERENCES auth.users(id),
  
  -- What happened
  event_type TEXT,     -- 'order_created', 'captured', 'refunded', etc.
  old_status TEXT,
  new_status TEXT,
  
  -- PayPal's response
  paypal_response JSONB,
  
  -- Security
  ip_address INET,
  user_agent TEXT,
  
  -- When
  created_at TIMESTAMPTZ
)
```

---

## 🔄 Data Flow Examples

### Scenario 1: Successful Payment

```
Frontend User Click
    ↓
PaymentButton onClick
    ↓
createPayPalOrder() called
    ↓
POST /functions/v1/paypal-payment { action: 'create', ... }
    ↓
Edge Function:
  ├─ Verify JWT token
  ├─ Get PayPal access token
  ├─ POST /v2/checkout/orders to PayPal
  ├─ INSERT into paypal_transactions (status: 'pending')
  ├─ INSERT into payment_logs (event_type: 'order_created')
  └─ Return { orderId, approvalUrl, transactionId }
    ↓
Frontend: window.location.href = approvalUrl
    ↓
User on PayPal.com
    ↓
User approves payment
    ↓
User redirected to /payment/success?token={orderId}
    ↓
PaymentSuccess component mounts
    ↓
capturePayPalOrder() called
    ↓
POST /functions/v1/paypal-payment { action: 'capture', orderId, ... }
    ↓
Edge Function:
  ├─ Verify JWT token
  ├─ Get PayPal access token
  ├─ POST /v2/checkout/orders/{id}/capture to PayPal
  ├─ UPDATE paypal_transactions (status: 'completed')
  ├─ INSERT into payment_logs (event_type: 'status_changed')
  ├─ CALL fund_wallet_from_paypal()
  │   ├─ Get escrow transaction
  │   ├─ Validate buyer matches
  │   ├─ Get/create wallet
  │   ├─ INSERT into wallet_transactions (type: 'debit', amount)
  │   ├─ UPDATE wallets (balance: balance - amount)
  │   ├─ UPDATE escrow_transactions (status: 'funded')
  │   └─ INSERT into payment_logs (event_type: 'wallet_funded')
  └─ Return { status: 'completed' }
    ↓
Frontend: Show "Payment successful!"
    ↓
Redirect to /dashboard/orders
```

### Scenario 2: Webhook Confirmation (Backup)

```
PayPal Server
    ↓
Send webhook event (PAYMENT.CAPTURE.COMPLETED)
    ↓
POST /functions/v1/paypal-webhook with signature headers
    ↓
Edge Function:
  ├─ Get request body + headers
  ├─ GET PayPal access token
  ├─ POST /v1/notifications/verify-webhook-signature to PayPal
  ├─ PayPal returns: verification_status = 'SUCCESS'
  ├─ Parse event
  ├─ If PAYMENT.CAPTURE.COMPLETED:
  │   ├─ Get PayPal transaction ID from event
  │   ├─ UPDATE paypal_transactions (status: 'completed')
  │   ├─ CALL fund_wallet_from_paypal() [if not already done]
  │   └─ INSERT into payment_logs (event_type: 'webhook_received')
  └─ Return 200 OK
    ↓
[Webhook complete - user already notified]
```

---

## 🔐 Security Flow

```
User Request to Edge Function
    ↓
Check Authorization header
    ↓
Extract JWT token
    ↓
Call supabase.auth.getUser(token)
    ↓
If error or user not found → Return 401 Unauthorized
    ↓
Continue with authenticated user ID
    ↓
All database queries use user_id from token
    ↓
RLS policies enforce: user can only access own records
    ↓
Webhook events verified via cryptographic signature
    ↓
Sensitive data never logged (passwords, card numbers)
    ↓
All transactions in payment_logs with timestamps
```

---

## 📊 Typical Queries

### Check Transaction Status
```sql
SELECT id, user_id, paypal_order_id, status, created_at
FROM paypal_transactions
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;
```

### Find Failed Payments
```sql
SELECT pt.*, pl.event_type, pl.paypal_response
FROM paypal_transactions pt
LEFT JOIN payment_logs pl ON pt.id = pl.paypal_transaction_id
WHERE pt.status IN ('failed', 'denied')
ORDER BY pt.created_at DESC;
```

### Check Wallet Funding History
```sql
SELECT pl.* FROM payment_logs pl
WHERE pl.event_type = 'wallet_funded'
ORDER BY pl.created_at DESC
LIMIT 10;
```

### Audit Trail for Transaction
```sql
SELECT * FROM payment_logs
WHERE paypal_transaction_id = 'transaction-uuid'
ORDER BY created_at ASC;
```

---

## 🎯 Integration Points

### 1. Payment Initiation
```typescript
// In checkout component
import { PaymentButton } from '@/components/PayPalPayment';

<PaymentButton
  escrowTransactionId={escrowId}
  amount={totalAmount}
  description="Marketplace Purchase"
/>
```

### 2. Success Handling
```typescript
// Router configuration
<Route path="/payment/success" element={<PaymentSuccess />} />
<Route path="/payment/cancel" element={<PaymentCancel />} />
```

### 3. Display Transaction History
```typescript
import { getUserPayPalTransactions } from '@/integrations/paypal';

const transactions = await getUserPayPalTransactions();
transactions.forEach(tx => {
  console.log(`${tx.amount} ${tx.currency} - ${tx.status}`);
});
```

### 4. Dashboard Integration
```typescript
// Show payment status on order/escrow details page
const { data: payment } = await supabase
  .from('paypal_transactions')
  .select('*')
  .eq('escrow_transaction_id', escrowId)
  .single();

if (payment?.status === 'completed') {
  // Show funded badge
}
```

---

## 🐛 Debugging Helpers

### View Edge Function Logs
```bash
# Real-time logs for payment function
supabase functions fetch paypal-payment --logs

# Real-time logs for webhook function
supabase functions fetch paypal-webhook --logs
```

### Check Database State
```sql
-- Current transactions
SELECT * FROM paypal_transactions ORDER BY created_at DESC LIMIT 5;

-- Recent payment events
SELECT * FROM payment_logs ORDER BY created_at DESC LIMIT 20;

-- Audit trail for specific transaction
SELECT * FROM payment_logs
WHERE paypal_transaction_id = 'UUID'
ORDER BY created_at ASC;
```

### Test Webhook Manually
In PayPal Dashboard:
1. Go to Webhooks → Your Webhook → Send a test event
2. Select event type (e.g., PAYMENT.CAPTURE.COMPLETED)
3. Check Edge Function logs for processing
4. Verify payment_logs was updated

---

## 📈 Performance Considerations

### Indexes
```sql
-- Paypal_transactions indexes optimized for:
CREATE INDEX idx_paypal_user ON paypal_transactions(user_id);
  ↳ Fast: Find all payments by user
  
CREATE INDEX idx_paypal_status ON paypal_transactions(status);
  ↳ Fast: Find pending/failed payments
  
CREATE INDEX idx_paypal_created ON paypal_transactions(created_at DESC);
  ↳ Fast: List recent transactions
```

### Query Optimization
- Use RLS for automatic filtering (no manual filtering needed)
- Paginate large result sets (LIMIT 50, OFFSET)
- Avoid SELECT * in production queries
- Use connection pooling in Supabase (included)

---

This reference guide covers all the code files, how they connect, and how data flows through the system. Use this when modifying code or debugging issues.
