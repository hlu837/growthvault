-- =============================================
-- MARKETPLACE SCHEMA
-- =============================================

-- Categories enum
CREATE TYPE public.marketplace_category AS ENUM ('real_estate', 'automobile', 'electronic');

-- Product status
CREATE TYPE public.product_status AS ENUM ('draft', 'pending_verification', 'active', 'sold', 'archived');

-- Order status
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded', 'inspection', 'pending_delivery', 'disputed');

-- Payment method
CREATE TYPE public.payment_method AS ENUM ('wallet', 'card');

-- =============================================
-- PRODUCTS TABLE
-- =============================================
CREATE TABLE public.marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category marketplace_category NOT NULL,
  price NUMERIC(15,2) NOT NULL CHECK (price > 0),
  currency TEXT DEFAULT 'USD',
  images TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  status product_status DEFAULT 'draft',
  stock_quantity INTEGER DEFAULT 1,
  specifications JSONB DEFAULT '{}',
  location TEXT,
  featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- ORDERS TABLE
-- =============================================
CREATE TABLE public.marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT 'ORD-' || LPAD(FLOOR(RANDOM() * 999999)::TEXT, 6, '0'),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE RESTRICT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  total_escrow_hold_amount NUMERIC(15,2) DEFAULT 0,
  payment_method payment_method NOT NULL,
  payment_status TEXT DEFAULT 'pending',
  order_status order_status DEFAULT 'pending',
  is_escrow_paused BOOLEAN DEFAULT false,
  shipping_address JSONB,
  notes TEXT,
  dispute_complaint_type TEXT,
  dispute_description TEXT,
  dispute_evidence_url TEXT,
  dispute_preferred_resolution TEXT,
  dispute_opened_at TIMESTAMPTZ,
  dispute_resolved_at TIMESTAMPTZ,
  dispute_resolution_notes TEXT,
  is_malicious BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- MESSAGES TABLE
-- =============================================
CREATE TABLE public.marketplace_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_flagged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- MARKETPLACE DOCUMENTS TABLE
-- =============================================
CREATE TYPE public.marketplace_document_type AS ENUM ('C of O', 'Logbook', 'ID');

CREATE TABLE public.marketplace_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  document_type public.marketplace_document_type NOT NULL,
  storage_path TEXT NOT NULL,
  file_hash TEXT, -- SHA-256 hash for duplicate detection
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint on file_hash to prevent duplicates
ALTER TABLE public.marketplace_documents
  ADD CONSTRAINT unique_file_hash UNIQUE (file_hash);

-- Index for faster hash lookups
CREATE INDEX idx_marketplace_documents_file_hash ON public.marketplace_documents(file_hash) WHERE file_hash IS NOT NULL;

-- =============================================
-- CART TABLE
-- =============================================
CREATE TABLE public.marketplace_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.marketplace_products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.marketplace_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_cart ENABLE ROW LEVEL SECURITY;

-- Products: anyone can view active products
CREATE POLICY "Anyone can view active products"
  ON public.marketplace_products FOR SELECT
  USING (status = 'active');

-- Products: admins can manage all products
CREATE POLICY "Admins can manage products"
  ON public.marketplace_products FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- Orders: users can view their own orders
CREATE POLICY "Users can view own orders"
  ON public.marketplace_orders FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Orders: users can create their own orders
CREATE POLICY "Users can create orders"
  ON public.marketplace_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND public.fn_marketplace_product_risk_score(product_id) <= 60
  );

-- Orders: users can update their own orders
CREATE POLICY "Users can update own orders"
  ON public.marketplace_orders FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  )
  WITH CHECK (
    user_id = auth.uid()
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
  );

-- Orders: admins can view and manage all orders
CREATE POLICY "Admins can manage all orders"
  ON public.marketplace_orders FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND public.fn_marketplace_product_risk_score(product_id) <= 60
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    AND (SELECT account_status FROM public.profiles WHERE id = auth.uid()) = 'active'
    AND public.fn_marketplace_product_risk_score(product_id) <= 60
  );

CREATE OR REPLACE FUNCTION public.fn_marketplace_product_risk_score(p_product_id UUID)
  RETURNS INTEGER
  LANGUAGE SQL
  STABLE
AS $$
  SELECT COALESCE((specifications ->> 'risk_score')::INT, 0)
  FROM public.marketplace_products
  WHERE id = p_product_id;
$$;

CREATE OR REPLACE FUNCTION public.fn_prevent_self_buying_marketplace_orders()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT created_by FROM public.marketplace_products WHERE id = NEW.product_id) = NEW.user_id THEN
    RAISE EXCEPTION 'Self-buying is strictly prohibited';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_buying_marketplace_orders_trigger ON public.marketplace_orders;
CREATE TRIGGER prevent_self_buying_marketplace_orders_trigger
  BEFORE INSERT OR UPDATE ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_self_buying_marketplace_orders();

CREATE OR REPLACE FUNCTION public.fn_marketplace_seller_confirmed_sales(p_seller_id UUID)
  RETURNS INTEGER
  LANGUAGE SQL
  STABLE
