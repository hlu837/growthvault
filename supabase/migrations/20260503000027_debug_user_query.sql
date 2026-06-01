-- Debug query to check what user_id the ApplicationStatus component is looking for
-- This will help us understand why it's not finding the approved application

-- First, let's see all applications and their user_ids
SELECT 
    id,
    user_id,
    status,
    created_at,
    approved_at
FROM seller_applications 
ORDER BY created_at DESC;

-- Then check all users and their roles
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as user_role,
    created_at
FROM auth.users 
ORDER BY created_at DESC;
