-- Check if the application status actually updated
SELECT 
    id,
    user_id,
    status,
    rejection_reason,
    approved_at,
    approved_by,
    reviewed_at,
    reviewed_by,
    created_at,
    updated_at
FROM seller_applications 
WHERE id = 'e6d3d879-7ef1-4104-a954-438817c2a8c2';

-- Also check if the user role was updated
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as user_role
FROM auth.users 
WHERE id = (SELECT user_id FROM seller_applications WHERE id = 'e6d3d879-7ef1-4104-a954-438817c2a8c2');
