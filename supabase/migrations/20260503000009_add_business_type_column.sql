-- Add the missing business_type column
ALTER TABLE seller_applications 
ADD COLUMN IF NOT EXISTS business_type TEXT;
