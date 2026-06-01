import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, BookOpen, Calendar, Edit, Trash2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  category: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

const PostDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, role } = useAuth();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const isAdminOrStaff = role === "admin" || role === "staff";

  useEffect(() => {
    fetchPost();
  }, [id]);

  const fetchPost = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Post not found",
          description: "The blog post you're looking for doesn't exist.",
          variant: "destructive",
        });
        navigate('/blog');
        return;
      }

      setPost(data);
    } catch (error) {
      console.error('Error fetching post:', error);
      toast({
        title: "Error",
        description: "Failed to load blog post",
        variant: "destructive",
      });
      navigate('/blog');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!post || !confirm("Are you sure you want to delete this blog post?")) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', post.id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Blog post deleted successfully",
      });
      
      navigate('/blog');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete blog post",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Tutorial': 'bg-blue-500/10 text-blue-600 border-blue-200',
      'Announcement': 'bg-green-500/10 text-green-600 border-green-200',
      'Success Story': 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
    };
    return colors[category] || 'bg-gray-500/10 text-gray-600 border-gray-200';
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
            <div className="h-64 bg-muted rounded mb-6"></div>
            <div className="space-y-3">
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-full"></div>
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!post) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Alert className="max-w-md">
            <BookOpen className="h-4 w-4" />
            <AlertDescription>
              Blog post not found. It may have been deleted or the link is incorrect.
            </AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/blog')}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Button>

        {/* Post Header */}
        <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Badge className={getCategoryColor(post.category)}>
                  {post.category}
                </Badge>
                <h1 className="text-3xl font-bold text-foreground">
                  {post.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(post.created_at), 'MMMM dd, yyyy')}
                  </div>
                  {post.updated_at !== post.created_at && (
                    <div className="flex items-center gap-1">
                      <Edit className="w-3 h-3" />
                      Updated {format(new Date(post.updated_at), 'MMM dd, yyyy')}
                    </div>
                  )}
                </div>
              </div>

              {/* Admin/Staff Actions */}
              {isAdminOrStaff && (
                <div className="flex gap-2">
                  <Link to={`/admin/blog`}>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Edit className="w-3 h-3" />
                      Edit
                    </Button>
                  </Link>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    {deleting ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>

          {/* Post Image */}
          {post.image_url && (
            <div className="px-6 pb-6">
              <img
                src={post.image_url}
                alt={post.title}
                className="w-full rounded-lg shadow-lg object-cover max-h-96"
              />
            </div>
          )}

          {/* Post Content */}
          <CardContent className="pt-0">
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                {post.content}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <BookOpen className="w-4 h-4 inline mr-2" />
                Published on {format(new Date(post.created_at), 'MMMM dd, yyyy at h:mm a')}
              </div>
              {isAdminOrStaff && (
                <div className="text-xs text-muted-foreground">
                  Admin/Staff controls available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PostDetail;
