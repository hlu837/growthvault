import { useState } from "react";
import { 
  Shield, 
  MessageSquare, 
  Search, 
  Clock, 
  CheckCircle,
  User,
  Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const StaffTickets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "resolved" | "closed">("open");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [response, setResponse] = useState("");
  const { isAdmin, isStaff, user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch tickets
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["staff-tickets", filter],
    queryFn: async () => {
      let query = supabase
        .from("support_tickets")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || isStaff,
  });

  // Respond to ticket
  const respondToTicket = useMutation({
    mutationFn: async ({ ticketId, response, status }: { ticketId: string; response: string; status: string }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ 
          response,
          status,
          responded_by: user?.id,
          responded_at: new Date().toISOString()
        })
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-tickets"] });
      toast.success("Response sent successfully");
      setSelectedTicket(null);
      setResponse("");
    },
    onError: () => {
      toast.error("Failed to send response");
    },
  });

  // Update ticket status
  const updateStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: string }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", ticketId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-tickets"] });
      toast.success("Status updated");
    },
  });

  const filteredTickets = tickets?.filter((t: any) => {
    const matchesSearch = 
      t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  }) || [];

  const stats = {
    open: tickets?.filter((t: any) => t.status === "open").length || 0,
    in_progress: tickets?.filter((t: any) => t.status === "in_progress").length || 0,
    resolved: tickets?.filter((t: any) => t.status === "resolved").length || 0,
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-destructive/10 text-destructive border-destructive/30";
      case "high": return "bg-warning/10 text-warning border-warning/30";
      case "normal": return "bg-primary/10 text-primary border-primary/30";
      default: return "bg-secondary text-muted-foreground";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-warning/10 text-warning border-warning/30";
      case "in_progress": return "bg-primary/10 text-primary border-primary/30";
      case "resolved": return "bg-accent/10 text-accent border-accent/30";
      case "closed": return "bg-secondary text-muted-foreground";
      default: return "";
    }
  };

  if (!isAdmin && !isStaff) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <img src="/logo.png" alt="GWA Logo" className="w-16 h-16 mb-4 rounded-lg shadow-md" />
          <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Shield className="w-4 h-4" />
            Staff Panel
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Support Tickets
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and respond to user support requests.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFilter("open")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "open" ? "border-warning bg-warning/10" : "border-border bg-card"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-warning">{stats.open}</div>
            <div className="text-sm text-muted-foreground">Open</div>
          </button>
          <button
            onClick={() => setFilter("in_progress")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "in_progress" ? "border-primary bg-primary/10" : "border-border bg-card"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-primary">{stats.in_progress}</div>
            <div className="text-sm text-muted-foreground">In Progress</div>
          </button>
          <button
            onClick={() => setFilter("resolved")}
            className={`p-4 rounded-md border text-left transition-all ${
              filter === "resolved" ? "border-accent bg-accent/10" : "border-border bg-card"
            }`}
          >
            <div className="text-2xl font-bold font-mono text-accent">{stats.resolved}</div>
            <div className="text-sm text-muted-foreground">Resolved</div>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by subject, name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border"
          />
        </div>

        {/* Tickets List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-secondary/30 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-muted-foreground">No tickets found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredTickets.map((ticket: any) => (
              <Card key={ticket.id} className="hover:border-muted-foreground/50 transition-colors">
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        <Badge variant="outline" className={getStatusColor(ticket.status)}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </div>
                      <h3 className="font-medium mb-1">{ticket.subject}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="w-3 h-3" />
                        {ticket.profiles?.full_name || ticket.profiles?.email}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {ticket.message}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setSelectedTicket(ticket)}
                      >
                        <MessageSquare className="w-4 h-4 mr-1" />
                        {ticket.response ? "View" : "Respond"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Ticket Detail Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* User Info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="w-4 h-4" />
                {selectedTicket?.profiles?.full_name} ({selectedTicket?.profiles?.email})
              </div>

              {/* Original Message */}
              <div className="p-4 rounded-lg bg-secondary/30">
                <p className="text-sm font-medium mb-2">User Message:</p>
                <p className="text-sm">{selectedTicket?.message}</p>
              </div>

              {/* Existing Response */}
              {selectedTicket?.response && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                  <p className="text-sm font-medium mb-2 text-accent">Staff Response:</p>
                  <p className="text-sm">{selectedTicket.response}</p>
                </div>
              )}

              {/* Response Form */}
              {selectedTicket?.status !== "closed" && (
                <>
                  <Textarea
                    placeholder="Type your response..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={4}
                  />
                  <div className="flex gap-2 justify-end">
                    <Select
                      onValueChange={(status) => updateStatus.mutate({ ticketId: selectedTicket.id, status })}
                    >
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Update status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => respondToTicket.mutate({ 
                        ticketId: selectedTicket.id, 
                        response, 
                        status: "resolved" 
                      })}
                      disabled={!response.trim()}
                    >
                      <Send className="w-4 h-4 mr-1" />
                      Send Response
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default StaffTickets;