AS $$
  SELECT COUNT(*)
  FROM public.marketplace_orders mo
  JOIN public.marketplace_products mp ON mo.product_id = mp.id
  WHERE mp.created_by = p_seller_id
    AND mo.order_status = 'confirmed';
$$;

CREATE OR REPLACE FUNCTION public.fn_marketplace_veteran_auto_approve_listing()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
DECLARE
  seller_risk_score INTEGER;
  confirmed_sales_count INTEGER;
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid()::uuid;
  END IF;

  SELECT COALESCE(risk_score, 0)
  INTO seller_risk_score
  FROM public.profiles
  WHERE id = auth.uid()::uuid;

  IF seller_risk_score = 0 THEN
    confirmed_sales_count := public.fn_marketplace_seller_confirmed_sales(auth.uid()::uuid);

    IF confirmed_sales_count > 3 THEN
      NEW.status := 'active';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_veteran_auto_approve_listing_trigger ON public.marketplace_products;
CREATE TRIGGER marketplace_veteran_auto_approve_listing_trigger
  BEFORE INSERT ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_marketplace_veteran_auto_approve_listing();

-- Cart: users manage their own cart
CREATE POLICY "Users manage own cart"
  ON public.marketplace_cart FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================
-- PRICE FREEZE AFTER COMMITMENT (Section 14.4)
-- =============================================

CREATE OR REPLACE FUNCTION public.fn_prevent_price_update_after_commitment()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  -- Only check if price is actually being changed
  IF OLD.price != NEW.price THEN
    -- Check if there are any active orders for this product
    IF EXISTS (
      SELECT 1 FROM public.marketplace_orders
      WHERE product_id = NEW.id
      AND order_status != 'cancelled'
    ) THEN
      RAISE EXCEPTION 'Price cannot be changed after commitment fee is paid';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_price_update_after_commitment_trigger ON public.marketplace_products;
CREATE TRIGGER prevent_price_update_after_commitment_trigger
  BEFORE UPDATE ON public.marketplace_products
  FOR EACH ROW EXECUTE FUNCTION public.fn_prevent_price_update_after_commitment();

-- Marketplace documents: only admins and uploaders may access and manage documents
ALTER TABLE public.marketplace_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and uploader can access marketplace documents"
  ON public.marketplace_documents FOR ALL
  TO authenticated
  USING (
    uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    uploaded_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

-- RPC function to get secure signed URLs for marketplace documents
-- Only admins or buyers with confirmed orders can access documents
CREATE OR REPLACE FUNCTION public.get_secure_document_url(p_document_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document RECORD;
  v_is_authorized BOOLEAN := FALSE;
  v_signed_url TEXT;
BEGIN
  -- Get document details
  SELECT md.*, mp.created_by as seller_id
  INTO v_document
  FROM public.marketplace_documents md
  JOIN public.marketplace_products mp ON md.product_id = mp.id
  WHERE md.id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Document not found';
  END IF;

  -- Check if user is admin
  IF public.has_role(auth.uid(), 'admin') THEN
    v_is_authorized := TRUE;
  ELSE
    -- Check if user is the seller who uploaded the document
    IF v_document.uploaded_by = auth.uid() THEN
      v_is_authorized := TRUE;
    ELSE
      -- Check if user has a confirmed order for this product
      SELECT EXISTS(
        SELECT 1
        FROM public.marketplace_orders
        WHERE product_id = v_document.product_id
          AND user_id = auth.uid()
          AND payment_status = 'confirmed'
      ) INTO v_is_authorized;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: insufficient permissions';
  END IF;

  -- Generate signed URL with 15 minute expiry
  SELECT signed_url INTO v_signed_url
  FROM storage.create_signed_url(v_document.storage_path, 900); -- 900 seconds = 15 minutes

  RETURN v_signed_url;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_secure_document_url(UUID) TO authenticated;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_products_category ON public.marketplace_products(category);
CREATE INDEX idx_products_status ON public.marketplace_products(status);
CREATE INDEX idx_products_featured ON public.marketplace_products(featured) WHERE featured = true;
CREATE INDEX idx_orders_user ON public.marketplace_orders(user_id);
CREATE INDEX idx_cart_user ON public.marketplace_cart(user_id);
CREATE INDEX idx_messages_sender ON public.marketplace_messages(sender_id);
CREATE INDEX idx_messages_receiver ON public.marketplace_messages(receiver_id);

CREATE OR REPLACE VIEW public.v_marketplace_products_pending_review AS
SELECT
  id,
  title,
  description,
  category,
  price,
  currency,
  images,
  thumbnail_url,
  status,
  stock_quantity,
  specifications,
  location,
  featured,
  created_by,
  created_at,
  updated_at,
  COALESCE((specifications ->> 'risk_score')::INT, 0) AS risk_score
FROM public.marketplace_products
WHERE status = 'pending_verification'
   OR COALESCE((specifications ->> 'risk_score')::INT, 0) BETWEEN 31 AND 60;
