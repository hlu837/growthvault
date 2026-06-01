-- Fix blog_posts RLS policies
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins and staff can manage all blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins and staff can create blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Public view published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins can manage all posts" ON public.blog_posts;

-- Create corrected policies for blog_posts
-- Policy 1: Public can view published blog posts
CREATE POLICY "Public view published blog posts"
    ON public.blog_posts FOR SELECT
    TO authenticated, anon
    USING (status = 'published');

-- Policy 2: Admins and staff can view all blog posts
CREATE POLICY "Admins view all posts"
    ON public.blog_posts FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Policy 3: Admins and staff can insert blog posts
CREATE POLICY "Admins insert posts"
    ON public.blog_posts FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Policy 4: Admins and staff can update blog posts
CREATE POLICY "Admins update posts"
    ON public.blog_posts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Policy 5: Admins and staff can delete blog posts
CREATE POLICY "Admins delete posts"
    ON public.blog_posts FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );
