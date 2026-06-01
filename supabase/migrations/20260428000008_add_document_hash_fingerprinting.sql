-- Add digital fingerprinting for document deduplication (Section 14.3)
-- Generate SHA-256 hash to detect duplicate uploads

ALTER TABLE public.marketplace_documents
  ADD COLUMN file_hash TEXT;

-- Add unique constraint to prevent duplicate hashes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.conname = 'unique_file_hash'
      AND t.relname = 'marketplace_documents'
  ) THEN
    ALTER TABLE public.marketplace_documents
      ADD CONSTRAINT unique_file_hash UNIQUE (file_hash);
  END IF;
END;
$$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_documents_file_hash ON public.marketplace_documents(file_hash) WHERE file_hash IS NOT NULL;