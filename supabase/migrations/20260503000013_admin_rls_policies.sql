-- Add admin RLS policies for seller_applications table
-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own applications" ON seller_applications;
DROP POLICY IF EXISTS "Users can insert own applications" ON seller_applications;
DROP POLICY IF EXISTS "Users can update own applications" ON seller_applications;

-- Create new policies that allow admins to see all applications
CREATE POLICY "Admins can view all applications" ON seller_applications
FOR SELECT USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "Users can insert own applications" ON seller_applications
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update all applications" ON seller_applications
FOR UPDATE USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM auth.users 
    WHERE auth.users.id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- Grant necessary permissions
GRANT ALL ON seller_applications TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
