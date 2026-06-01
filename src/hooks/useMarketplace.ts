import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type MarketplaceCategory = "real_estate" | "automobile" | "electronic";

const rpcCall = (fn: string, params?: Record<string, unknown>) => supabase.rpc(fn, params as any);

export interface MarketplaceDocument {
  name: string;
  url: string;
}

export interface MarketplaceProduct {
  id: string;
  title: string;
  description: string | null;
  category: MarketplaceCategory;
  price: number;
  currency: string;
  images: string[];
  thumbnail_url: string | null;
  status: string;
  stock_quantity: number;
  specifications: Record<string, any>;
  location: string | null;
  featured: boolean;
  created_by: string | null;
  created_at: string;
  risk_score?: number;
  vin_number?: string | null;
  serial_number?: string | null;
}

export interface MarketplaceDocument {
  id: string;
  product_id: string;
  document_type: "C of O" | "Logbook" | "ID";
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: MarketplaceProduct;
}

export interface MarketplaceReceipt {
  id: string;
  receipt_number: string;
  order_id: string;
  user_id: string;
  receipt_type: "commitment_fee" | "final_release" | "refund";
  receipt_title: string;
  amount: number;
  currency: string;
  receipt_data: Record<string, any>;
  pdf_url?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface MarketplaceSettings {
  commitmentFeePercent: number;
  riskBlockThreshold: number;
  inspectionDaysByCategory: Record<MarketplaceCategory, number>;
}

export const categoryLabels: Record<MarketplaceCategory, string> = {
  real_estate: "Real Estate",
  automobile: "Automobile",
  electronic: "Electronic",
};

export const categoryIcons: Record<MarketplaceCategory, string> = {
  real_estate: "🏠",
  automobile: "🚗",
  electronic: "📱",
};

const externalContactPattern = /(?:\+?\d[\d\s\-().]{6,}\d|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?:https?:\/\/|www\.)\S+)/gi;

export const sanitizeMarketplaceText = (text: string | null | undefined) => {
  if (!text) return "";
  return String(text).replace(externalContactPattern, "[redacted]");
};

export const containsExternalContactInfo = (text: string | null | undefined) => {
  if (!text) return false;
  return externalContactPattern.test(String(text));
};

