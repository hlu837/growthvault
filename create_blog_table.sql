-- Create blog_posts table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    category TEXT DEFAULT 'Announcement' CHECK (category IN ('Tutorial', 'Announcement', 'Success Story')),
    image_url TEXT,
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure status column exists (in case table was created without it)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'blog_posts' 
        AND column_name = 'status'
        AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.blog_posts 
        ADD COLUMN status TEXT DEFAULT 'published' 
        CHECK (status IN ('draft', 'published', 'archived'));
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view published blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins and staff can manage all blog posts" ON public.blog_posts;
DROP POLICY IF EXISTS "Admins and staff can create blog posts" ON public.blog_posts;

-- Create policies for blog_posts
CREATE POLICY "Anyone can view published blog posts"
    ON public.blog_posts FOR SELECT
    TO authenticated
    USING (status = 'published');

CREATE POLICY "Admins and staff can manage all blog posts"
    ON public.blog_posts FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Create policy for inserting blog posts (admin/staff only)
CREATE POLICY "Admins and staff can create blog posts"
    ON public.blog_posts FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() 
            AND ur.role IN ('admin', 'staff')
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER update_blog_posts_updated_at
BEFORE UPDATE ON public.blog_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample blog posts if table is empty
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.blog_posts) THEN
        INSERT INTO public.blog_posts (title, content, excerpt, category, author_id, status) 
        VALUES (
            'Welcome to Golden Wealth Achievers',
            'We are excited to have you join our platform. This blog will provide you with valuable insights into investment strategies, success stories, and platform updates.',
            'Welcome to our investment platform',
            'Announcement',
            auth.uid(),
            'published'
        );
        
        INSERT INTO public.blog_posts (title, content, excerpt, category, author_id, status) 
        VALUES (
            'How to Get Started with Investments',
            'Getting started with investments is easy. First, complete your KYC verification, then choose your investment tier, and make your first deposit. Our platform offers multiple investment options to suit your financial goals.',
            'Learn the basics of investing on our platform',
            'Tutorial',
            auth.uid(),
            'published'
        );
    END IF;
END $$;
