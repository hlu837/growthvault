-- Create RPC for staff to temporarily suspend/unsuspend users
-- Staff can only toggle between 'active' and 'suspended'
-- Only admins can set 'blacklisted' or 'under_review'
CREATE OR REPLACE FUNCTION public.staff_update_account_status(
  p_user_id uuid,
  p_new_status account_status
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_admin boolean;
  v_is_staff boolean;
  v_current_status account_status;
BEGIN
  v_is_admin := has_role(v_caller_id, 'admin');
  v_is_staff := has_role(v_caller_id, 'staff');

  IF NOT v_is_admin AND NOT v_is_staff THEN
    RAISE EXCEPTION 'Unauthorized: requires admin or staff role';
  END IF;

  -- Staff can ONLY set 'suspended' or 'active' (temporary suspend/unsuspend)
  IF NOT v_is_admin AND p_new_status NOT IN ('suspended', 'active') THEN
    RAISE EXCEPTION 'Unauthorized: staff can only temporarily suspend or reactivate accounts';
  END IF;

  -- Get current status
  SELECT account_status INTO v_current_status
  FROM profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Staff cannot unsuspend a blacklisted account (admin escalation required)
  IF NOT v_is_admin AND v_current_status = 'blacklisted' THEN
    RAISE EXCEPTION 'Cannot modify blacklisted accounts: requires admin intervention';
  END IF;

  -- Prevent no-op
  IF v_current_status = p_new_status THEN
    RAISE EXCEPTION 'Account status is already %', p_new_status;
  END IF;

  -- Update status
  UPDATE profiles
  SET account_status = p_new_status,
      updated_at = now()
  WHERE id = p_user_id;

  RETURN true;
END;
$$;