/**
 * PayPal Environment Variables Configuration
 * 
 * These must be set as Secrets in Supabase Dashboard:
 * Settings > Secrets
 * 
 * For Sandbox (Testing):
 * PAYPAL_MODE=sandbox
 * 
 * For Production (Live):
 * PAYPAL_MODE=live
 */

interface PayPalEnvConfig {
  // === REQUIRED ===
  
  /** 
   * Your PayPal App Client ID
   * Get from: https://developer.paypal.com/dashboard/apps
   */
  PAYPAL_CLIENT_ID: string;

  /** 
   * Your PayPal App Client Secret
   * Get from: https://developer.paypal.com/dashboard/apps
   */
  PAYPAL_CLIENT_SECRET: string;

  /** 
   * Your PayPal Webhook ID
   * Get from: https://developer.paypal.com/dashboard/webhooks
   */
  PAYPAL_WEBHOOK_ID: string;

  // === OPTIONAL (with defaults) ===

  /** 
   * PayPal API Mode
   * @default "sandbox"
   * Values: "sandbox" | "live"
   */
  PAYPAL_MODE?: "sandbox" | "live";

  /** 
   * URL to redirect after successful payment
   * @default "http://localhost:5173/payment/success"
   */
  PAYPAL_RETURN_URL?: string;

  /** 
   * URL to redirect if user cancels payment
   * @default "http://localhost:5173/payment/cancel"
   */
  PAYPAL_CANCEL_URL?: string;
}

/**
 * SETUP INSTRUCTIONS
 * 
 * 1. Create PayPal Developer Account
 *    - Visit https://developer.paypal.com
 *    - Create a Business account
 * 
 * 2. Create an App
 *    - Go to Apps & Credentials
 *    - Create an app under "REST API apps"
 *    - Copy Client ID and Client Secret
 * 
 * 3. Create a Webhook
 *    - Go to Webhooks section
 *    - Click "Create Webhook"
 *    - Webhook URL: https://yourdomain.com/functions/v1/paypal-webhook
 *    - Subscribe to events:
 *      * CHECKOUT.ORDER.COMPLETED
 *      * CHECKOUT.ORDER.APPROVED
 *      * PAYMENT.CAPTURE.COMPLETED
 *      * PAYMENT.CAPTURE.DENIED
 *      * PAYMENT.CAPTURE.REFUNDED
 *      * CHECKOUT.ORDER.EXPIRED
 *    - Copy the Webhook ID
 * 
 * 4. Set Supabase Secrets
 *    - Go to Supabase Dashboard > Settings > Secrets
 *    - Add each variable as a new secret
 *    - Redeploy Edge Functions after adding secrets
 * 
 * 5. Configure Return URLs
 *    - PAYPAL_RETURN_URL: Where to send user after approval
 *    - PAYPAL_CANCEL_URL: Where to send user if they cancel
 * 
 * EXAMPLE VALUES:
 * 
 * For Development (Sandbox):
 * PAYPAL_MODE=sandbox
 * PAYPAL_CLIENT_ID=AbCdEfGhIjKlMnOpQrStUvWxYz...
 * PAYPAL_CLIENT_SECRET=EFGhIjKlMnOpQrStUvWxYzAbCd...
 * PAYPAL_WEBHOOK_ID=1A2B3C4D5E6F7G8H9I0J...
 * PAYPAL_RETURN_URL=https://yourdomain.com/payment/success
 * PAYPAL_CANCEL_URL=https://yourdomain.com/payment/cancel
 * 
 * For Production (Live):
 * PAYPAL_MODE=live
 * PAYPAL_CLIENT_ID=<your-live-client-id>
 * PAYPAL_CLIENT_SECRET=<your-live-client-secret>
 * PAYPAL_WEBHOOK_ID=<your-live-webhook-id>
 * PAYPAL_RETURN_URL=https://growthvault.com/payment/success
 * PAYPAL_CANCEL_URL=https://growthvault.com/payment/cancel
 */

// Export for reference
export const PayPalEnvTemplate = {
  PAYPAL_CLIENT_ID: "<Your PayPal Client ID>",
  PAYPAL_CLIENT_SECRET: "<Your PayPal Client Secret>",
  PAYPAL_WEBHOOK_ID: "<Your PayPal Webhook ID>",
  PAYPAL_MODE: "sandbox",
  PAYPAL_RETURN_URL: "https://yourdomain.com/payment/success",
  PAYPAL_CANCEL_URL: "https://yourdomain.com/payment/cancel",
} as const;
