import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface PayPalIPNNotification {
  event_type: string;
  resource?: {
    id?: string;
    status?: string;
    amount?: {
      value: string;
      currency_code: string;
    };
    supplementary_data?: {
      related_ids?: {
        order_id?: string;
      };
    };
  };
  resource_type?: string;
}

const verifyPayPalSignature = async (
  req: Request
): Promise<boolean> => {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
  const mode = Deno.env.get("PAYPAL_MODE") || "sandbox";

  if (!clientId || !clientSecret) {
    console.error("Missing PayPal webhook credentials");
    return false;
  }

  if (!webhookId) {
    console.warn("Missing PAYPAL_WEBHOOK_ID environment variable; skipping webhook signature verification for test mode.");
    return true;
  }

  try {
    // Get PayPal access token
    const authUrl = `https://api.${mode === "live" ? "" : "sandbox."}paypal.com/v1/oauth2/token`;
    const authResponse = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!authResponse.ok) {
      console.error("Failed to get PayPal access token");
      return false;
    }

    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // Get the raw body text for signature verification
    const bodyText = await req.clone().text();

    // Get the transmission ID, timestamp, and signature from headers
    const transmissionId = req.headers.get("paypal-transmission-id");
    const transmissionTime = req.headers.get("paypal-transmission-time");
    const certUrl = req.headers.get("paypal-cert-url");
    const authAlgo = req.headers.get("paypal-auth-algo");
    const transmissionSig = req.headers.get("paypal-transmission-sig");

    if (
      !transmissionId ||
      !transmissionTime ||
      !certUrl ||
      !authAlgo ||
      !transmissionSig
    ) {
      console.error("Missing PayPal signature headers");
      return false;
    }

    // Verify the signature
    const verifyUrl = `https://api.${mode === "live" ? "" : "sandbox."}paypal.com/v1/notifications/verify-webhook-signature`;

    const verifyResponse = await fetch(verifyUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: webhookId,
        webhook_event: JSON.parse(bodyText),
      }),
    });

    const verifyData = await verifyResponse.json();
    return verifyData.verification_status === "SUCCESS";
  } catch (error) {
    console.error("Error verifying PayPal signature:", error);
    return false;
  }
};

const normalizePayPalStatus = (status?: string) => {
  if (!status) {
    return "pending";
  }

  switch (status.toLowerCase()) {
    case "created":
    case "saved":
    case "pending":
    case "processing":
      return "pending";
    case "approved":
    case "authorised":
    case "authorized":
      return "approved";
    case "completed":
      return "completed";
    case "denied":
    case "declined":
      return "denied";
    case "failed":
      return "failed";
    case "refunded":
    case "reversed":
      return "refunded";
    case "expired":
    case "voided":
      return "cancelled";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
};

const handlePaymentCompleted = async (
  supabase: any,
  notification: PayPalIPNNotification
) => {
  const orderId = notification.resource?.supplementary_data?.related_ids?.order_id;
  const captureId = notification.resource?.id;
  const status = notification.resource?.status;
  const amount = notification.resource?.amount?.value;

  if (!orderId || !captureId) {
    console.error("Missing order or capture ID in notification");
    return;
  }

  // Update transaction status
  const { data: transaction, error: fetchError } = await supabase
    .from("paypal_transactions")
    .select("*")
    .eq("paypal_order_id", orderId)
    .single();

  if (fetchError) {
    console.error("Failed to fetch transaction:", fetchError);
    return;
  }

  if (!transaction) {
    console.error("Transaction not found for order:", orderId);
    return;
  }

  const normalizedStatus = normalizePayPalStatus(status);

  // Update transaction
  const { error: updateError } = await supabase
    .from("paypal_transactions")
    .update({
      status: normalizedStatus,
      capture_id: captureId,
      updated_at: new Date().toISOString(),
    })
    .eq("paypal_order_id", orderId);

  if (updateError) {
    console.error("Failed to update transaction:", updateError);
    return;
  }

  // Fund wallet if escrow transaction exists
  if (transaction.escrow_transaction_id && normalizedStatus === "completed") {
    const { error: fundError } = await supabase.rpc(
      "fund_wallet_from_paypal",
      {
        p_user_id: transaction.user_id,
        p_escrow_transaction_id: transaction.escrow_transaction_id,
        p_amount: parseFloat(amount || "0"),
        p_paypal_transaction_id: orderId,
      }
    );

    if (fundError) {
      console.error("Failed to fund wallet:", fundError);
    }
  }
};

const handlePaymentDenied = async (
  supabase: any,
  notification: PayPalIPNNotification
) => {
  const orderId = notification.resource?.supplementary_data?.related_ids?.order_id;

  if (!orderId) {
    console.error("Missing order ID in denied notification");
    return;
  }

  const { error } = await supabase
    .from("paypal_transactions")
    .update({
      status: normalizePayPalStatus("denied"),
      updated_at: new Date().toISOString(),
    })
    .eq("paypal_order_id", orderId);

  if (error) {
    console.error("Failed to update transaction to denied:", error);
  }
};

const handlePaymentExpired = async (
  supabase: any,
  notification: PayPalIPNNotification
) => {
  const orderId = notification.resource?.supplementary_data?.related_ids?.order_id;

  if (!orderId) {
    console.error("Missing order ID in expired notification");
    return;
  }

  const { error } = await supabase
    .from("paypal_transactions")
    .update({
      status: normalizePayPalStatus("expired"),
      updated_at: new Date().toISOString(),
    })
    .eq("paypal_order_id", orderId);

  if (error) {
    console.error("Failed to update transaction to expired:", error);
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify PayPal signature
    const isValid = await verifyPayPalSignature(req);
    if (!isValid) {
      console.warn("Invalid PayPal webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const notification: PayPalIPNNotification = await req.json();
    const eventType = notification.event_type;

    console.log(`Processing PayPal webhook event: ${eventType}`);

    // Handle different PayPal event types
    switch (eventType) {
      case "CHECKOUT.ORDER.COMPLETED":
        await handlePaymentCompleted(supabase, notification);
        break;
      case "CHECKOUT.ORDER.APPROVED":
        // Order was approved but not captured yet
        console.log("Order approved by user");
        break;
      case "PAYMENT.CAPTURE.COMPLETED":
        // Payment capture completed
        await handlePaymentCompleted(supabase, notification);
        break;
      case "PAYMENT.CAPTURE.DENIED":
        await handlePaymentDenied(supabase, notification);
        break;
      case "PAYMENT.CAPTURE.REFUNDED":
        // Handle refund
        const orderId = notification.resource?.supplementary_data?.related_ids?.order_id;
        if (orderId) {
          await supabase
            .from("paypal_transactions")
            .update({
              status: "refunded",
              updated_at: new Date().toISOString(),
            })
            .eq("paypal_order_id", orderId);
        }
        break;
      case "CHECKOUT.ORDER.EXPIRED":
        await handlePaymentExpired(supabase, notification);
        break;
      default:
        console.log(`Unhandled event type: ${eventType}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
