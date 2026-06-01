import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  Trash2,
  CreditCard,
  Wallet,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCart, useRemoveFromCart, useCommitCartPurchase } from "@/hooks/useMarketplace";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const MarketplaceCart = () => {
  const { data: cartItems, isLoading } = useCart();
  const removeFromCart = useRemoveFromCart();
  const commitCartPurchase = useCommitCartPurchase();
  const { formatAmount } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in to view your cart</h2>
          <Link to="/auth">
            <Button>Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  const totalAmount = cartItems?.reduce(
    (sum, item) => sum + (item.product?.price || 0) * item.quantity,
    0
  ) || 0;

  const handleCheckout = async (paymentMethod: "wallet" | "card") => {
    if (!cartItems || cartItems.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (paymentMethod === "card") {
      toast.info("Card payments coming soon. Please use wallet payment for now.");
      return;
    }

    commitCartPurchase.mutate(
      {
        cartItems,
        paymentMethod,
        feePercent: 10,
        metadata: {
          checkout_method: paymentMethod,
          timestamp: new Date().toISOString(),
        },
      },
      {
        onSuccess: () => {
          toast.success("Purchase completed successfully!");
          setTimeout(() => {
            navigate(`/dashboard`, { replace: true });
          }, 1500);
        },
        onError: (error: any) => {
          toast.error(error.message || "Checkout failed. Please try again.");
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 flex items-center h-14 gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Marketplace
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">Shopping Cart</h1>

        {isLoading ? (
          <div className="py-20 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : !cartItems || cartItems.length === 0 ? (
          <div className="py-20 text-center">
            <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Your cart is empty</h3>
            <Link to="/marketplace">
              <Button variant="outline" className="mt-4">Browse Marketplace</Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 rounded-xl border border-border bg-card"
                >
                  <div className="w-20 h-20 rounded-lg bg-secondary/50 overflow-hidden flex-shrink-0">
                    {item.product?.thumbnail_url ? (
                      <img
                        src={item.product.thumbnail_url}
                        alt={item.product.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        {item.product?.category === "real_estate" ? "🏠" : item.product?.category === "automobile" ? "🚗" : "📱"}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link to={`/marketplace/${item.product_id}`}>
                      <h3 className="font-semibold truncate hover:text-accent transition-colors">
                        {item.product?.title || "Unknown Product"}
                      </h3>
                    </Link>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Qty: {item.quantity}
                    </p>
                    <p className="font-bold font-mono text-accent mt-1">
                      {formatAmount(item.product?.price || 0)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive flex-shrink-0"
                    onClick={() => removeFromCart.mutate(item.id, {
                      onSuccess: () => toast.success("Removed from cart"),
                    })}
                    disabled={removeFromCart.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="sticky top-20 p-6 rounded-xl border border-border bg-card space-y-4">
                <h3 className="font-semibold">Order Summary</h3>
                <Separator />
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal ({cartItems.length} items)</span>
                    <span className="font-mono">{formatAmount(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing Fee</span>
                    <span className="font-mono text-accent">Free</span>
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold font-mono text-accent">
                    {formatAmount(totalAmount)}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <Button 
                    className="w-full gap-2" 
                    size="lg"
                    onClick={() => handleCheckout("wallet")}
                    disabled={commitCartPurchase.isPending || !cartItems || cartItems.length === 0}
                  >
                    {commitCartPurchase.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <Wallet className="w-4 h-4" />
                    {commitCartPurchase.isPending ? "Processing..." : "Pay with Wallet"}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2" 
                    size="lg"
                    onClick={() => handleCheckout("card")}
                    disabled={commitCartPurchase.isPending || !cartItems || cartItems.length === 0}
                  >
                    <CreditCard className="w-4 h-4" />
                    Pay with Card
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  Secure checkout · All listings are admin-verified
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MarketplaceCart;
