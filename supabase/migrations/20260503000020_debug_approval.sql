-- Debug query to check if applications are actually being approved
SELECT 
    id,
    user_id,
    status,
    rejection_reason,
    approved_at,
    approved_by,
    created_at,
    updated_at
FROM seller_applications 
ORDER BY created_at DESC;

-- Also check user roles to see if they're being updated
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as user_role
FROM auth.users 
WHERE raw_user_meta_data->>'role' IS NOT NULL
ORDER BY created_at DESC;
