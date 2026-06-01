-- Set default kyc_status to 'unverified' for new profiles
ALTER TABLE profiles ALTER COLUMN kyc_status SET DEFAULT 'unverified';

-- Update existing profiles with null kyc_status to 'unverified'
UPDATE profiles SET kyc_status = 'unverified' WHERE kyc_status IS NULL;
