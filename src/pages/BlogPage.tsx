import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Calendar, Search, Filter, ArrowRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  created_at: string;
  excerpt?: string;
}

const BlogPage = () => {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { value: "all", label: "All Posts" },
    { value: "Tutorial", label: "Tutorial" },
    { value: "Announcement", label: "Announcement" },
    { value: "Success Story", label: "Success Story" },
  ];

  const fetchPosts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('blog_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedCategory !== "all") {
        query = query.eq('category', selectedCategory);
      }

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Generate excerpt from content if not present
      const postsWithExcerpt = data?.map(post => ({
        ...post,
        excerpt: typeof post.content === 'string'
          ? post.content.length > 150
            ? post.content.substring(0, 150) + "..."
            : post.content
          : ''
      })) || [];

      setPosts(postsWithExcerpt);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory, searchTerm]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Tutorial': 'bg-blue-500/10 text-blue-600 border-blue-200',
      'Announcement': 'bg-green-500/10 text-green-600 border-green-200',
      'Success Story': 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-600 border-gray-200';
  };

  const formatBlogDate = (createdAt?: string | null) => {
    if (!createdAt) return 'Unknown date';
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : format(date, 'MMM dd, yyyy');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">Blog</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-lg"></div>
                <CardContent className="p-6 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-gold" />
              Blog
            </h1>
            <p className="text-muted-foreground mt-2">
              Stay updated with the latest news, tutorials, and success stories
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search posts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border/50"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48 border-border/50">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Posts Grid */}
        {posts.length === 0 ? (
          <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No posts found</h3>
              <p className="text-muted-foreground">
                {searchTerm || selectedCategory !== "all" 
                  ? "Try adjusting your filters or search terms" 
                  : "No blog posts have been published yet"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Card key={post.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-background/60 backdrop-blur-sm overflow-hidden">
                {/* Post Image */}
                <div className="relative h-48 overflow-hidden">
                  {post.image_url ? (
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-gold/50" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <Badge className={getCategoryColor(post.category)}>
                      {post.category}
                    </Badge>
                  </div>
                </div>

                {/* Post Content */}
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                    <Calendar className="w-4 h-4" />
                    {formatBlogDate(post.created_at)}
                  </div>

                  <CardTitle className="text-lg font-semibold text-foreground mb-3 line-clamp-2 group-hover:text-gold transition-colors">
                    {post.title}
                  </CardTitle>

                  <CardDescription className="text-muted-foreground mb-4 line-clamp-3">
                    {post.excerpt}
                  </CardDescription>

                  <Link to={`/blog/${post.id}`}>
                    <Button variant="ghost" className="w-full justify-between group-hover:bg-gold/10 transition-colors">
                      Read More
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default BlogPage;
