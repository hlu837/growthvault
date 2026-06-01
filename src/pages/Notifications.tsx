import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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

const Notifications = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch seller notifications
  const { data: sellerNotifications = [], isLoading: sellerLoading } = useQuery({
    queryKey: ["seller-notifications-page"],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("seller_application_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(n => ({ ...n, source: 'seller' as const })) as SellerNotification[];
    },
    enabled: !!user,
  });

  // Fetch general notifications
  const { data: generalNotifications = [], isLoading: generalLoading } = useQuery({
    queryKey: ["general-notifications-page"],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return (data || []).map(n => ({ ...n, source: 'general' as const })) as GeneralNotification[];
    },
    enabled: !!user,
  });

  const allNotifications: NotificationItem[] = useMemo(() => {
    return [...sellerNotifications, ...generalNotifications].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [sellerNotifications, generalNotifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return allNotifications.filter(n => !n.read);
    }
    return allNotifications;
  }, [allNotifications, filter]);

  const isLoading = sellerLoading || generalLoading;
  const isError = false;
  const error = null;

  const markAsReadMutation = async (notificationId: string) => {
    const notification = allNotifications.find(n => n.id === notificationId);
    if (!notification) return;

    try {
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
      // Refetch notifications
      window.location.reload();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const getNotificationIcon = (notification: NotificationItem) => {
    if (notification.source === 'seller') {
      const sel = notification as SellerNotification;
      return sel.type === 'approved' ? (
        <CheckCircle className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      );
    }
    return <AlertCircle className="w-5 h-5 text-blue-500" />;
  };

  const getNotificationTitle = (notification: NotificationItem) => {
    if (notification.source === 'seller') {
      return (notification as SellerNotification).message;
    }
    return (notification as GeneralNotification).title;
  };

  const getNotificationMessage = (notification: NotificationItem) => {
    if (notification.source === 'seller') {
      return '';
    }
    return (notification as GeneralNotification).message;
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-2">
          <ArrowLeft className="mr-2 h-4 w-4" /> {t("notifications.back")}
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t("notifications.title")}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Total: {allNotifications.length} | Unread: {allNotifications.filter(n => !n.read).length}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'unread' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter('unread')}
                >
                  Unread
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="inline-block">
                  <div className="h-8 w-32 bg-secondary animate-pulse rounded" />
                </div>
              </div>
            ) : isError ? (
              <div className="text-destructive">
                {t("errors.somethingWentWrong")}
                {error?.message ? ` (${error.message})` : ""}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="space-y-3 py-8 text-center">
                <div className="text-muted-foreground">
                  {filter === 'unread' ? (
                    <p>No unread notifications</p>
                  ) : (
                    <p>{t("notifications.noNotifications")}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 border rounded-lg flex items-start gap-4 ${
                      notif.read ? "bg-background" : "bg-primary/5 border-primary/50"
                    }`}
                  >
                    <div className="mt-1">
                      {getNotificationIcon(notif)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className={`font-semibold ${notif.read ? "text-foreground" : "text-foreground"}`}>
                            {getNotificationTitle(notif)}
                          </p>
                          {getNotificationMessage(notif) && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {getNotificationMessage(notif)}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!notif.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation(notif.id)}
                            className="ml-2"
                          >
                            <CheckCircle className="w-4 h-4 text-accent" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Notifications;
