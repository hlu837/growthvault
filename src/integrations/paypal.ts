/**
 * PayPal Payment Integration Utility
 * Provides methods to create and capture PayPal orders
 */

import { supabase } from "./supabase/client";

const PAYPAL_FUNCTION_ENDPOINT =
  import.meta.env.VITE_SUPABASE_PAYPAL_FUNCTION_URL ||
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/paypal-payment`;

export interface PayPalPaymentOptions {
  amount: number;
  currency: string;
  description: string;
  escrowTransactionId?: string;
  marketplaceOrderId?: string;
}

export interface PayPalPaymentResult {
  orderId: string;
  transactionId: string;
  status: string;
  approvalUrl: string;
}

export interface PayPalCaptureResult {
  orderId: string;
  captureId: string;
  status: string;
  amount: string;
}

/**
 * Create a PayPal order
 * This initiates the payment process and returns an order ID for user approval
 */
export async function createPayPalOrder(
  options: PayPalPaymentOptions
): Promise<PayPalPaymentResult> {
  try {
    // Get user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error("User not authenticated");
    }

    // Call the Edge Function
    const response = await fetch(PAYPAL_FUNCTION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "create",
        amount: options.amount,
        currency: options.currency,
        description: options.description,
        escrowTransactionId: options.escrowTransactionId,
        marketplaceOrderId: options.marketplaceOrderId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create PayPal order");
    }

    const result = await response.json();
    return result as PayPalPaymentResult;
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    throw error;
  }
}

/**
 * Capture a PayPal order
 * Call this after user has approved the order on PayPal
 */
export async function capturePayPalOrder(
  orderId: string,
  escrowTransactionId?: string,
  marketplaceOrderId?: string
): Promise<PayPalCaptureResult> {
  try {
    // Get user session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      throw new Error("User not authenticated");
    }

    // Call the Edge Function
    const response = await fetch(PAYPAL_FUNCTION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        action: "capture",
        orderId,
        escrowTransactionId,
        marketplaceOrderId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to capture PayPal order");
    }

    const result = await response.json();
    return result as PayPalCaptureResult;
  } catch (error) {
    console.error("Error capturing PayPal order:", error);
    throw error;
  }
}

/**
 * Get PayPal transaction details
 */
export async function getPayPalTransaction(transactionId: string) {
  try {
    const { data, error } = await supabase
      .from("paypal_transactions")
      .select("*")
      .eq("id", transactionId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching PayPal transaction:", error);
    throw error;
  }
}

/**
 * Poll for transaction status (for checking if webhook has processed)
 */
export async function pollTransactionStatus(
  orderId: string,
  maxAttempts = 30,
  delayMs = 1000
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const { data, error } = await supabase
        .from("paypal_transactions")
        .select("status")
        .eq("paypal_order_id", orderId)
        .single();

      if (!error && data && data.status === "completed") {
        return "completed";
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    } catch (error) {
      console.error("Error polling transaction status:", error);
    }
  }

  return "pending";
}

/**
 * Get user's PayPal transactions
 */
export async function getUserPayPalTransactions() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from("paypal_transactions")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Error fetching user PayPal transactions:", error);
    throw error;
  }
}
