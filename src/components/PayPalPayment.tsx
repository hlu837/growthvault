/**
 * PayPal Payment Flow Components
 * 
 * Example implementation of PayPal integration with GrowthVault escrow system
 * 
 * Usage:
 * - PaymentButton: Initiates payment
 * - PaymentSuccess: Handles return from PayPal
 * - PaymentCancel: Handles user cancellation
 */

import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPayPalOrder, capturePayPalOrder } from "@/integrations/paypal";
import { toast } from "sonner"; // or your toast library

// ============================================================================
// Payment Initiation Button
// ============================================================================

interface PaymentButtonProps {
  escrowTransactionId?: string;
  amount: number;
  currency?: string;
  description?: string;
  onPaymentInitiated?: () => void;
  disabled?: boolean;
}

export function PaymentButton({
  escrowTransactionId,
  amount,
  currency = "USD",
  description = "GrowthVault Marketplace Purchase",
  onPaymentInitiated,
  disabled = false,
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (amount <= 0) {
        toast.error("Invalid payment amount");
        return;
      }

      // Create PayPal order
      const order = await createPayPalOrder({
        amount,
        currency,
        description,
        escrowTransactionId,
      });

      if (!order.approvalUrl) {
        toast.error("Failed to create payment order");
        return;
      }

      // Call callback if provided
      onPaymentInitiated?.();

      // Add custom parameter to return URL so we can capture the order
      const returnUrl = new URL(order.approvalUrl);
      // Note: PayPal will redirect to PAYPAL_RETURN_URL with ?token=<orderId>
      // We handle this in PaymentSuccess component

      // Redirect to PayPal
      window.location.href = order.approvalUrl;
    } catch (error) {
      console.error("Payment creation failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create payment"
      );
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading || disabled}
      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? "Initializing Payment..." : "Pay with PayPal"}
    </button>
  );
}

// ============================================================================
// Payment Success Handler
// ============================================================================

interface PaymentSuccessProps {
  escrowTransactionId?: string;
  onSuccess?: (result: any) => void;
  redirectDelay?: number; // ms before redirect
}

