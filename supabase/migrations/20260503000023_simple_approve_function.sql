-- Create a simple approve function that just updates the status
CREATE OR REPLACE FUNCTION public.approve_seller_application(
    p_application_id UUID
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    application_record RECORD;
    current_admin_id UUID;
BEGIN
    -- Get the current admin user ID
    current_admin_id := auth.uid();
    
    -- Get the application record
    SELECT * INTO application_record 
    FROM seller_applications 
    WHERE id = p_application_id AND status = 'pending';
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'Application not found or already processed.'::TEXT;
        RETURN;
    END IF;
    
    -- Update the application status
    UPDATE seller_applications 
    SET 
        status = 'approved',
        approved_at = NOW(),
        approved_by = current_admin_id,
        updated_at = NOW()
    WHERE id = p_application_id;
    
    -- Update user role to seller
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        raw_user_meta_data,
        '{role}',
        '"seller"'
    )
    WHERE id = application_record.user_id;
    
    RETURN QUERY SELECT true, 'Application approved and user upgraded to seller.'::TEXT;
END;
$$;

-- Test the function with the application ID from the database
-- Replace with the actual application ID from your database
SELECT public.approve_seller_application('YOUR_APPLICATION_ID_HERE');
