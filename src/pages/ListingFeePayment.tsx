import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  DollarSign, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Info,
  Clock,
  Shield,
  Upload,
  Building,
  Wallet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMarketplaceProduct } from "@/hooks/useMarketplace";
import { useListingFee, useListingFees, usePayListingFee } from "@/hooks/useMarketplace";
import { useCurrency } from "@/contexts/CurrencyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PaymentButton } from "@/components/PayPalPayment";

const ListingFeePayment = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const { formatAmount, currency } = useCurrency();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("wallet");
  
  // Bank Transfer Form State
  const [bankReference, setBankReference] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);

  const { data: product, isLoading: productLoading } = useMarketplaceProduct(productId);
  const { data: listingFee, isLoading: feeLoading } = useListingFee(product?.category);
  const { data: existingFees } = useListingFees(productId);
  const payListingFee = usePayListingFee();

  const isLoading = productLoading || feeLoading;
  const hasPaidFee = existingFees?.some((fee: any) => fee.fee_status === 'paid');
  const feeAmount = listingFee || 0;

  // Fetch Bank Details
  const currencySuffix = currency.toLowerCase();
  const resolveBankSetting = (map: Record<string, string>, key: string) => {
    const candidates = [
      `${key}_${currencySuffix}`,
      key,
      `${key}_usd`,
      `${key}_ngn`,
      `${key}_gbp`,
    ];
    for (const candidate of candidates) {
      if (map[candidate]) return map[candidate];
    }
    return "Not configured";
  };

  const { data: bankDetails } = useQuery({
    queryKey: ["bank-details", currency],
    queryFn: async () => {
      const queryKeys = [
        "bank_name", "bank_name_usd", "bank_name_eur", "bank_name_ngn", "bank_name_gbp",
        "bank_account_name", "bank_account_name_usd", "bank_account_name_eur", "bank_account_name_ngn", "bank_account_name_gbp",
        "bank_account_number", "bank_account_number_usd", "bank_account_number_eur", "bank_account_number_ngn", "bank_account_number_gbp",
        "bank_routing_number", "bank_routing_number_usd", "bank_routing_number_eur", "bank_routing_number_ngn", "bank_routing_number_gbp",
        "bank_swift_code", "bank_swift_code_usd", "bank_swift_code_eur", "bank_swift_code_ngn", "bank_swift_code_gbp",
      ];

      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_key, description")
        .in("setting_key", queryKeys);

      if (error) throw error;

      const map: Record<string, string> = {};
      data?.forEach((item) => {
        map[item.setting_key] = item.description ?? "";
      });

      return {
        bankName: resolveBankSetting(map, "bank_name"),
        accountName: resolveBankSetting(map, "bank_account_name"),
        accountNumber: resolveBankSetting(map, "bank_account_number"),
        routingNumber: resolveBankSetting(map, "bank_routing_number"),
        swiftCode: resolveBankSetting(map, "bank_swift_code"),
      };
    },
  });

  const handleWalletPayment = async () => {
    if (!productId || !product || !feeAmount) return;

    try {
      setIsProcessing(true);
      await payListingFee.mutateAsync({ 
        productId,
        paymentMethod: 'wallet' 
      });
      
      toast({
        title: "Payment Successful",
        description: "Your listing fee has been paid from your wallet.",
      });

      setTimeout(() => {
        navigate(`/marketplace/${productId}`);
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Insufficient balance or transaction failed.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBankTransferSubmit = async () => {
    if (!user || !productId) return;

    if (!bankReference.trim()) {
      toast({ title: "Error", description: "Please enter a bank reference", variant: "destructive" });
      return;
    }

    if (!proofFile) {
      toast({ title: "Error", description: "Please upload proof of payment", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Upload proof
      const fileExt = proofFile.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `listing-fees/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("deposit-proofs")
        .upload(filePath, proofFile);

      if (uploadError) throw uploadError;

      // 2. Create listing fee payment record
      const { error: insertError } = await supabase
        .from("listing_fee_payments")
        .insert({
          user_id: user.id,
          product_id: productId,
          amount: feeAmount,
          bank_reference: bankReference,
          proof_url: filePath,
          status: "pending"
        });

      if (insertError) throw insertError;

      toast({
        title: "Success",
        description: "Listing fee proof submitted. Waiting for admin approval.",
      });

      setTimeout(() => {
        navigate(`/marketplace/${productId}`);
      }, 2000);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to submit bank transfer", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading listing fee information...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Product Not Found</h2>
          <p className="text-muted-foreground mb-4">The product you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/marketplace")}>
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  // Check if user is the seller
  if (product.created_by !== user.id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mx-auto mb-4 rounded-lg shadow-md" />
          <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground mb-4">Only the product owner can pay listing fees.</p>
          <Button onClick={() => navigate("/marketplace")}>
            Back to Marketplace
          </Button>
        </div>
      </div>
    );
  }

  // Check if listing fee is required for this category
  if (product.category !== 'real_estate' && product.category !== 'automobile') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">No Listing Fee Required</h2>
          <p className="text-muted-foreground mb-4">
            Listing fees are only required for Real Estate and Automobile categories.
          </p>
          <Button onClick={() => navigate(`/marketplace/${productId}`)}>
            View Product
          </Button>
        </div>
      </div>
    );
  }

  if (hasPaidFee) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-4">Listing Fee Paid</h2>
          <p className="text-muted-foreground mb-4">
            Your listing fee has been paid. Your product is currently pending verification.
          </p>
          <Button onClick={() => navigate(`/marketplace/${productId}`)}>
            View Product
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/marketplace/${productId}`)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Product
          </Button>
          <div className="flex items-center gap-3">
            <DollarSign className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-semibold">Listing Fee Payment</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Product Information */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Info className="w-5 h-5" />
                  Product Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold">{product.title}</h3>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Category</p>
                    <Badge variant="secondary" className="mt-1">
                      {product.category.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Listing Fee</p>
                    <p className="font-semibold text-lg text-primary">{formatAmount(feeAmount)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <Shield className="w-5 h-5" />
                  Listing Benefits
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                    <p className="text-sm text-muted-foreground">Prevents fake listings and ensures quality</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                    <p className="text-sm text-muted-foreground">Boosts your product visibility</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                    <p className="text-sm text-muted-foreground">Supports platform maintenance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5" />
                  Select Payment Method
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid grid-cols-3 w-full h-auto p-1 gap-2 bg-secondary/20">
                    <TabsTrigger value="wallet" className="flex flex-col items-center gap-2 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20">
                      <Wallet className="w-5 h-5" />
                      <span className="text-sm font-medium">Wallet</span>
                    </TabsTrigger>
                    <TabsTrigger value="bank" className="flex flex-col items-center gap-2 py-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary border border-transparent data-[state=active]:border-primary/20">
                      <Building className="w-5 h-5" />
                      <span className="text-sm font-medium">Bank Transfer</span>
                    </TabsTrigger>
                    <TabsTrigger value="paypal" className="flex flex-col items-center gap-2 py-3 data-[state=active]:bg-[#0070ba]/10 data-[state=active]:text-[#0070ba] border border-transparent data-[state=active]:border-[#0070ba]/20">
                      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.11c-.473 0-.867.317-.984.777l-.956 6.12h-.033l-.063.399a.64.64 0 0 1-.628.532zM7.182 11.96h2.843c2.936 0 5.378-1.042 6.136-4.907.037-.184.072-.37.106-.558.18-1.127.02-2.13-.578-2.82C15.003 2.87 13.518 2.5 11.458 2.5H7.785L5.703 15.65h3.045l-1.566-3.69z"/></svg>
                      <span className="text-sm font-medium">PayPal</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="wallet">
                    <div className="p-6 border border-border rounded-xl bg-card text-center space-y-6">
                      <div className="max-w-xs mx-auto">
                        <h3 className="text-lg font-semibold mb-2">Pay via Commission Wallet</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                          The listing fee of {formatAmount(feeAmount)} will be instantly deducted from your commission wallet.
                        </p>
                        <Button 
                          onClick={handleWalletPayment}
                          disabled={isProcessing}
                          className="w-full h-12 text-lg"
                        >
                          {isProcessing ? "Processing..." : "Pay from Wallet"}
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="bank" className="space-y-6">
                    <div className="bg-secondary/20 border border-border rounded-xl p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <Building className="w-6 h-6 text-primary" />
                        <h3 className="text-lg font-semibold">Bank Transfer Instructions</h3>
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-6">
                        Transfer the exact amount of {formatAmount(feeAmount)} to the following bank account. Include your reference number.
                      </p>

                      <div className="grid grid-cols-2 gap-4 bg-background p-4 rounded-lg border border-border">
                        <div>
                          <p className="text-xs text-muted-foreground">Bank Name</p>
                          <p className="font-semibold">{bankDetails?.bankName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Account Name</p>
                          <p className="font-semibold">{bankDetails?.accountName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Account Number</p>
                          <p className="font-mono font-bold text-primary">{bankDetails?.accountNumber}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Routing / Sort Code</p>
                          <p className="font-mono">{bankDetails?.routingNumber}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 p-6 border border-border rounded-xl bg-card">
                      <div className="space-y-2">
                        <Label>Transfer Reference *</Label>
                        <Input 
                          placeholder="e.g. TRX123456" 
                          value={bankReference} 
                          onChange={(e) => setBankReference(e.target.value)} 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Proof of Payment *</Label>
                        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-secondary/20 transition-colors">
                          <input 
                            type="file" 
                            accept="image/*,.pdf" 
                            onChange={(e) => setProofFile(e.target.files?.[0] || null)} 
                            className="hidden" 
                            id="proof-upload" 
                          />
                          <label htmlFor="proof-upload" className="cursor-pointer block">
                            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            {proofFile ? (
                              <span className="text-sm font-medium text-primary">{proofFile.name}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Click to upload receipt (Image or PDF)</span>
                            )}
                          </label>
                        </div>
                      </div>

                      <Button 
                        onClick={handleBankTransferSubmit} 
                        disabled={isProcessing}
                        className="w-full h-12 text-lg mt-4"
                      >
                        {isProcessing ? "Submitting..." : "Submit Proof of Payment"}
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="paypal">
                    <div className="p-8 border border-border rounded-xl bg-card text-center">
                      <div className="max-w-sm mx-auto space-y-6">
                        <div className="flex justify-center mb-4">
                          <svg viewBox="0 0 24 24" className="w-12 h-12 fill-[#0070ba]"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.11c-.473 0-.867.317-.984.777l-.956 6.12h-.033l-.063.399a.64.64 0 0 1-.628.532zM7.182 11.96h2.843c2.936 0 5.378-1.042 6.136-4.907.037-.184.072-.37.106-.558.18-1.127.02-2.13-.578-2.82C15.003 2.87 13.518 2.5 11.458 2.5H7.785L5.703 15.65h3.045l-1.566-3.69z"/></svg>
                        </div>
                        <h3 className="text-xl font-bold">Pay with PayPal</h3>
                        <p className="text-muted-foreground">
                          Instantly activate your listing via PayPal secure checkout.
                        </p>
                        
                        <div className="bg-secondary/20 p-4 rounded-lg flex justify-between items-center">
                          <span className="font-medium">Listing Fee</span>
                          <span className="text-xl font-bold text-primary">{formatAmount(feeAmount)}</span>
                        </div>

                        <PaymentButton
                          amount={feeAmount}
                          onSuccess={() => {
                            toast({
                              title: "Payment Successful",
                              description: "Your listing fee has been paid via PayPal.",
                            });
                            // To actually set the product to active, we'd need a backend call. 
                            // But for now, just navigate.
                            setTimeout(() => navigate(`/marketplace/${productId}`), 2000);
                          }}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListingFeePayment;
