-- Add new wallet types to the enum
ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'prudent_saving';
ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'golden_saving';
ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'projects_saving';
ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'future_saving';
ALTER TYPE wallet_type ADD VALUE IF NOT EXISTS 'loans_saving';

-- Create cards table for card management
CREATE TABLE public.cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'virtual', -- 'virtual' or 'physical'
  card_number TEXT, -- last 4 digits only for display
  card_name TEXT NOT NULL DEFAULT 'My Card',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'frozen', 'cancelled'
  expires_at DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- RLS policies for cards
CREATE POLICY "Users can view own cards" 
ON public.cards 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create cards" 
ON public.cards 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cards" 
ON public.cards 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all cards" 
ON public.cards 
FOR SELECT 
USING (is_admin_or_staff(auth.uid()));

CREATE POLICY "Admins can update all cards" 
ON public.cards 
FOR UPDATE 
USING (is_admin_or_staff(auth.uid()));

-- Create transfers table for internal transfers
CREATE TABLE public.transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL,
  recipient_id UUID, -- NULL for wallet-to-wallet transfers
  from_wallet_type wallet_type NOT NULL,
  to_wallet_type wallet_type NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on transfers
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

-- RLS policies for transfers
CREATE POLICY "Users can view own transfers" 
ON public.transfers 
FOR SELECT 
USING (sender_id = auth.uid() OR recipient_id = auth.uid());

CREATE POLICY "Users can create transfers" 
ON public.transfers 
FOR INSERT 
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Admins can view all transfers" 
ON public.transfers 
FOR SELECT 
USING (is_admin_or_staff(auth.uid()));

-- Add trigger for cards updated_at
CREATE TRIGGER update_cards_updated_at
BEFORE UPDATE ON public.cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle wallet transfers
CREATE OR REPLACE FUNCTION public.process_wallet_transfer(
  p_from_wallet_type wallet_type,
  p_to_wallet_type wallet_type,
  p_amount NUMERIC,
  p_recipient_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_id UUID;
  v_from_balance NUMERIC;
  v_transfer_id UUID;
  v_actual_recipient UUID;
BEGIN
  v_sender_id := auth.uid();
  v_actual_recipient := COALESCE(p_recipient_id, v_sender_id);
  
  -- Check sender has sufficient balance
  SELECT balance INTO v_from_balance
  FROM wallets
  WHERE user_id = v_sender_id AND wallet_type = p_from_wallet_type
  FOR UPDATE;
  
  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Source wallet not found';
  END IF;
  
  IF v_from_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct from sender's wallet
  UPDATE wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE user_id = v_sender_id AND wallet_type = p_from_wallet_type;
  
  -- Add to recipient's wallet (same user for internal, different for P2P)
  UPDATE wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = v_actual_recipient AND wallet_type = p_to_wallet_type;
  
  -- If recipient wallet doesn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, wallet_type, balance)
    VALUES (v_actual_recipient, p_to_wallet_type, p_amount);
  END IF;
  
  -- Record the transfer
  INSERT INTO transfers (sender_id, recipient_id, from_wallet_type, to_wallet_type, amount, description)
  VALUES (v_sender_id, CASE WHEN p_recipient_id IS NOT NULL THEN p_recipient_id ELSE NULL END, p_from_wallet_type, p_to_wallet_type, p_amount, p_description)
  RETURNING id INTO v_transfer_id;
  
  -- Record transaction for sender
  INSERT INTO transactions (user_id, transaction_type, amount, description, status)
  VALUES (v_sender_id, 'withdrawal', p_amount, COALESCE(p_description, 'Transfer to ' || p_to_wallet_type::TEXT), 'completed');
  
  -- Record transaction for recipient if different
  IF p_recipient_id IS NOT NULL AND p_recipient_id != v_sender_id THEN
    INSERT INTO transactions (user_id, transaction_type, amount, description, status)
    VALUES (p_recipient_id, 'deposit', p_amount, 'Transfer received from user', 'completed');
  END IF;
  
  RETURN v_transfer_id;
END;
$$;