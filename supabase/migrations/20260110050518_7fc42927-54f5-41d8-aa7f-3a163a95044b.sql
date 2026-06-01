-- Drop the insecure policy that allows users to insert their own transactions
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;