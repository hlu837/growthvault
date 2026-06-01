import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export const useLatestPosts = (limit: number = 3) => {
  return useQuery({
    queryKey: ["latest-posts", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, content, category, image_url, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      
      return data?.map(post => ({
        ...post,
        excerpt: post.content.length > 100 
          ? post.content.substring(0, 100) + "..." 
          : post.content
      })) || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useBlogPosts = () => {
  return useQuery({
    queryKey: ["blog-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
