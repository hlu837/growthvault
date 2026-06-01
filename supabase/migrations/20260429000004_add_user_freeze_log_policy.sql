-- Add policy for users to view their own admin action logs (freeze reasons)

CREATE POLICY "Users can view their own freeze action logs"
  ON public.admin_action_logs FOR SELECT
  USING (
    auth.uid() = target_user_id
    AND action = 'freeze_account'
  );