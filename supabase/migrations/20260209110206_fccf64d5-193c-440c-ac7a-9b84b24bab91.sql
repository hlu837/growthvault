-- Update approve_kyc to restrict final approval to admins only
-- Staff can still reject, but only admins can set status to 'approved'
CREATE OR REPLACE FUNCTION public.approve_kyc(p_user_id uuid, p_new_status text, p_reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_caller_id uuid := auth.uid();
  v_is_admin boolean;
  v_is_staff boolean;
BEGIN
  -- Check if caller is admin
  v_is_admin := has_role(v_caller_id, 'admin');
  -- Check if caller is staff
  v_is_staff := has_role(v_caller_id, 'staff');

  -- Must be admin or staff to call this function
  IF NOT v_is_admin AND NOT v_is_staff THEN
    RAISE EXCEPTION 'Unauthorized: requires admin or staff role';
  END IF;

  -- CRITICAL: Only admins can do FINAL APPROVAL
  IF p_new_status = 'approved' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: only admins can grant final KYC approval';
  END IF;

  -- Get current status
  SELECT kyc_status INTO v_old_status
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Update the profile
  UPDATE profiles
  SET kyc_status = p_new_status,
      updated_at = now()
  WHERE id = p_user_id;

  -- Log the audit trail
  INSERT INTO kyc_audit_log (user_id, changed_by, previous_status, new_status, rejection_reason)
  VALUES (p_user_id, v_caller_id, v_old_status, p_new_status, p_reason);

  RETURN true;
END;
$$;