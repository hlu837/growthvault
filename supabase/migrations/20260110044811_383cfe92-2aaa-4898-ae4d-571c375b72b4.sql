
-- Delete all existing roles
DELETE FROM public.user_roles;

-- Assign growthvault64@gmail.com as admin only
INSERT INTO public.user_roles (user_id, role)
VALUES ('625d71ee-8554-40b5-90d5-8098d9f95a41', 'admin');

-- Assign staffauth78@gmail.com as staff only
INSERT INTO public.user_roles (user_id, role)
VALUES ('577a92f3-e4ae-451b-8011-f2d494b4f949', 'staff');
