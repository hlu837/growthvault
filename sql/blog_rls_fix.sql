-- Drop existing RLS policies on blog_posts
DROP POLICY IF EXISTS "Anyone can view blog posts" ON blog_posts;
DROP POLICY IF EXISTS "Only admins and staff can create posts" ON blog_posts;
DROP POLICY IF EXISTS "Only admins and staff can update posts" ON blog_posts;
DROP POLICY IF EXISTS "Only admins and staff can delete posts" ON blog_posts;

-- Create corrected RLS policies using has_role function
CREATE POLICY "Anyone can view blog posts" ON blog_posts
  FOR SELECT USING (true);

CREATE POLICY "Only admins and staff can create posts" ON blog_posts
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Only admins and staff can update posts" ON blog_posts
  FOR UPDATE USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY "Only admins and staff can delete posts" ON blog_posts
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff')
  );
