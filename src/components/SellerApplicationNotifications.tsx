import { useEffect, useState } from "react";
import { Bell, CheckCircle, XCircle, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface SellerNotification {
  id: string;
  user_id: string;
  application_id: string;
  type: 'approved' | 'rejected';
  message: string;
  read: boolean;
  created_at: string;
  source: 'seller';
}

interface GeneralNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  source: 'general';
}

type NotificationItem = SellerNotification | GeneralNotification;

const SellerApplicationNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch seller application notifications
  const { data: sellerNotifications = [], isLoading: sellerLoading } = useQuery({
    queryKey: ["seller-application-notifications"],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("seller_application_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return (data || []).map(n => ({ ...n, source: 'seller' as const })) as SellerNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Fetch general notifications
  const { data: generalNotifications = [], isLoading: generalLoading } = useQuery({
    queryKey: ["general-notifications"],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return (data || []).map(n => ({ ...n, source: 'general' as const })) as GeneralNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Combine and sort notifications
  const notifications: NotificationItem[] = [...sellerNotifications, ...generalNotifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ).slice(0, 15);

  const isLoading = sellerLoading || generalLoading;

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const notification = notifications.find(n => n.id === notificationId);
      if (!notification) return;

      if (notification.source === 'seller') {
        const { error } = await supabase
          .from("seller_application_notifications")
          .update({ read: true })
          .eq("id", notificationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("id", notificationId);
        if (error) throw error;
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-application-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["general-notifications"] });
    },
    onError: (error: any) => {
      toast.error("Failed to mark notification as read");
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      
      // Mark seller notifications as read
      const sellerUnread = sellerNotifications.filter(n => !n.read);
      if (sellerUnread.length > 0) {
        const { error } = await supabase
          .from("seller_application_notifications")
          .update({ read: true })
          .eq("user_id", user.id)
          .eq("read", false);
        if (error) throw error;
      }

      // Mark general notifications as read
      const generalUnread = generalNotifications.filter(n => !n.read);
      if (generalUnread.length > 0) {
        const { error } = await supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", user.id)
          .eq("read", false);
        if (error) throw error;
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-application-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["general-notifications"] });
      toast.success("All notifications marked as read");
    },
    onError: (error: any) => {
      toast.error("Failed to mark all notifications as read");
    },
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const getNotificationIcon = (notification: NotificationItem) => {
    if (notification.source === 'seller') {
      const sel = notification as SellerNotification;
      return sel.type === 'approved' ? (
        <CheckCircle className="w-4 h-4 text-green-500" />
      ) : (
        <XCircle className="w-4 h-4 text-red-500" />
      );
    }
    return <AlertCircle className="w-4 h-4 text-blue-500" />;
  };

  const getNotificationTitle = (notification: NotificationItem) => {
    if (notification.source === 'seller') {
      return (notification as SellerNotification).message;
    }
    return (notification as GeneralNotification).title;
  };

  if (!user) return null;

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-10 w-10 rounded-full hover:bg-secondary active:scale-95 transition-all p-0"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full" />
        )}
      </Button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-background border border-border rounded-lg shadow-lg z-50 max-h-[500px] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} unread</p>}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    disabled={markAllAsReadMutation.isPending}
                    className="text-xs"
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="max-h-[350px] overflow-y-auto flex-1">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`m-2 ${!notification.read ? 'border-primary/50 bg-primary/5' : ''}`}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        {getNotificationIcon(notification)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${!notification.read ? 'font-semibold' : ''}`}>
                          {getNotificationTitle(notification)}
                        </p>
                        {notification.source === 'general' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {(notification as GeneralNotification).message}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notification.created_at).toLocaleDateString()} at{' '}
                          {new Date(notification.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          disabled={markAsReadMutation.isPending}
                        >
                          <CheckCircle className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="p-3 border-t border-border bg-secondary/30">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                navigate('/notifications');
                setIsOpen(false);
              }}
            >
              View All Notifications
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerApplicationNotifications;
