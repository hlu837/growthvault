-- System settings table for configurable parameters (ROI rate, split percentage)
CREATE TABLE public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value DECIMAL NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert default settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
  ('roi_rate', 15.00, 'Monthly ROI percentage for investments'),
  ('mlm_split', 50.00, 'Percentage of investment going to MLM capital'),
  ('trading_split', 50.00, 'Percentage of investment going to trading principal');

-- Enable RLS - Only admins can modify
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view settings"
  ON public.system_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update settings"
  ON public.system_settings FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Support tickets table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id),
  response TEXT,
  responded_by UUID REFERENCES auth.users(id),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view all tickets"
  ON public.support_tickets FOR SELECT
  TO authenticated
  USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff can update tickets"
  ON public.support_tickets FOR UPDATE
  TO authenticated
  USING (is_admin_or_staff(auth.uid()));

-- Deposits table for manual verification
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  proof_url TEXT, -- Screenshot/receipt URL stored in Supabase Storage
  bank_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deposits"
  ON public.deposits FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create deposits"
  ON public.deposits FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Staff can view all deposits"
  ON public.deposits FOR SELECT
  TO authenticated
  USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Staff can update deposits"
  ON public.deposits FOR UPDATE
  TO authenticated
  USING (is_admin_or_staff(auth.uid()));

-- Withdrawals table (separate from transactions for approval workflow)
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL NOT NULL,
  wallet_type wallet_type NOT NULL,
  bank_details JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processed')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals"
  ON public.withdrawals FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create withdrawals"
  ON public.withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all withdrawals"
  ON public.withdrawals FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update withdrawals"
  ON public.withdrawals FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Add triggers for updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for deposit proofs
INSERT INTO storage.buckets (id, name, public) VALUES ('deposit-proofs', 'deposit-proofs', false);

-- Storage policies for deposit proofs
CREATE POLICY "Users can upload own deposit proofs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own deposit proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'deposit-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Staff can view all deposit proofs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'deposit-proofs' AND is_admin_or_staff(auth.uid()));