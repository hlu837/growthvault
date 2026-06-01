# Database Migrations Required for Enhanced Seller Application

## You MUST run these SQL migrations in order:

### 1. Enhanced Schema Migration
File: `supabase/migrations/20260503000001_enhance_seller_application_schema.sql`

This adds all the new fields to the seller_applications table:
- account_type, full_name, username
- date_of_birth, nationality, residential_address  
- bank_account_name, bank_name, bank_account_number, payout_method
- password, security_question, security_answer
- commitment_agreement, escrow_agreement, dispute_agreement, terms_agreement
- final_declaration_signature, final_declaration_date
- applied_categories (JSON array)
- Category-specific fields (real_estate_seller_type, etc.)

### 2. Updated Backend Function
File: `supabase/migrations/20260503000002_update_enhanced_apply_as_seller.sql`

This updates the apply_as_seller function to handle all the new fields and validation.

### 3. Notifications Migration (if not already run)
File: `supabase/migrations/20260502000003_add_notifications_clean.sql`

This adds the notification system for approval/rejection.

## Common Issues if Migrations Not Run:

1. **Form submission fails** - Database doesn't have the new columns
2. **Backend errors** - Function parameters don't match database schema
3. **Validation errors** - Required fields missing from database

## How to Run:

Copy and paste each SQL file content into your Supabase SQL editor and run them in order.
