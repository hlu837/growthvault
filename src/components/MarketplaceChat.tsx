import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Send, MessageSquare } from "lucide-react";
import { containsExternalContactInfo } from "@/hooks/useMarketplace";
import { toast } from "sonner";

interface MarketplaceChatProps {
  productId: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_flagged: boolean;
  created_at: string;
  sender?: {
    full_name: string;
  };
}

const MarketplaceChat = ({ productId }: MarketplaceChatProps) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [messageText, setMessageText] = useState("");
  const [showWarning, setShowWarning] = useState(false);

  // Get product to find seller
  const { data: product } = useQuery({
    queryKey: ["marketplace-product", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_products")
        .select("id, user_id")
        .eq("id", productId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Get messages between current user and seller
  const { data: messages, isLoading } = useQuery({
    queryKey: ["marketplace-messages", productId, user?.id, product?.user_id],
    queryFn: async () => {
      if (!user || !product?.user_id) return [];

      const { data, error } = await supabase
        .from("marketplace_messages")
        .select(`
          *,
          sender:profiles!sender_id (full_name)
        `)
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${product.user_id}),and(sender_id.eq.${product.user_id},receiver_id.eq.${user.id})`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as Message[];
    },
    enabled: !!user && !!product?.user_id,
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !product?.user_id) throw new Error("Missing user or seller");

      const { error } = await supabase
        .from("marketplace_messages")
        .insert({
          sender_id: user.id,
          receiver_id: product.user_id,
          content,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      setMessageText("");
      setShowWarning(false);
      queryClient.invalidateQueries({ queryKey: ["marketplace-messages"] });
      toast.success("Message sent");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to send message");
    },
  });

  // Check for contact info as user types
  useEffect(() => {
    const hasContactInfo = containsExternalContactInfo(messageText);
    setShowWarning(hasContactInfo);
  }, [messageText]);

  const handleSendMessage = () => {
    if (!messageText.trim()) return;

    if (showWarning) {
      // Still allow sending, but warn
      toast.warning("Message contains contact information and will be flagged");
    }

    sendMessage.mutate(messageText);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Please sign in to chat</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Chat with Seller
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 p-2 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
          {isLoading ? (
            <div className="text-center text-muted-foreground">Loading messages...</div>
          ) : messages?.length === 0 ? (
            <div className="text-center text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages?.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] p-3 rounded-lg ${
                    message.sender_id === user.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                >
                  <div className="text-xs opacity-75 mb-1">
                    {message.sender_id === user.id ? 'You' : message.sender?.full_name || 'Seller'}
                  </div>
                  <div className="text-sm">{message.content}</div>
                  {message.is_flagged && (
                    <Badge variant="destructive" className="text-xs mt-1">
                      Flagged
                    </Badge>
                  )}
                  <div className="text-xs opacity-75 mt-1">
                    {new Date(message.created_at).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Warning */}
        {showWarning && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">Warning</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400 mt-1">
              Sharing contact details is prohibited and will increase your Risk Score. This message will be flagged for Admin review.
            </p>
          </div>
        )}

        {/* Message Input */}
        <div className="flex gap-2">
          <Textarea
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-h-[80px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!messageText.trim() || sendMessage.isPending}
            className="self-end"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MarketplaceChat;