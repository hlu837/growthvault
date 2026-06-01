-- Create a test seller application to test the approval system
-- Run this first to create test data

-- First, check if you have a user to test with (replace with your actual user ID)
SELECT id, email FROM auth.users LIMIT 5;

-- Create a test seller application (replace with your actual user ID)
INSERT INTO public.seller_applications (
    user_id,
    business_name,
    business_type,
    business_description,
    business_address,
    business_phone,
    business_email,
    registration_number,
    tax_id,
    website_url,
    years_in_business,
    employee_count,
    monthly_revenue,
    kyc_documents,
    business_documents,
    status
) VALUES (
    'your-user-id-here',  -- Replace with actual user UUID from auth.users
    'Test Business Inc.',
    'general',
    'A test business for approval system testing',
    '123 Test Street, Test City, TC 12345',
    '+1-555-0123',
    'test@testbusiness.com',
    'REG123456',
    'TAX789012',
    'https://testbusiness.com',
    3,
    5,
    15000.00,
    '[]'::jsonb,
    '[]'::jsonb,
    'pending'
) RETURNING id;

-- After creating the application, you can approve it with:
-- SELECT immediate_approve_seller('application-id-from-above');
