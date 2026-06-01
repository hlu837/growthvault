-- Add deposit_type column to deposits table to distinguish between investment deposits and general deposits
ALTER TABLE public.deposits
ADD COLUMN deposit_type TEXT NOT NULL DEFAULT 'investment' CHECK (deposit_type IN ('investment', 'general'));

-- Update existing deposits to be investment type (they were all investment deposits before)
UPDATE public.deposits SET deposit_type = 'investment' WHERE deposit_type IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.deposits.deposit_type IS 'Type of deposit: investment (goes to MLM/Trading wallets) or general (goes to Main Wallet/Vault)';