import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

interface CreateOrderRequest {
  amount: number;
  currency: string;
  description: string;
  escrowTransactionId?: string;
  marketplaceOrderId?: string;
  customerId?: string;
}

interface CaptureOrderRequest {
  orderId: string;
  escrowTransactionId?: string;
  marketplaceOrderId?: string;
}

interface PayPalOrder {
  id: string;
  status: string;
  links: Array<{ rel: string; href: string }>;
}

interface PayPalCaptureResponse {
  id: string;
  status: string;
  purchase_units: Array<{
    payments: {
      captures: Array<{
        id: string;
        status: string;
        amount: { value: string; currency_code: string };
      }>;
    };
  }>;
}

const getPayPalAccessToken = async (): Promise<string> => {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const mode = Deno.env.get("PAYPAL_MODE") || "sandbox";

  if (!clientId || !clientSecret) {
    throw new Error("Missing PayPal credentials");
  }

  const authUrl = `https://api.${mode === "live" ? "" : "sandbox."}paypal.com/v1/oauth2/token`;

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
};

const createPayPalOrder = async (
  amount: number,
  currency: string,
  description: string,
  accessToken: string,
  metadata?: Record<string, string>
): Promise<PayPalOrder> => {
  const mode = Deno.env.get("PAYPAL_MODE") || "sandbox";
  const apiUrl = `https://api.${mode === "live" ? "" : "sandbox."}paypal.com/v2/checkout/orders`;
  const returnUrl = Deno.env.get("PAYPAL_RETURN_URL") || "http://localhost:5173/payment/success";
  const cancelUrl = Deno.env.get("PAYPAL_CANCEL_URL") || "http://localhost:5173/payment/cancel";

  const orderPayload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: currency,
          value: amount.toFixed(2),
        },
        description: description,
        custom_id: metadata?.escrowTransactionId || metadata?.marketplaceOrderId || "order",
      },
    ],
    application_context: {
      brand_name: "GrowthVault",
      locale: "en-US",
      landing_page: "BILLING",
      user_action: "PAY_NOW",
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderPayload),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`PayPal order creation failed: ${JSON.stringify(error)}`);
  }

  return await response.json();
};

const capturePayPalOrder = async (
  orderId: string,
  accessToken: string
): Promise<PayPalCaptureResponse> => {
  const mode = Deno.env.get("PAYPAL_MODE") || "sandbox";
  const apiUrl = `https://api.${mode === "live" ? "" : "sandbox."}paypal.com/v2/checkout/orders/${orderId}/capture`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`PayPal order capture failed: ${JSON.stringify(error)}`);
  }

  return await response.json();
};

const isUuid = (value?: string) => {
  return typeof value === "string" && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
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
      return "expired";
    case "cancelled":
    case "canceled":
    case "voided":
      return "cancelled";
    default:
      return "pending";
  }
};

