-- Add 'seller' to the app_role enum type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t 
        JOIN pg_enum e ON t.oid = e.enumtypid 
        WHERE t.typname = 'app_role' AND e.enumlabel = 'seller'
    ) THEN
        ALTER TYPE public.app_role ADD VALUE 'seller';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        -- Safely ignore if it was added concurrently
        NULL;
END $$;
