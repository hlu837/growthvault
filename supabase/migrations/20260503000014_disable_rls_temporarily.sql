-- Temporarily disable RLS for seller_applications to test admin access
ALTER TABLE seller_applications DISABLE ROW LEVEL SECURITY;

-- Grant full permissions to authenticated users
GRANT ALL ON seller_applications TO authenticated;