const recordPaymentTransaction = async (
  supabase: any,
  userId: string,
  orderId: string,
  amount: number,
  currency: string,
  status: string,
  paymentType: string,
  escrowTransactionId?: string,
  marketplaceOrderId?: string
): Promise<string> => {
  const normalizedStatus = normalizePayPalStatus(status);
  const allowedStatuses = new Set([
    "pending",
    "approved",
    "completed",
    "denied",
    "refunded",
    "expired",
    "cancelled",
    "failed",
  ]);

  if (!allowedStatuses.has(normalizedStatus)) {
    throw new Error(
      `Unsupported normalized PayPal status: ${JSON.stringify(status)} -> ${JSON.stringify(normalizedStatus)}`
    );
  }

  const insertPayload: Record<string, unknown> = {
    user_id: userId,
    paypal_order_id: orderId,
    amount,
    currency,
    status: normalizedStatus,
    payment_type: paymentType,
    metadata: {
      created_at: new Date().toISOString(),
    },
  };

  if (isUuid(escrowTransactionId)) {
    insertPayload.escrow_transaction_id = escrowTransactionId;
  }

  if (isUuid(marketplaceOrderId)) {
    insertPayload.marketplace_order_id = marketplaceOrderId;
  }

  console.log("Recording PayPal transaction", {
    userId,
    orderId,
    status,
    normalizedStatus,
    escrowTransactionId,
    marketplaceOrderId,
    insertPayload,
  });

  const { data, error } = await supabase
    .from("paypal_transactions")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to record payment: ${error.message}`);
  }

  return data.id;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body = await req.json();
    const action = body.action; // 'create' or 'capture'

    if (action === "create") {
      const createBody = body as CreateOrderRequest;

      if (!createBody.amount || !createBody.currency || !createBody.description) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: amount, currency, description",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get PayPal access token
      const accessToken = await getPayPalAccessToken();

      // Create PayPal order
      const paypalOrder = await createPayPalOrder(
        createBody.amount,
        createBody.currency,
        createBody.description,
        accessToken,
        {
          escrowTransactionId: createBody.escrowTransactionId,
          marketplaceOrderId: createBody.marketplaceOrderId,
        }
      );

      // Record transaction in database as pending for order creation
      console.log("PayPal order created", {
        paypalOrderStatus: paypalOrder.status,
        paypalOrderId: paypalOrder.id,
      });

      const transactionId = await recordPaymentTransaction(
        supabase,
        user.id,
        paypalOrder.id,
        createBody.amount,
        createBody.currency,
        paypalOrder.status,
        "paypal",
        createBody.escrowTransactionId,
        createBody.marketplaceOrderId
      );

      return new Response(
        JSON.stringify({
          orderId: paypalOrder.id,
          transactionId,
          status: paypalOrder.status,
          approvalUrl: paypalOrder.links.find((l) => l.rel === "approve")?.href,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else if (action === "capture") {
      const captureBody = body as CaptureOrderRequest;

      if (!captureBody.orderId) {
        return new Response(
          JSON.stringify({ error: "Missing orderId" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get PayPal access token
      const accessToken = await getPayPalAccessToken();

      // Capture PayPal order
      const captureResponse = await capturePayPalOrder(
        captureBody.orderId,
        accessToken
      );

      if (
        captureResponse.status !== "COMPLETED" &&
        captureResponse.status !== "PROCESSING"
      ) {
        return new Response(
          JSON.stringify({
            error: `Payment capture failed with status: ${captureResponse.status}`,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Get capture transaction details
      const captureId =
        captureResponse.purchase_units[0]?.payments?.captures[0]?.id;
      const captureAmount =
        captureResponse.purchase_units[0]?.payments?.captures[0]?.amount?.value;

      // Update transaction status in database
      const { error: updateError } = await supabase
        .from("paypal_transactions")
        .update({
          status: "completed",
          capture_id: captureId,
          updated_at: new Date().toISOString(),
        })
        .eq("paypal_order_id", captureBody.orderId);

      if (updateError) {
        return new Response(
          JSON.stringify({
            error: `Failed to update transaction: ${updateError.message}`,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Trigger wallet funding via database function for valid escrow payments only
      if (captureBody.escrowTransactionId && isUuid(captureBody.escrowTransactionId)) {
        const { error: fundError } = await supabase.rpc(
          "fund_wallet_from_paypal",
          {
            p_user_id: user.id,
            p_escrow_transaction_id: captureBody.escrowTransactionId,
            p_amount: parseFloat(captureAmount || "0"),
            p_paypal_transaction_id: captureBody.orderId,
          }
        );

        if (fundError) {
          return new Response(
            JSON.stringify({
              error: `Failed to fund wallet: ${fundError.message}`,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }

      return new Response(
        JSON.stringify({
          orderId: captureBody.orderId,
          captureId,
          status: "completed",
          amount: captureAmount,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'create' or 'capture'." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("PayPal error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
