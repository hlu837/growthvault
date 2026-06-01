import { useState, useEffect } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Search, 
  Filter,
  BookOpen,
  Calendar,
  Save,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface BlogPost {
  id: string;
  title: string;
  content: string;
  category: string;
  status: string;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

const BlogManagement = () => {
  const { toast } = useToast();
  const { profile, isAdmin, isStaff } = useAuth();
  
  // Check if user is admin or staff
  const isAdminOrStaff = profile?.account_status === 'active' && (isAdmin || isStaff);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    category: "Announcement",
    status: "published",
    image_url: ""
  });

  const categories = [
    { value: "all", label: "All Categories" },
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
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch blog posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [selectedCategory, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const postData = {
        title: formData.title,
        content: formData.content,
        category: formData.category,
        status: formData.status,
        image_url: formData.image_url || null,
      };

      if (editingPost) {
        // Update existing post
        const { error } = await supabase
          .from('blog_posts')
          .update(postData)
          .eq('id', editingPost.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Blog post updated successfully",
        });
      } else {
        // Create new post
        const { error } = await supabase
          .from('blog_posts')
          .insert(postData);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Blog post created successfully",
        });
      }

      // Reset form and refresh posts
      setFormData({
        title: "",
        content: "",
        category: "Announcement",
        status: "published",
        image_url: ""
      });
      setEditingPost(null);
      setIsCreateDialogOpen(false);
      fetchPosts();
    } catch (error) {
      console.error('Error saving post:', error);
      toast({
        title: "Error",
        description: "Failed to save blog post",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      content: post.content,
      category: post.category,
      status: post.status,
      image_url: post.image_url || "",
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this blog post?")) return;

    try {
      const { error } = await supabase
        .from('blog_posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Blog post deleted successfully",
      });
      
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete blog post",
        variant: "destructive",
      });
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

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      category: "Announcement",
      status: "published",
      image_url: ""
    });
    setEditingPost(null);
  };

  // Check if user is admin or staff
  if (!isAdminOrStaff) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mx-auto mb-4 rounded-lg shadow-md" />
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-4">
            You need administrator privileges to access this page.
          </p>
          <Button onClick={() => window.location.href = '/dashboard'}>
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-gold" />
              Blog Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Create, edit, and manage blog posts for the community
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gold-gradient hover:opacity-90">
                <Plus className="w-4 h-4" />
                Create Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingPost ? "Edit Blog Post" : "Create New Blog Post"}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Enter post title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({...formData, category: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tutorial">Tutorial</SelectItem>
                      <SelectItem value="Announcement">Announcement</SelectItem>
                      <SelectItem value="Success Story">Success Story</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="image_url">Image URL (optional)</Label>
                  <Input
                    id="image_url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({...formData, image_url: e.target.value})}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    placeholder="Write your blog post content here..."
                    rows={10}
                    required
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="gap-2">
                    <Save className="w-4 h-4" />
                    {editingPost ? "Update Post" : "Create Post"}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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

        {/* Posts List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-full"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="border-border/50 bg-background/60 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No blog posts found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || selectedCategory !== "all" 
                  ? "Try adjusting your filters or search terms" 
                  : "Create your first blog post to get started"}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" />
                Create First Post
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Card key={post.id} className="group hover:shadow-lg transition-all duration-300 border-border/50 bg-background/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex gap-2">
                      <Badge className={getCategoryColor(post.category)}>
                        {post.category}
                      </Badge>
                      <Badge variant={post.status === 'published' ? 'default' : 'secondary'}>
                        {post.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(post.created_at), 'MMM dd')}
                    </div>
                  </div>

                  <h3 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-gold transition-colors">
                    {post.title}
                  </h3>

                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {post.content.length > 100 
                      ? post.content.substring(0, 100) + "..." 
                      : post.content}
                  </p>

                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEdit(post)}
                      className="flex-1 gap-1"
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleDelete(post.id)}
                      className="gap-1 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default BlogManagement;