export const generateReceiptNumber = () => {
  const year = new Date().getFullYear();
  const suffix = `${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
  return `RCP-${year}-${suffix}`;
};

export const buildCommitmentReceiptPayload = ({
  order,
  userId,
  product,
  quantity,
  commitmentFeeAmount,
  escrowHoldAmount,
  paymentMethod,
  feePercent,
}: {
  order: any;
  userId: string;
  product: MarketplaceProduct;
  quantity: number;
  commitmentFeeAmount: number;
  escrowHoldAmount: number;
  paymentMethod: string;
  feePercent: number;
}) => ({
  receipt_number: generateReceiptNumber(),
  order_id: order.id,
  user_id: userId,
  receipt_type: "commitment_fee",
  receipt_title: "Commitment Fee Receipt",
  amount: commitmentFeeAmount,
  currency: product.currency,
  receipt_data: {
    order_number: order.order_number,
    product_title: product.title,
    unit_price: Number(product.price),
    quantity,
    total_price: Number(product.price) * quantity,
    fee_percent: feePercent,
    commitment_fee: commitmentFeeAmount,
    commission_deducted: commitmentFeeAmount,
    escrow_amount: escrowHoldAmount,
    payment_method: paymentMethod,
    order_status: order.order_status,
    created_at: order.created_at || new Date().toISOString(),
  },
  created_at: new Date().toISOString(),
});

export const createCommitmentReceipt = async ({
  order,
  userId,
  product,
  quantity,
  commitmentFeeAmount,
  escrowHoldAmount,
  paymentMethod,
  feePercent,
}: {
  order: any;
  userId: string;
  product: MarketplaceProduct;
  quantity: number;
  commitmentFeeAmount: number;
  escrowHoldAmount: number;
  paymentMethod: string;
  feePercent: number;
}) => {
  const receiptPayload = buildCommitmentReceiptPayload({
    order,
    userId,
    product,
    quantity,
    commitmentFeeAmount,
    escrowHoldAmount,
    paymentMethod,
  });

  const { error } = await supabase.from("receipts").insert(receiptPayload);
  if (error) throw error;
};

export const getProductRiskScore = (product: MarketplaceProduct) => {
  if (typeof product.risk_score === "number") return product.risk_score;
  const fallback = product.specifications?.risk_score;
  return typeof fallback === "number" ? fallback : 0;
};

export const getEscrowReleaseDays = (category: MarketplaceCategory, location?: string): number => {
  switch (category) {
    case "real_estate":
      return 7;
    case "automobile":
      return 3;
    case "electronic":
      // Location-based delivery for Electronics
      if (!location) return 1;
      
      const normalizedLocation = location.toLowerCase();
      
      // Same city/region - 1 day
      if (normalizedLocation.includes('same') || normalizedLocation.includes('local')) {
        return 1;
      }
      
      // Major cities - 2-3 days
      const majorCities = ['new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 
                          'san antonio', 'san diego', 'dallas', 'san jose', 'austin', 'jacksonville',
                          'fort worth', 'columbus', 'charlotte', 'san francisco', 'indianapolis',
                          'seattle', 'denver', 'washington', 'boston', 'el paso', 'nashville',
                          'detroit', 'portland', 'memphis', 'oklahoma city', 'las vegas',
                          'louisville', 'milwaukee', 'albuquerque', 'tucson', 'fresno',
                          'sacramento', 'kansas city', 'mesa', 'atlanta', 'omaha',
                          'colorado springs', 'raleigh', 'miami', 'long beach', 'virginia beach',
                          'oakland', 'minneapolis', 'tampa', 'tulsa', 'arlington',
                          'new orleans', 'wichita', 'baltimore', 'london', 'paris',
                          'tokyo', 'singapore', 'dubai', 'sydney', 'hong kong',
                          'toronto', 'berlin', 'amsterdam', 'brussels', 'madrid',
                          'rome', 'barcelona', 'munich', 'vienna', 'prague'];
      
      if (majorCities.some(city => normalizedLocation.includes(city))) {
        return 3;
      }
      
      // Domestic but not major city - 3-5 days
      if (normalizedLocation.includes('usa') || normalizedLocation.includes('united states') ||
          normalizedLocation.includes('uk') || normalizedLocation.includes('united kingdom')) {
        return 5;
      }
      
      // International - 7-14 days
      return 14;
    default:
      return 3;
  }
};

export const getRequiredDocumentsForCategory = (category: MarketplaceCategory) => {
  switch (category) {
    case "real_estate":
      return [
        "Certificate of Occupancy (C of O)",
        "Deed of Assignment",
        "Survey Plan",
        "Ownership Authorization",
      ];
    case "automobile":
      return [
        "Vehicle Registration",
        "Proof of Ownership",
        "VIN Number",
        "Inspection Report",
      ];
    case "electronic":
      return [
        "Purchase Receipt",
        "Serial Number",
        "Warranty (if applicable)",
      ];
    default:
      return ["Valid proof of ownership"];
  }
};

export const captureTransactionMetadata = async () => {
  const metadata: Record<string, string | null> = {
    captured_at: new Date().toISOString(),
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
    platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
    language: typeof navigator !== "undefined" ? navigator.language : "unknown",
    ip_address: null,
  };

  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    if (data?.ip) {
      metadata.ip_address = data.ip;
    }
  } catch {
    metadata.ip_address = null;
  }

  return metadata;
};

export const useMarketplaceSettings = () => {
  return useQuery({
    queryKey: ["marketplaceSettings"],
    queryFn: async () => {
      const platformQuery = await supabase
        .from("platform_settings")
        .select("setting_key, setting_value, description")
        .like("setting_key", "marketplace_%");

      let platformData = platformQuery.data;
      let platformError = platformQuery.error;

      if (platformError) {
        const { data: rpcData, error: rpcError } = await rpcCall("get_marketplace_settings");
        if (rpcError) throw rpcError;
        platformData = rpcData;
      }

      const { data: systemData, error: systemError } = await supabase
        .from("system_settings")
        .select("setting_key, setting_value")
        .eq("setting_key", "marketplace_risk_block_threshold");
      if (systemError) throw systemError;

      const defaults: MarketplaceSettings = {
        commitmentFeePercent: 10,
        riskBlockThreshold: 61,
        inspectionDaysByCategory: {
          real_estate: 7,
          automobile: 3,
          electronic: 1,
        },
      };

      (platformData || []).forEach((row) => {
        if (row.setting_key === "marketplace_commission_rate") {
          defaults.commitmentFeePercent = Math.max(Number(row.setting_value) || 10, 10);
        }
        if (row.setting_key === "marketplace_inspection_days_electronic") {
          defaults.inspectionDaysByCategory.electronic = Number(row.setting_value) || defaults.inspectionDaysByCategory.electronic;
        }
        if (row.setting_key === "marketplace_inspection_days_automobile") {
          defaults.inspectionDaysByCategory.automobile = Number(row.setting_value) || defaults.inspectionDaysByCategory.automobile;
        }
        if (row.setting_key === "marketplace_inspection_days_real_estate") {
          defaults.inspectionDaysByCategory.real_estate = Number(row.setting_value) || defaults.inspectionDaysByCategory.real_estate;
        }
      });

      (systemData || []).forEach((row) => {
        if (row.setting_key === "marketplace_risk_block_threshold") {
          defaults.riskBlockThreshold = Number(row.setting_value) || defaults.riskBlockThreshold;
        }
      });

      return defaults;
    },
  });
};

export const useListingFee = (category: MarketplaceCategory) => {
  return useQuery({
    queryKey: ["listingFee", category],
    queryFn: async () => {
      const { data, error } = await rpcCall("get_listing_fee", { p_category: category });
      if (error) throw error;
      return data as number;
    },
    enabled: !!category && (category === 'real_estate' || category === 'automobile'),
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
};

export const usePayListingFee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, paymentMethod }: { productId: string; paymentMethod?: string }) => {
      const { data, error } = await rpcCall("pay_listing_fee", {
        p_product_id: productId,
        p_payment_method: paymentMethod || "wallet"
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaceProducts"] });
      queryClient.invalidateQueries({ queryKey: ["listingFees"] });
    },
  });
};

export const useRefundListingFee = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ productId, reason }: { productId: string; reason?: string }) => {
      const { data, error } = await rpcCall("refund_listing_fee", {
        p_product_id: productId,
        p_reason: reason
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["listingFees"] });
    },
  });
};

export const useListingFees = (productId?: string) => {
  return useQuery({
    queryKey: ["listingFees", productId],
    queryFn: async () => {
      let query = supabase.from("listing_fees").select("*");
      
      if (productId) {
        query = query.eq("product_id", productId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });
};

export const useCommissionRate = (sellerId?: string, category?: MarketplaceCategory) => {
  return useQuery({
    queryKey: ["commissionRate", sellerId, category],
    queryFn: async () => {
      if (!sellerId || !category) return null;
      const { data, error } = await rpcCall("get_commission_rate", {
        p_seller_id: sellerId,
        p_category: category
      });
      if (error) throw error;
      return data as number;
    },
    enabled: !!sellerId && !!category,
  });
};

export const useCommissionTransactions = (sellerId?: string, orderId?: string) => {
  return useQuery({
    queryKey: ["commissionTransactions", sellerId, orderId],
    queryFn: async () => {
      let query = supabase.from("commission_transactions").select("*");
      
      if (sellerId) {
        query = query.eq("seller_id", sellerId);
      }
      if (orderId) {
        query = query.eq("order_id", orderId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!sellerId || !!orderId,
  });
};

export const useCalculateCommission = () => {
  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await rpcCall("calculate_and_deduct_commission", {
        p_order_id: orderId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Commission calculated and deducted successfully" });
      queryClient.invalidateQueries({ queryKey: ["commissionTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["marketplaceOrders"] });
    },
    onError: (error: Error) => {
      toast({ title: "Commission calculation failed", description: error.message, variant: "destructive" });
    },
  });
};

const filterBlockedProducts = (
  products: MarketplaceProduct[],
  riskThreshold: number
) => {
  return products.filter((product) => getProductRiskScore(product) < riskThreshold);
};

export const useMarketplaceProducts = (
  category?: MarketplaceCategory,
  riskThreshold = 61
) => {
  return useQuery({
    queryKey: ["marketplace-products", category, riskThreshold],
    queryFn: async () => {
      let query = supabase
        .from("marketplace_products" as any)
        .select("*")
        .eq("status", "active")
        .order("featured", { ascending: false })
        .order("created_at", { ascending: false });

      if (category) {
        query = query.eq("category", category);
      }

      const { data, error } = await query;
      if (error) throw error;

      const products = (data || []) as unknown as MarketplaceProduct[];
      return filterBlockedProducts(products, riskThreshold);
    },
  });
};

export const useMarketplaceProduct = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["marketplace-product", productId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("marketplace_products" as any)
        .select("*")
        .eq("id", productId!)
        .single() as any);
      if (error) throw error;
      return data as unknown as MarketplaceProduct;
    },
    enabled: !!productId,
  });
};

export const useMarketplaceProductDocuments = (
  productId: string | undefined,
  enabled = true
) => {
  return useQuery({
    queryKey: ["marketplace-product-documents", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_documents")
        .select("*")
        .eq("product_id", productId!);
      if (error) throw error;
      return (data || []) as MarketplaceDocument[];
    },
    enabled: !!productId && enabled,
  });
};

export const useSecureDocumentUrl = (documentId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: ["secure-document-url", documentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_secure_document_url", {
        p_document_id: documentId,
      });
      if (error) throw error;
      return data as string;
    },
    enabled: !!documentId && enabled,
  });
};

export const useCart = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["marketplace-cart", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("marketplace_cart" as any)
        .select("*")
        .eq("user_id", user!.id) as any);
      if (error) throw error;

      const items = data as unknown as CartItem[];
      if (items.length === 0) return [];

      const productIds = items.map((i) => i.product_id);
      const { data: products } = await (supabase
        .from("marketplace_products" as any)
        .select("*")
        .in("id", productIds) as any);

      return items.map((item) => ({
        ...item,
        product: (products as unknown as MarketplaceProduct[])?.find(
          (p) => p.id === item.product_id
        ),
      }));
    },
    enabled: !!user,
  });
};

export const useRemoveFromCart = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cartItemId: string) => {
      if (!user) {
        throw new Error("Authentication is required to remove cart items");
      }

      const { error } = await supabase
        .from("marketplace_cart")
        .delete()
        .eq("id", cartItemId)
        .eq("user_id", user.id);

      if (error) throw error;
      return cartItemId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-cart"] });
    },
  });
};

export const useCommitToPurchase = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      product,
      quantity = 1,
      paymentMethod = "wallet",
      feePercent = 10,
      inspectionDays,
      metadata,
    }: {
      product: MarketplaceProduct;
      quantity?: number;
      paymentMethod?: string;
      feePercent: number;
      inspectionDays?: number;
      metadata?: Record<string, any>;
    }) => {
      if (!user) {
        throw new Error("Authentication is required to commit to purchase");
      }

      const totalProductAmount = Number(product.price) * quantity;
      // No commitment fee for Electronics category - Buy Now
      const commitmentFeeAmount = product.category === 'electronic' ? 0 : totalProductAmount * (feePercent / 100);
      const escrowHoldAmount = product.category === 'electronic' ? 0 : totalProductAmount - commitmentFeeAmount;
      const escrowReleaseDays = inspectionDays ?? getEscrowReleaseDays(product.category);
      const inspectionStartedAt = new Date().toISOString();
      const inspectionExpiresAt = new Date(
        Date.now() + escrowReleaseDays * 24 * 60 * 60 * 1000
      ).toISOString();
      
      // Electronics use direct sale, others use escrow
      const isElectronics = product.category === 'electronic';
      const orderPayload = {
        user_id: user.id,
        product_id: product.id,
        quantity,
        unit_price: product.price,
        total_amount: totalProductAmount,
        total_escrow_hold_amount: escrowHoldAmount,
        payment_method: paymentMethod,
        payment_status: isElectronics ? "paid" : "fee_paid",
        order_status: isElectronics ? "confirmed" : "inspection",
        notes: JSON.stringify({
          commitment_fee: commitmentFeeAmount,
          commitment_fee_percent: feePercent,
          commission_deducted: commitmentFeeAmount,
          escrow_amount: escrowHoldAmount,
          escrow_status: isElectronics ? "direct_sale" : "pending_escrow",
          escrow_release_days: escrowReleaseDays,
          inspection_window_started_at: isElectronics ? null : inspectionStartedAt,
          inspection_window_expires_at: isElectronics ? null : inspectionExpiresAt,
          transaction_metadata: metadata,
          digital_signature_captured: true,
          created_at: inspectionStartedAt,
        }),
      };

      const { data, error } = await supabase
        .from("marketplace_orders")
        .insert(orderPayload)
        .select()
        .single();

      if (error) throw error;

      // Only create commitment receipt for non-electronic products
      if (!isElectronics) {
        await createCommitmentReceipt({
          order: data,
          userId: user.id,
          product,
          quantity,
          commitmentFeeAmount,
          escrowHoldAmount,
          paymentMethod,
          feePercent,
        });

        const { error: feeError } = await supabase.from("platform_fees").insert({
          user_id: user.id,
          amount: commitmentFeeAmount,
          fee_type: "marketplace_commitment_fee",
          description: `Non-refundable commitment fee for ${product.title}`,
          created_at: new Date().toISOString(),
          vault_id: null,
        });

        if (feeError) throw feeError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-cart"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    },
  });
};

export const useCommitCartPurchase = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      cartItems,
      paymentMethod = "wallet",
      feePercent = 10,
      metadata,
    }: {
      cartItems: CartItem[];
      paymentMethod?: string;
      feePercent: number;
      metadata?: Record<string, any>;
    }) => {
      if (!user) {
        throw new Error("Authentication is required to commit to purchase");
      }

      const inspectionStartedAt = new Date().toISOString();
      const orders = cartItems.map((item) => {
        const price = Number(item.product?.price || 0);
        const totalItemAmount = price * item.quantity;
        const isElectronics = item.product?.category === 'electronic';
        const commitmentFeeAmount = isElectronics ? 0 : totalItemAmount * (feePercent / 100);
        const escrowHoldAmount = isElectronics ? totalItemAmount : totalItemAmount - commitmentFeeAmount;
        const escrowReleaseDays = getEscrowReleaseDays(item.product?.category as MarketplaceCategory);
        const inspectionExpiresAt = new Date(
          Date.now() + escrowReleaseDays * 24 * 60 * 60 * 1000
        ).toISOString();
        return {
          user_id: user.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: price,
          total_amount: totalItemAmount,
          total_escrow_hold_amount: escrowHoldAmount,
          payment_method: paymentMethod,
          payment_status: isElectronics ? "paid" : "fee_paid",
          order_status: isElectronics ? "confirmed" : "inspection",
          notes: JSON.stringify({
            commitment_fee: commitmentFeeAmount,
            commitment_fee_percent: feePercent,
            commission_deducted: commitmentFeeAmount,
            escrow_amount: escrowHoldAmount,
            escrow_status: isElectronics ? "direct_sale" : "pending_escrow",
            escrow_release_days: escrowReleaseDays,
            inspection_window_started_at: isElectronics ? null : inspectionStartedAt,
            inspection_window_expires_at: isElectronics ? null : inspectionExpiresAt,
            transaction_metadata: metadata,
            digital_signature_captured: true,
            created_at: inspectionStartedAt,
          }),
        };
      });

      const totalCommission = orders.reduce(
        (sum, order) => sum + Number(JSON.parse(order.notes).commitment_fee),
        0
      );

      const { data: insertedOrders, error: orderError } = await supabase
        .from("marketplace_orders")
        .insert(orders)
        .select();
      if (orderError) throw orderError;

      if (insertedOrders && Array.isArray(insertedOrders)) {
        // Only create commitment receipts for non-electronic products
        const nonElectronicOrders = insertedOrders.filter((order: any, index: number) => 
          cartItems[index].product?.category !== 'electronic'
        );
        
        if (nonElectronicOrders.length > 0) {
          await Promise.all(
            nonElectronicOrders.map((insertedOrder: any, index: number) => {
              const originalIndex = insertedOrders.indexOf(insertedOrder);
              return createCommitmentReceipt({
                order: insertedOrder,
                userId: user.id,
                product: cartItems[originalIndex].product as MarketplaceProduct,
                quantity: cartItems[originalIndex].quantity,
                commitmentFeeAmount: Number(JSON.parse(orders[originalIndex].notes).commitment_fee),
                escrowHoldAmount: Number(JSON.parse(orders[originalIndex].notes).escrow_amount),
                paymentMethod,
                feePercent: feePercent,
              });
            })
          );
        }
      }

      // Only charge platform fees for non-electronic products
      if (totalCommission > 0) {
        const { error: feeError } = await supabase.from("platform_fees").insert({
          user_id: user.id,
          amount: totalCommission,
          fee_type: "marketplace_commitment_fee",
          description: "Non-refundable commitment fee for marketplace cart items",
          created_at: new Date().toISOString(),
          vault_id: null,
        });

        if (feeError) throw feeError;
      }

      const { error: deleteError } = await supabase
        .from("marketplace_cart")
        .delete()
        .eq("user_id", user.id);

      if (deleteError) throw deleteError;

      return orders;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-cart"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
    },
  });
};

export const useOpenDispute = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      complaintType,
      preferredResolution,
      description,
      evidenceUrl,
    }: {
      orderId: string;
      complaintType: string;
      preferredResolution: string;
      description: string;
      evidenceUrl?: string;
    }) => {
      if (!user) {
        throw new Error("Authentication is required to open a dispute");
      }

      const { data, error } = await supabase
        .from("marketplace_orders")
        .update({
          order_status: "disputed",
          is_escrow_paused: true,
          dispute_complaint_type: complaintType,
          dispute_preferred_resolution: preferredResolution,
          dispute_description: description,
          dispute_evidence_url: evidenceUrl,
          dispute_opened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-user-order"] });
    },
  });
};

export const useConfirmReceipt = () => {
  const { user, session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      if (!user) {
        throw new Error("Authentication is required to confirm receipt");
      }

      const { data: existingOrder, error: fetchError } = await supabase
        .from("marketplace_orders")
        .select("notes")
        .eq("id", orderId)
        .eq("user_id", user.id)
        .single();

      if (fetchError) throw fetchError;

      let notes = {} as any;
      try {
        notes = existingOrder?.notes ? JSON.parse(existingOrder.notes) : {};
      } catch {
        notes = {};
      }

      const updatedNotes = {
        ...notes,
        transaction_metadata: {
          ...(notes?.transaction_metadata || {}),
          session_id: session?.id ?? null,
          confirmed_at: new Date().toISOString(),
        },
      };

      const { data, error } = await supabase
        .from("marketplace_orders")
        .update({
          order_status: "confirmed",
          payment_status: "confirmed",
          is_escrow_paused: false,
          notes: JSON.stringify(updatedNotes),
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-user-order"] });
    },
  });
};

export const useAdminRefund = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId }: { orderId: string }) => {
      if (!user) {
        throw new Error("Authentication is required to process refunds");
      }

      const { data, error } = await supabase
        .from("marketplace_orders")
        .update({
          order_status: "refunded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .select("id, total_escrow_hold_amount")
        .single();

      if (error) throw error;

      return {
        orderId,
        refundable_amount: Number(data?.total_escrow_hold_amount ?? 0),
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-user-order"] });
      queryClient.invalidateQueries({ queryKey: ["dispute-responses"] });
    },
  });
};

export const useSellerDisputeResponse = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      explanation,
      evidenceUrl,
      responseType,
    }: {
      orderId: string;
      explanation: string;
      evidenceUrl: string;
      responseType: "accept" | "reject" | "replacement";
    }) => {
      if (!user) {
        throw new Error("Authentication is required to respond to disputes");
      }

      const { error: insertError } = await supabase
        .from("dispute_responses")
        .insert({
          dispute_id: orderId,
          responder_id: user.id,
          explanation,
          evidence_url: evidenceUrl,
          is_accepted: responseType === "accept",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertError) throw insertError;

      if (responseType === "accept") {
        const { error: updateError } = await supabase
          .from("marketplace_orders")
          .update({
            order_status: "refunded",
            is_escrow_paused: false,
            dispute_resolved_at: new Date().toISOString(),
            dispute_resolution_notes: "Seller accepted dispute and auto-refund initiated",
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);

        if (updateError) throw updateError;
      }

      if (responseType === "replacement") {
        const { data: orderData, error: fetchError } = await supabase
          .from("marketplace_orders")
          .select("notes")
          .eq("id", orderId)
          .single();

        if (fetchError) throw fetchError;

        let notes = {} as any;
        try {
          notes = orderData?.notes ? JSON.parse(orderData.notes) : {};
        } catch {
          notes = {};
        }

        const replacementDays = Number(notes?.escrow_release_days) || 30;
        const inspectionStartedAt = new Date().toISOString();
        const inspectionExpiresAt = new Date(
          Date.now() + replacementDays * 24 * 60 * 60 * 1000
        ).toISOString();

        const updatedNotes = {
          ...notes,
          inspection_window_started_at: inspectionStartedAt,
          inspection_window_expires_at: inspectionExpiresAt,
          escrow_status: "replacement_pending_delivery",
          updated_at: inspectionStartedAt,
        };

        const { error: updateError } = await supabase
          .from("marketplace_orders")
          .update({
            order_status: "pending_delivery",
          is_escrow_paused: true,
          })
          .eq("id", orderId);

        if (updateError) throw updateError;
      }

      return { orderId, responseType };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["marketplace-user-order"] });
      queryClient.invalidateQueries({ queryKey: ["dispute-responses"] });
    },
  });
};

export const useDisputeResponses = (orderId?: string) => {
  return useQuery({
    queryKey: ["dispute-responses", orderId],
    queryFn: async () => {
      if (!orderId) return [];
      const { data, error } = await supabase
        .from("dispute_responses")
        .select(`*, responder:responder_id(full_name, email)`)
        .eq("dispute_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });
};

export const useOrderReceipts = (orderId?: string) => {
  return useQuery({
    queryKey: ["marketplace-receipts", orderId],
    queryFn: async () => {
      if (!orderId) return [] as MarketplaceReceipt[];
      const { data, error } = await supabase
        .from<MarketplaceReceipt>("receipts")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });
};

export const useSellerDisputeOrder = (productId: string | undefined) => {
  return useQuery({
    queryKey: ["marketplace-seller-dispute-order", productId],
    queryFn: async () => {
      if (!productId) return null;
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select("*")
        .eq("product_id", productId)
        .eq("order_status", "disputed")
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data as any[])[0] ?? null;
    },
    enabled: !!productId,
  });
};

export const canReleaseEscrow = (order: any) => {
  if (!order) return false;

  // Check if escrow is paused due to dispute
  if (order.is_escrow_paused) return false;

  // Check if inspection window has expired
  const inspectionExpiresAt = order.notes ? JSON.parse(order.notes)?.inspection_window_expires_at : null;
  if (!inspectionExpiresAt) return false;

  const now = new Date();
  const expiresAt = new Date(inspectionExpiresAt);
  return now >= expiresAt;
};

export const getEscrowStatus = (order: any) => {
  if (!order) return "unknown";

  if (order.is_escrow_paused) return "paused";

  const inspectionExpiresAt = order.notes ? JSON.parse(order.notes)?.inspection_window_expires_at : null;
  if (!inspectionExpiresAt) return "pending";

  const now = new Date();
  const expiresAt = new Date(inspectionExpiresAt);

  if (now >= expiresAt) return "ready_for_release";
  return "pending";
};

export const useUserMarketplaceOrder = (productId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["marketplace-user-order", user?.id, productId],
    queryFn: async () => {
      if (!user || !productId) return null;
      const { data, error } = await supabase
        .from("marketplace_orders")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data as unknown as any[])[0] ?? null;
    },
    enabled: !!user && !!productId,
  });
};

export const useFeaturedProducts = () => {
  return useQuery({
    queryKey: ["marketplace-featured"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("marketplace_products" as any)
        .select("*")
        .eq("status", "active")
        .eq("featured", true)
        .limit(6) as any);
      if (error) throw error;
      return (data || []) as unknown as MarketplaceProduct[];
    },
  });
};

export const useAdminBreachRefund = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      if (!user) {
        throw new Error("Authentication required");
      }

      const { data, error } = await supabase.rpc('admin_process_breach_refund', {
        order_id_param: orderId,
        admin_id_param: user.id
      });

      if (error) throw error;

      const result = data as any;
      if (!result.success) {
        throw new Error(result.message || 'Breach refund failed');
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplace-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-platform-revenue"] });
    },
  });
};
