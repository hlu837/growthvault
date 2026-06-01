import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  MapPin,
  Star,
  Shield,
  ChevronLeft,
  ChevronRight,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import jsPDF from "jspdf";
import {
  useMarketplaceProduct,
  useMarketplaceProductDocuments,
  useSecureDocumentUrl,
  useMarketplaceSettings,
  useUserMarketplaceOrder,
  useCommitToPurchase,
  useConfirmReceipt,
  useDisputeResponses,
  useOrderReceipts,
  useSellerDisputeOrder,
  useSellerDisputeResponse,
  sanitizeMarketplaceText,
  getProductRiskScore,
  getEscrowReleaseDays,
  getRequiredDocumentsForCategory,
  canReleaseEscrow,
  captureTransactionMetadata,
  categoryLabels,
} from "@/hooks/useMarketplace";
import { useWallets } from "@/hooks/useWallets";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { DisputeDialog } from "@/components/DisputeDialog";
import { toast } from "sonner";

const MarketplaceProductDetail = () => {
  const { productId } = useParams<{ productId: string }>();
  const { data: product, isLoading } = useMarketplaceProduct(productId);
  const settings = useMarketplaceSettings();
  const { data: order } = useUserMarketplaceOrder(productId);
  const commitToPurchase = useCommitToPurchase();
  const { wallets, isLoading: walletsLoading } = useWallets();
  const { user, profile, isAdmin } = useAuth();
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [autoConfirmTriggered, setAutoConfirmTriggered] = useState(false);
  const autoConfirmRef = useRef(false);
  const { data: secureUrl, isLoading: secureUrlLoading } = useSecureDocumentUrl(activeDocumentId || undefined);

  useEffect(() => {
    if (secureUrl && activeDocumentId) {
      window.open(secureUrl, '_blank');
      setActiveDocumentId(null);
    }
  }, [secureUrl, activeDocumentId]);

  const handleDocumentClick = (documentId: string) => {
    setActiveDocumentId(documentId);
  };

  const handleSellerResponse = async () => {
    if (!sellerDisputedOrder?.id) return;

    if (sellerResponseMode === "reject" && (!sellerExplanation || !sellerEvidenceUrl)) {
      toast.error("Please provide an explanation and evidence when rejecting the dispute.");
      return;
    }

    if (sellerResponseMode === "replacement" && !sellerExplanation) {
      toast.error("Please provide an explanation for the replacement request.");
      return;
    }

    try {
      await sellerDisputeResponseMutation.mutateAsync({
        orderId: sellerDisputedOrder.id,
        explanation:
          sellerExplanation || (sellerResponseMode === "accept" ? "Seller accepted the claim." : "Seller responded to the dispute."),
        evidenceUrl: sellerEvidenceUrl,
        responseType: sellerResponseMode,
      });

      toast.success(
        sellerResponseMode === "accept"
          ? "Dispute accepted and refund initiated."
          : sellerResponseMode === "replacement"
          ? "Replacement selected; escrow remains locked until delivery and inspection."
          : "Your dispute response has been submitted."
      );
      setSellerExplanation("");
      setSellerEvidenceUrl("");
    } catch (error) {
      toast.error("Failed to submit seller dispute response.");
    }
  };

  const confirmReceipt = useConfirmReceipt();
  const { data: receipts, isLoading: receiptsLoading } = useOrderReceipts(order?.id);
  const [isDownloadingReceipt, setIsDownloadingReceipt] = useState(false);

  const selectedReceipt = receipts?.find((receipt) => receipt.receipt_type === "final_release")
    ?? receipts?.find((receipt) => receipt.receipt_type === "commitment_fee")
    ?? receipts?.[0];

  const downloadReceiptPdf = async () => {
    if (!selectedReceipt) {
      toast.error("No receipt available to download.");
      return;
    }

    setIsDownloadingReceipt(true);
    try {
      const snapshot = selectedReceipt.receipt_data || {};
      const doc = new jsPDF({ unit: "pt", format: "letter" });

      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Ninja Servers Official Receipt", 40, 60);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const lines = [
        `Receipt No.: ${selectedReceipt.receipt_number}`,
        `Receipt Type: ${selectedReceipt.receipt_title || selectedReceipt.receipt_type}`,
        `Date: ${new Date(selectedReceipt.created_at).toLocaleString()}`,
        "",
        `Buyer: ${snapshot.buyer_name || profile?.full_name || user?.email || "Buyer"}`,
        `Seller: ${snapshot.seller_name || snapshot.seller_full_name || "Marketplace Seller"}`,
        `Product: ${snapshot.product_title || product?.title || "Marketplace item"}`,
        `Transaction ID: ${order?.order_number || selectedReceipt.order_id}`,
        `Payment Method: ${snapshot.payment_method || "Escrow"}`,
        `Amount: ${formatAmount(selectedReceipt.amount)}`,
        "",
        "Line item details:",
        ` • Item price: ${formatAmount(snapshot.product_price || 0)}`,
        ` • Commitment fee: ${formatAmount(snapshot.commitment_fee || 0)}`,
        ` • Commission deducted: ${formatAmount(snapshot.commission_deducted || 0)}`,
        ` • Escrow hold amount: ${formatAmount(snapshot.escrow_hold_amount || order?.total_escrow_hold_amount || 0)}`,
      ];

      const startY = 90;
      lines.forEach((line, index) => {
        doc.text(line, 40, startY + index * 16);
      });

      const fileName = `${selectedReceipt.receipt_number || "receipt"}-${selectedReceipt.order_id}.pdf`;
      doc.save(fileName);
    } catch (error) {
      toast.error("Unable to generate the receipt PDF.");
    } finally {
      setIsDownloadingReceipt(false);
    }
  };

  const commitmentFeePercent = settings.data?.commitmentFeePercent ?? 10;
  const productRiskScore = product ? getProductRiskScore(product) : 0;
  const requiredDocuments = product ? getRequiredDocumentsForCategory(product.category) : [];
  const riskThreshold = settings.data?.riskBlockThreshold ?? 61;
  const isRiskBlocked = productRiskScore >= riskThreshold;
  const escrowDays = product ? getEscrowReleaseDays(product.category, product.location) : 0;
  const commitmentFee = product && product.category !== 'electronic' ? product.price * (commitmentFeePercent / 100) : 0;
  const totalAvailableBalance = wallets?.reduce(
    (sum, wallet) => sum + Math.max(Number(wallet.balance) || 0, 0),
    0
  ) ?? 0;
  const hasSufficientFunds = totalAvailableBalance >= (product?.category === 'electronic' ? product.price : commitmentFee);
  const isKycApproved = profile?.kyc_status === "approved";
  const isAccountActive = profile?.account_status === "active" || !profile?.account_status;
  const sellerDocuments = (product?.specifications?.seller_documents ?? []) as { name: string; url: string }[];
  const isSeller = product?.created_by === user?.id;
  const canViewDocuments = isAdmin || isSeller || order?.payment_status === "confirmed";
  const { data: marketplaceDocuments } = useMarketplaceProductDocuments(
    canViewDocuments ? productId : undefined,
    canViewDocuments
  );

  const sellerDisputedOrder = useSellerDisputeOrder(productId);
  const sellerDisputeResponses = useDisputeResponses(sellerDisputedOrder?.id);
  const sellerDisputeResponseMutation = useSellerDisputeResponse();
  const [sellerResponseMode, setSellerResponseMode] = useState<"accept" | "reject" | "replacement">("accept");
  const [sellerExplanation, setSellerExplanation] = useState("");
  const [sellerEvidenceUrl, setSellerEvidenceUrl] = useState("");

  const inspectionStartedAt = order?.notes
    ? (() => {
        try {
          const parsed = JSON.parse(order.notes)?.inspection_window_started_at;
          const date = new Date(parsed);
          return isNaN(date.getTime()) ? null : date;
        } catch {
          return null;
        }
      })()
    : null;

  const isWithinDisputeWindow = inspectionStartedAt
    ? Date.now() < inspectionStartedAt.getTime() + 7 * 24 * 60 * 60 * 1000
    : false;

  const isElectronicOrder = product?.category === 'electronic' && order?.payment_status === 'paid';
  const displayOrderStatus = isElectronicOrder
    ? 'confirmed'
    : order?.order_status || 'pending';
  const orderCommitmentFee = product?.category === 'electronic' ? 0 : Number(JSON.parse(order?.notes || '{}').commitment_fee || 0);
  const orderTotalAmount = Number(order?.total_amount || 0);

  useEffect(() => {
    if (
      order &&
      order.order_status === "inspection" &&
      !order.is_escrow_paused &&
      canReleaseEscrow(order) &&
      !autoConfirmRef.current
    ) {
      autoConfirmRef.current = true;
      confirmReceipt.mutate({ orderId: order.id }, {
        onSuccess: () => {
          setAutoConfirmTriggered(true);
        },
      });
    }
  }, [confirmReceipt, order]);

  const handleCommitToPurchase = async () => {
    if (!user) {
      toast.error("Please sign in to complete the commitment fee");
      navigate("/auth");
      return;
    }

    if (!product) return;

    if (!isAccountActive) {
      toast.error("Your account is currently restricted from marketplace commitments.");
      return;
    }

    if (!isKycApproved) {
      toast.error("Complete KYC verification before committing to purchase.");
      navigate("/dashboard/kyc");
      return;
    }

    if (!hasSufficientFunds) {
      const requiredAmount = product?.category === 'electronic' ? product.price : commitmentFee;
      const message = product?.category === 'electronic' 
        ? `Insufficient wallet balance. You need ${formatAmount(requiredAmount)} to complete this purchase.`
        : `Insufficient wallet balance. You need ${formatAmount(commitmentFee)} to pay the commitment fee.`;
      
      toast.error(message);
      return;
    }

    if (isRiskBlocked) {
      toast.error("This listing is blocked from purchase because the marketplace risk score is too high.");
      return;
    }

    const metadata = await captureTransactionMetadata();
    commitToPurchase.mutate(
      {
        product,
        paymentMethod: "wallet",
        feePercent: commitmentFeePercent,
        inspectionDays: escrowDays,
        metadata,
      },
      {
        onSuccess: (order) => {
          const message = product?.category === 'electronic'
            ? "Purchase completed successfully. Your order is now being processed."
            : "Commitment fee paid. The inspection window is now open and a legally binding digital signature has been captured.";
          toast.success(message);
          // Close modal and reset form
          setIsModalOpen(false);
          setIsChecked(false);
          // Navigate to dashboard to view order
          setTimeout(() => {
            navigate(`/dashboard`, { replace: true });
          }, 1500);
        },
        onError: () => {
          const message = product?.category === 'electronic'
            ? "Failed to complete purchase. Please try again."
            : "Failed to pay commitment fee. Please try again.";
          toast.error(message);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="aspect-square bg-secondary/50 animate-pulse rounded-xl" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-secondary animate-pulse rounded" />
              <div className="h-6 w-1/3 bg-secondary animate-pulse rounded" />
              <div className="h-20 bg-secondary animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-semibold">Product not found</h2>
          <Link to="/marketplace">
            <Button variant="outline" className="mt-4">Back to Marketplace</Button>
          </Link>
        </div>
      </div>
    );
  }

  const allImages = product.thumbnail_url
    ? [product.thumbnail_url, ...product.images]
    : product.images.length > 0
    ? product.images
    : [];

  const specs = product.specifications || {};

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 flex items-center h-14 gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/marketplace")} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground font-mono">
            {categoryLabels[product.category]}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square rounded-xl border border-border bg-secondary/30 overflow-hidden relative">
              {allImages.length > 0 ? (
                <img
                  src={allImages[activeImage]}
                  alt={product.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">
                  {product.category === "real_estate" ? "🏠" : product.category === "automobile" ? "🚗" : "📱"}
                </div>
              )}
              {allImages.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage((prev) => Math.max(0, prev - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border"
                    disabled={activeImage === 0}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setActiveImage((prev) => Math.min(allImages.length - 1, prev + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border"
                    disabled={activeImage === allImages.length - 1}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              {product.featured && (
                <Badge className="absolute top-4 left-4 bg-accent text-accent-foreground">
                  <Star className="w-3 h-3 mr-1" /> Featured
                </Badge>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {allImages.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-20 h-20 rounded-lg border-2 overflow-hidden flex-shrink-0 transition-all ${
                      activeImage === i ? "border-accent" : "border-border opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              <Badge variant="outline" className="mb-3 font-mono text-xs">
                {categoryLabels[product.category]}
              </Badge>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                {product.title}
              </h1>
              {product.location && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                  <MapPin className="w-4 h-4" /> {product.location}
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
              <span className="text-3xl font-bold font-mono text-accent">
                {formatAmount(product.price)}
              </span>
            </div>

            {product.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {sanitizeMarketplaceText(product.description)}
                </p>
              </div>
            )}

            {productRiskScore > 0 && (
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-sm text-warning-foreground">
                <p className="font-medium">Risk Score</p>
                <p>
                  This listing has a marketplace risk score of <strong>{productRiskScore}</strong>.
                  {isRiskBlocked ? " It has been restricted from commerce until reviewed." : ""}
                </p>
              </div>
            )}

            {((product.specifications?.seller_documents?.length ?? 0) > 0 || (marketplaceDocuments?.length ?? 0) > 0) && (
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm">
                <p className="font-medium mb-2">Seller Documents</p>
                {canViewDocuments ? (
                  <div className="space-y-2">
                    {marketplaceDocuments?.length ? (
                      marketplaceDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => handleDocumentClick(doc.id)}
                          disabled={secureUrlLoading && activeDocumentId === doc.id}
                          className="block w-full text-left rounded-lg border border-border p-3 hover:border-accent/50 hover:bg-accent/5 disabled:opacity-50"
                        >
                          {doc.document_type}
                          {secureUrlLoading && activeDocumentId === doc.id && (
                            <span className="ml-2 text-xs">Generating secure link...</span>
                          )}
                        </button>
                      ))
                    ) : (
                      sellerDocuments.map((doc) => (
                        <a
                          key={doc.url}
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-lg border border-border p-3 hover:border-accent/50 hover:bg-accent/5"
                        >
                          {doc.name}
                        </a>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    Seller documents are available only to admins, the seller, and buyers with confirmed orders.
                  </p>
                )}
              </div>
            )}

            {product && (
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm">
                <p className="font-medium mb-2">Required Documents for this Category</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  {requiredDocuments.map((documentName) => (
                    <li key={documentName}>{documentName}</li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(specs).length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Specifications</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(specs).map(([key, value]) => {
                    let displayValue: React.ReactNode = String(value);
                    if (Array.isArray(value)) {
                      displayValue = (
                        <div className="flex flex-col gap-1 mt-1">
                          {value.map((item, i) => {
                            if (typeof item === 'object' && item !== null) {
                              if ('url' in item && ('name' in item || 'title' in item)) {
                                return (
                                  <a key={i} href={item.url} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate block">
                                    {item.name || item.title || 'Document'}
                                  </a>
                                );
                              }
                              return <span key={i} className="truncate block">{JSON.stringify(item)}</span>;
                            }
                            return <span key={i} className="truncate block">{String(item)}</span>;
                          })}
                        </div>
                      );
                    } else if (typeof value === 'object' && value !== null) {
                      displayValue = (
                        <div className="flex flex-col gap-1 mt-1">
                          {Object.entries(value).map(([k, v], i) => {
                            if (typeof v === 'string' && (v.startsWith('http') || v.startsWith('/'))) {
                              return (
                                <a key={i} href={v} target="_blank" rel="noreferrer" className="text-accent hover:underline truncate block" title={k}>
                                  {k}
                                </a>
                              );
                            }
                            return <span key={i} className="truncate block" title={String(v)}>{k}: {String(v)}</span>;
                          })}
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider">{key}</span>
                        <div className="font-medium mt-0.5">{displayValue}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            <div className="rounded-xl border border-border p-4 space-y-3 bg-secondary/5">
              <div className="grid gap-2 text-sm text-muted-foreground">
                {product?.category === 'electronic' ? (
                  <>
                    <p>
                      <strong>Buy Now:</strong> Immediate purchase - no commitment fee
                    </p>
                    <p>
                      Delivery period: <strong>1-3 days</strong> based on location
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      Commitment fee: <strong>{formatAmount(commitmentFee)}</strong> ({commitmentFeePercent}% of price)
                    </p>
                    <p>
                      Escrow funds are held for <strong>{escrowDays} days</strong> after purchase to allow verification and dispute resolution.
                    </p>
                  </>
                )}
                {profile?.kyc_status !== "approved" && (
                  <p className="text-warning-foreground">
                    KYC approval is required before you can commit to purchase.
                  </p>
                )}
                {!hasSufficientFunds && (
                  <p className="text-warning-foreground">
                    You need at least {formatAmount(product?.category === 'electronic' ? product.price : commitmentFee)} in wallet funds to proceed.
                  </p>
                )}
                {isRiskBlocked && (
                  <p className="text-warning-foreground">
                    This listing is currently blocked from purchase due to a high marketplace risk score.
                  </p>
                )}
              </div>

              <div title={!isKycApproved ? "KYC approval required to commit funds." : undefined}>
                <Button
                  size="lg"
                  className="w-full gap-2 text-base"
                  onClick={() => {
                    if (product.category === 'real_estate') {
                      setIsModalOpen(true);
                    } else {
                      handleCommitToPurchase();
                    }
                  }}
                  disabled={
                    commitToPurchase.isPending ||
                    product.stock_quantity < 1 ||
                    isRiskBlocked ||
                    !isAccountActive ||
                    !isKycApproved ||
                    walletsLoading ||
                    !hasSufficientFunds
                  }
                >
                  <ShoppingCart className="w-5 h-5" />
                  {product.stock_quantity < 1 
                    ? "Out of Stock" 
                    : product.category === 'electronic' 
                      ? "Buy Now" 
                      : "Commit to Purchase"
                  }
                </Button>
              </div>

              <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Real Estate Purchase Confirmation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p>IMPORTANT: By proceeding, you acknowledge that you are solely responsible for verifying property documents. We strongly encourage engaging a qualified legal practitioner and conducting independent land history checks/charting. The platform is not liable for buyer negligence.</p>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="due-diligence" checked={isChecked} onCheckedChange={setIsChecked} />
                      <label htmlFor="due-diligence" className="text-sm">I have conducted my due diligence or accept the risks.</label>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => { setIsModalOpen(false); setIsChecked(false); }}>Cancel</Button>
                    <Button onClick={() => { handleCommitToPurchase(); setIsModalOpen(false); setIsChecked(false); }} disabled={!isChecked}>Proceed</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                <Shield className="w-3 h-3" />
                Secure purchase · Admin-verified listing
              </div>
            </div>

            {order && (
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Order Status</h3>
                  <Badge
                    variant={
                      displayOrderStatus === "inspection" ? "default" :
                      displayOrderStatus === "disputed" ? "destructive" :
                      "secondary"
                    }
                  >
                    {displayOrderStatus}
                  </Badge>
                </div>

                <div className="grid gap-2 text-sm">
                  <p>Order #: <strong>{order.order_number}</strong></p>
                  {product?.category === 'electronic' ? (
                    <>
                      <p>Commitment Fee: <strong>{formatAmount(orderCommitmentFee)}</strong></p>
                      <p>Escrow/Total Amount: <strong>{formatAmount(orderTotalAmount)}</strong></p>
                    </>
                  ) : (
                    <>
                      <p>Commitment Fee Paid: <strong>{formatAmount(orderCommitmentFee)}</strong></p>
                      <p>Escrow Amount: <strong>{formatAmount(order.total_escrow_hold_amount || 0)}</strong></p>
                    </>
                  )}

                  {order.order_status === "inspection" && !order.is_escrow_paused && (
                    <p className="text-green-600">
                      Inspection window expires: <strong>
                        {new Date(JSON.parse(order.notes || '{}').inspection_window_expires_at).toLocaleDateString()}
                      </strong>
                    </p>
                  )}

                  {order.is_escrow_paused && (
                    <p className="text-destructive">
                      ⚠️ Escrow release paused due to dispute
                    </p>
                  )}

                  {order.dispute_opened_at && (
                    <p className="text-sm text-muted-foreground">
                      Dispute opened: {new Date(order.dispute_opened_at).toLocaleDateString()}
                    </p>
                  )}

                  {autoConfirmTriggered && (
                    <p className="text-sm text-foreground">
                      This order has been automatically confirmed after the inspection window expired.
                    </p>
                  )}
                </div>

                {order.order_status === "inspection" && !order.is_escrow_paused && order.order_status !== "disputed" && isWithinDisputeWindow && (
                  <div className="flex flex-col gap-3">
                    <DisputeDialog
                      orderId={order.id}
                      productTitle={product.title}
                    />
                    {canReleaseEscrow(order) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => confirmReceipt.mutate({ orderId: order.id })}
                        disabled={confirmReceipt.isPending}
                      >
                        {confirmReceipt.isPending ? "Confirming receipt..." : "Confirm receipt and release escrow"}
                      </Button>
                    )}
                  </div>
                )}

              </div>
              )}

              {order && (
                <div className="rounded-xl border border-border bg-secondary/10 p-4 space-y-2">
                  <h3 className="font-semibold">Transaction Receipt</h3>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><strong>Buyer:</strong> {profile?.full_name || user?.email}</p>
                    <p><strong>Seller Listing:</strong> {product.title}</p>
                    <p><strong>Item Description:</strong> {sanitizeMarketplaceText(product.description)}</p>
                    {product?.category === 'electronic' ? (
                      <>
                        <p><strong>Commitment Fee:</strong> $0.00</p>
                        <p><strong>Total Amount:</strong> {formatAmount(order.total_amount || 0)}</p>
                      </>
                    ) : (
                      <>
                        <p><strong>Commitment Fee:</strong> {formatAmount(JSON.parse(order.notes || '{}').commitment_fee || 0)}</p>
                        <p><strong>Escrow Hold Amount:</strong> {formatAmount(order.total_escrow_hold_amount || 0)}</p>
                      </>
                    )}
                    <p><strong>Commission Deducted:</strong> {formatAmount(JSON.parse(order.notes || '{}').commission_deducted || 0)}</p>
                    <p><strong>Transaction ID:</strong> {order.order_number}</p>
                    <p><strong>Date:</strong> {new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <div className="pt-4 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={downloadReceiptPdf}
                      disabled={!selectedReceipt || receiptsLoading || isDownloadingReceipt}
                    >
                      {isDownloadingReceipt ? "Downloading receipt..." : "Download Official Receipt"}
                    </Button>
                    {!selectedReceipt && !receiptsLoading && (
                      <p className="text-sm text-muted-foreground">Receipt snapshot is not yet available.</p>
                    )}
                  </div>
                </div>
              )}

              {isSeller && sellerDisputedOrder?.order_status === "disputed" && sellerDisputedOrder?.id && (
                <div className="rounded-xl border border-border p-4 space-y-4 bg-background">
                  <h3 className="font-semibold">Seller dispute response</h3>
                  <div className="grid gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button
                        variant={sellerResponseMode === "accept" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSellerResponseMode("accept")}
                      >
                        Accept claim
                      </Button>
                      <Button
                        variant={sellerResponseMode === "reject" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSellerResponseMode("reject")}
                      >
                        Defend listing
                      </Button>
                      <Button
                        variant={sellerResponseMode === "replacement" ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => setSellerResponseMode("replacement")}
                      >
                        Request replacement
                      </Button>
                    </div>
                    {(sellerResponseMode === "reject" || sellerResponseMode === "replacement") && (
                      <>
                        <div className="grid gap-2">
                          <Label htmlFor="seller-explanation">Seller explanation</Label>
                          <Textarea
                            id="seller-explanation"
                            value={sellerExplanation}
                            onChange={(event) => setSellerExplanation(event.target.value)}
                            placeholder={
                              sellerResponseMode === "replacement"
                                ? "Describe why a replacement is needed and any next steps for delivery."
                                : "Provide your response to the buyer's dispute"
                            }
                            className="min-h-[120px]"
                          />
                        </div>
                        {sellerResponseMode === "reject" && (
                          <div className="grid gap-2">
                            <Label htmlFor="seller-evidence-url">Evidence URL</Label>
                            <Input
                              id="seller-evidence-url"
                              value={sellerEvidenceUrl}
                              onChange={(event) => setSellerEvidenceUrl(event.target.value)}
                              placeholder="Link to supporting evidence, inspection report, or contract"
                            />
                          </div>
                        )}
                      </>
                    )}
                    <Button
                      variant="primary"
                      onClick={handleSellerResponse}
                      disabled={sellerDisputeResponseMutation.isPending}
                    >
                      {sellerDisputeResponseMutation.isPending ? "Submitting response..." : "Submit dispute response"}
                    </Button>

                    {sellerDisputeResponses?.length ? (
                      <div className="space-y-2">
                        <h4 className="font-medium">Previous responses</h4>
                        <div className="space-y-2">
                          {sellerDisputeResponses.map((response) => (
                            <div key={response.id} className="rounded-md border border-border p-3 bg-secondary/10">
                              <p className="text-sm"><strong>{response.is_accepted ? "Accepted" : "Rejected"}</strong> · {new Date(response.created_at).toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">{response.explanation}</p>
                              {response.evidence_url && (
                                <p className="text-sm">
                                  Evidence: <a className="underline text-primary" href={response.evidence_url} target="_blank" rel="noreferrer">Open link</a>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

            <div className="p-3 rounded-lg bg-secondary/30 border border-border text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Stock: {product.stock_quantity} available</p>
              <p>Listed on {new Date(product.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MarketplaceProductDetail;