export function PaymentSuccess({
  escrowTransactionId,
  onSuccess,
  redirectDelay = 2000,
}: PaymentSuccessProps) {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">(
    "processing"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  // PayPal returns 'token' parameter which is the order ID
  const orderId = searchParams.get("token");
  
  // Get payment context from sessionStorage
  const paymentContext = React.useMemo(() => {
    try {
      const context = sessionStorage.getItem('paymentContext');
      return context ? JSON.parse(context) : { type: 'wallet' };
    } catch (e) {
      return { type: 'wallet' };
    }
  }, []);

  const paymentType = paymentContext.type || "wallet"; // "wallet" or "listing_fee"
  const productId = paymentContext.productId;

  React.useEffect(() => {
    const captureOrder = async () => {
      if (!orderId) {
        setStatus("error");
        setErrorMessage("No payment order found. Please try again.");
        return;
      }

      try {
        // Capture the order (finalize payment)
        const result = await capturePayPalOrder(
          orderId,
          escrowTransactionId
        );

        console.log("Payment captured:", result);
        setStatus("success");
        onSuccess?.(result);

        // Clear payment context
        sessionStorage.removeItem('paymentContext');

        // Redirect based on payment type
        const redirectPath = paymentType === "listing_fee" 
          ? `/marketplace/${productId}`
          : "/dashboard/orders";

        setTimeout(() => {
          navigate(redirectPath, { replace: true });
        }, redirectDelay);
      } catch (error) {
        console.error("Payment capture failed:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to complete payment"
        );
      }
    };

    captureOrder();
  }, [orderId, escrowTransactionId, navigate, onSuccess, redirectDelay, paymentType, productId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        {status === "processing" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Processing Payment
            </h2>
            <p className="text-center text-gray-600">
              Please wait while we confirm your payment with PayPal...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Payment Successful!
            </h2>
            <p className="text-center text-gray-600 mb-4">
              {paymentType === "listing_fee" 
                ? "Your listing fee has been paid successfully. Your listing is now pending verification."
                : "Your payment has been processed successfully. Your wallet has been funded."}
            </p>
            <p className="text-center text-sm text-gray-500">
              Redirecting in a moment...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
              Payment Failed
            </h2>
            <p className="text-center text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate(
                paymentType === "listing_fee" 
                  ? `/seller/listing-fee/${productId}`
                  : "/checkout",
                { replace: true }
              )}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Payment Cancellation Handler
// ============================================================================

export function PaymentCancel() {
  const navigate = useNavigate();

  // Get payment context from sessionStorage
  const paymentContext = React.useMemo(() => {
    try {
      const context = sessionStorage.getItem('paymentContext');
      return context ? JSON.parse(context) : { type: 'wallet' };
    } catch (e) {
      return { type: 'wallet' };
    }
  }, []);

  const paymentType = paymentContext.type || "wallet";
  const productId = paymentContext.productId;

  const handleRetry = () => {
    if (paymentType === "listing_fee") {
      navigate(`/seller/listing-fee/${productId}`, { replace: true });
    } else {
      navigate("/checkout", { replace: true });
    }
  };

  const handleReturn = () => {
    // Clear payment context
    sessionStorage.removeItem('paymentContext');
    
    if (paymentType === "listing_fee") {
      navigate(`/marketplace/${productId}`, { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100">
            <svg
              className="h-6 w-6 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-2">
          Payment Cancelled
        </h2>
        <p className="text-center text-gray-600 mb-6">
          You have cancelled the payment process. Your funds are safe and have
          not been charged.
        </p>
        <button
          onClick={handleRetry}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors mb-2"
        >
          Try Again
        </button>
        <button
          onClick={handleReturn}
          className="w-full px-4 py-2 bg-gray-200 text-gray-900 rounded-lg font-medium hover:bg-gray-300 transition-colors"
        >
          {paymentType === "listing_fee" ? "Back to Listing" : "Return to Dashboard"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Complete Checkout Component Example
// ============================================================================

interface CheckoutPageProps {
  escrowTransactionId: string;
  amount: number;
  itemDescription: string;
  buyerName: string;
}

export function CheckoutPage({
  escrowTransactionId,
  amount,
  itemDescription,
  buyerName,
}: CheckoutPageProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Order Summary
          </h2>

          <div className="border-b border-gray-200 pb-4 mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Item:</span>
              <span className="font-medium">{itemDescription}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Buyer:</span>
              <span className="font-medium">{buyerName}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-gray-700">Amount:</span>
              <span className="text-lg font-bold text-green-600">${amount}</span>
            </div>
          </div>

          {/* Escrow Note */}
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <p className="text-sm text-blue-900">
              <strong>Note:</strong> Your payment will be held in secure escrow
              until the seller confirms delivery. You have full protection
              against fraud.
            </p>
          </div>

          {/* Terms Acceptance */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded"
              />
              <span className="ml-2 text-sm text-gray-700">
                I agree to the{" "}
                <a href="/terms" className="text-blue-600 hover:underline">
                  escrow terms and conditions
                </a>
              </span>
            </label>
          </div>

          {/* Payment Button */}
          <PaymentButton
            escrowTransactionId={escrowTransactionId}
            amount={amount}
            description={itemDescription}
            disabled={!agreedToTerms}
            onPaymentInitiated={() => {
              console.log("Payment initiated for order:", escrowTransactionId);
            }}
          />
        </div>

        {/* Security Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-2">
              <svg
                className="h-5 w-5 text-green-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="font-semibold text-gray-900">Secure</h3>
            </div>
            <p className="text-sm text-gray-600">
              PayPal's encryption protects your payment information
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-2">
              <svg
                className="h-5 w-5 text-green-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M8.256 4.306a.996.996 0 01.512 1.364l-.16.292c-.335.609-.223 1.4.165 2.038.39.638 1.058.922 1.694.922H11a5 5 0 010 10H8.944a6 6 0 01-1.416-11.855z" />
                <path d="M14.834 7.71a.996.996 0 00-1.364-.512l-.292.16c-.609.335-1.4.223-2.038-.165-.638-.39-.922-1.058-.922-1.694V9a5 5 0 01-10 0v2.056a6 6 0 0011.855 1.416z" />
              </svg>
              <h3 className="font-semibold text-gray-900">Protected</h3>
            </div>
            <p className="text-sm text-gray-600">
              Escrow protection ensures fair transactions
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center mb-2">
              <svg
                className="h-5 w-5 text-green-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <h3 className="font-semibold text-gray-900">Verified</h3>
            </div>
            <p className="text-sm text-gray-600">
              Both parties verified through GrowthVault
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ROUTER SETUP REQUIRED:
 * 
 * Add these routes to your React Router:
 * 
 * <Route path="/checkout" element={<CheckoutPage {...props} />} />
 * <Route path="/payment/success" element={<PaymentSuccess />} />
 * <Route path="/payment/cancel" element={<PaymentCancel />} />
 * 
 * These URLs must match PAYPAL_RETURN_URL and PAYPAL_CANCEL_URL
 * environment variables in Supabase secrets.
 */
