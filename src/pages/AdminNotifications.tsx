import { useState } from "react";
import { useTranslation } from "react-i18next";
import { 
  Bell, 
  Send, 
  Users, 
  User, 
  Filter, 
  Search,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import AdminLayout from "@/components/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  target_type: "all" | "role" | "user";
  target_value?: string;
  is_global: boolean;
  created_at: string;
  created_by: string;
  is_active: boolean;
  read_count?: number;
  total_recipients?: number;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

const AdminNotifications = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTarget, setSelectedTarget] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    title: "",
    message: "",
    type: "info" as const,
    target_type: "all" as const,
    target_value: "",
    is_global: true,
  });

  const notificationTypes = [
    { value: "all", label: "All Types" },
    { value: "info", label: "Info", icon: Info, color: "bg-blue-500/10 text-blue-600 border-blue-200" },
    { value: "success", label: "Success", icon: CheckCircle, color: "bg-green-500/10 text-green-600 border-green-200" },
    { value: "warning", label: "Warning", icon: AlertCircle, color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
    { value: "error", label: "Error", icon: AlertCircle, color: "bg-red-500/10 text-red-600 border-red-200" },
  ];

  const targetTypes = [
    { value: "all", label: "All Users" },
    { value: "role", label: "By Role" },
    { value: "user", label: "Specific Users" },
  ];

  // Fetch notifications
  const { data: notifications, isLoading: notificationsLoading, refetch: refetchNotifications } = useQuery({
    queryKey: ["admin-notifications", searchTerm, selectedType, selectedTarget],
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedType !== "all") {
        query = query.eq('type', selectedType);
      }

      if (selectedTarget !== "all") {
        query = query.eq('target_type', selectedTarget);
      }

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,message.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch users for targeting
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-for-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('account_status', 'active')
        .order('full_name');

      if (error) throw error;
      return data || [];
    },
  });

  const handleCreateNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const notificationData = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        target_type: formData.target_type,
        target_value: formData.target_type === "user" ? selectedUsers.join(',') : formData.target_value,
        is_global: formData.target_type === "all",
        created_by: "admin", // In real app, use actual admin ID
      };

      if (editingNotification) {
        // Update existing notification
        const { error } = await supabase
          .from('notifications')
          .update(notificationData)
          .eq('id', editingNotification.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Notification updated successfully",
        });
      } else {
        // Create new notification
        const { error } = await supabase
          .from('notifications')
          .insert(notificationData);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Notification sent successfully",
        });
      }

      // Reset form and refresh
      setFormData({
        title: "",
        message: "",
        type: "info",
        target_type: "all",
        target_value: "",
        is_global: true,
      });
      setSelectedUsers([]);
      setEditingNotification(null);
      setIsCreateDialogOpen(false);
      refetchNotifications();
    } catch (error) {
      console.error('Error saving notification:', error);
      toast({
        title: "Error",
        description: "Failed to save notification",
        variant: "destructive",
      });
    }
  };

  const handleEditNotification = (notification: Notification) => {
    setEditingNotification(notification);
    setFormData({
      title: notification.title,
      message: notification.message,
      type: notification.type,
      target_type: notification.target_type,
      target_value: notification.target_value || "",
      is_global: notification.is_global,
    });
    
    if (notification.target_type === "user" && notification.target_value) {
      setSelectedUsers(notification.target_value.split(','));
    }
    
    setIsCreateDialogOpen(true);
  };

  const handleDeleteNotification = async (notificationId: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Notification deleted successfully",
      });
      
      refetchNotifications();
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    }
  };

  const handleToggleNotification = async (notificationId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_active: !isActive })
        .eq('id', notificationId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: `Notification ${!isActive ? 'activated' : 'deactivated'}`,
      });
      
      refetchNotifications();
    } catch (error) {
      console.error('Error toggling notification:', error);
      toast({
        title: "Error",
        description: "Failed to toggle notification",
        variant: "destructive",
      });
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconMap = {
      info: Info,
      success: CheckCircle,
      warning: AlertCircle,
      error: AlertCircle,
    };
    return iconMap[type as keyof typeof iconMap] || Info;
  };

  const getNotificationColor = (type: string) => {
    const colorMap = {
      info: "bg-blue-500/10 text-blue-600 border-blue-200",
      success: "bg-green-500/10 text-green-600 border-green-200",
      warning: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
      error: "bg-red-500/10 text-red-600 border-red-200",
    };
    return colorMap[type as keyof typeof colorMap] || colorMap.info;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Bell className="w-8 h-8 text-gold" />
              Notification Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Send and manage notifications to users
            </p>
          </div>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setEditingNotification(null);
              setFormData({
                title: "",
                message: "",
                type: "info",
                target_type: "all",
                target_value: "",
                is_global: true,
              });
              setSelectedUsers([]);
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gold-gradient hover:opacity-90">
                <Send className="w-4 h-4" />
                Send Notification
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingNotification ? "Edit Notification" : "Send New Notification"}
                </DialogTitle>
              </DialogHeader>
              
              <form onSubmit={handleCreateNotification} className="space-y-4">
                <div>
                  <Label htmlFor="title">Notification Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    placeholder="Enter notification title"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    placeholder="Enter notification message"
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="type">Notification Type</Label>
                    <Select value={formData.type} onValueChange={(value: any) => setFormData({...formData, type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="target_type">Target Audience</Label>
                    <Select value={formData.target_type} onValueChange={(value: any) => setFormData({...formData, target_type: value})}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="role">By Role</SelectItem>
                        <SelectItem value="user">Specific Users</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {formData.target_type === "role" && (
                  <div>
                    <Label htmlFor="target_value">Role</Label>
                    <Select value={formData.target_value} onValueChange={(value) => setFormData({...formData, target_value: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.target_type === "user" && (
                  <div>
                    <Label>Select Users</Label>
                    <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                      {usersLoading ? (
                        <div className="text-center py-4 text-muted-foreground">Loading users...</div>
                      ) : (
                        users?.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              id={user.id}
                              checked={selectedUsers.includes(user.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUsers([...selectedUsers, user.id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                }
                              }}
                            />
                            <Label htmlFor={user.id} className="text-sm">
                              {user.full_name} ({user.email})
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="gap-2">
                    <Send className="w-4 h-4" />
                    {editingNotification ? "Update Notification" : "Send Notification"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
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
                  placeholder="Search notifications..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-border/50"
                />
              </div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger className="w-full sm:w-48">
                  <Users className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Target" />
                </SelectTrigger>
                <SelectContent>
                  {targetTypes.map((target) => (
                    <SelectItem key={target.value} value={target.value}>
                      {target.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Notifications List */}
        {notificationsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6 space-y-3">
                  <div className="h-4 bg-muted rounded w-3/4"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {notifications?.map((notification) => (
              <Card key={notification.id} className="border-border/50 bg-background/60 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={getNotificationColor(notification.type)}>
                          {(() => {
                            const Icon = getNotificationIcon(notification.type);
                            return <Icon className="w-4 h-4" />;
                          })()}
                          <span className="ml-1">{notification.type}</span>
                        </Badge>
                        <Badge variant="outline">
                          {notification.target_type === "all" ? "All Users" : 
                           notification.target_type === "role" ? `Role: ${notification.target_value}` :
                           "Specific Users"}
                        </Badge>
                        <Badge variant={notification.is_active ? "default" : "secondary"}>
                          {notification.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      
                      <h3 className="font-semibold text-lg mb-2">{notification.title}</h3>
                      <p className="text-muted-foreground mb-3">{notification.message}</p>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Created: {format(new Date(notification.created_at), 'MMM dd, yyyy HH:mm')}</span>
                        {notification.read_count && (
                          <span>Read: {notification.read_count}</span>
                        )}
                        {notification.total_recipients && (
                          <span>Recipients: {notification.total_recipients}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button variant="outline" size="sm" onClick={() => handleEditNotification(notification)}>
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleToggleNotification(notification.id, notification.is_active)}
                      >
                        {notification.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteNotification(notification.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
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

export default AdminNotifications;
