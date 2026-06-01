import { useState } from "react";
import { 
  MessageSquare, 
  Search, 
  Clock, 
  CheckCircle,
  User,
  Send,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AdminTickets = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "resolved" | "closed">("open");
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [response, setResponse] = useState("");
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch tickets
  const { data: tickets, isLoading } = useQuery({
    queryKey: ["admin-tickets", filter],
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
    enabled: isAdmin,
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
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast.success("Response sent");
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
      queryClient.invalidateQueries({ queryKey: ["admin-tickets"] });
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
      case "urgent": return "bg-red-500/10 text-red-400 border-red-500/30";
      case "high": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "normal": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      default: return "bg-slate-800 text-slate-400";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "in_progress": return "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";
      case "resolved": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "closed": return "bg-slate-800 text-slate-400";
      default: return "";
    }
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Admin Access Only</h1>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 font-mono">
            <MessageSquare className="w-3 h-3" />
            SUPPORT TICKETS
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Customer Support Queue
          </h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <button
            onClick={() => setFilter("open")}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              filter === "open" ? "border-amber-500/50 bg-amber-500/10" : "border-slate-800 bg-slate-950/50"
            )}
          >
            <div className="text-2xl font-bold font-mono text-amber-400">{stats.open}</div>
            <div className="text-sm text-slate-500">Open</div>
          </button>
          <button
            onClick={() => setFilter("in_progress")}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              filter === "in_progress" ? "border-cyan-500/50 bg-cyan-500/10" : "border-slate-800 bg-slate-950/50"
            )}
          >
            <div className="text-2xl font-bold font-mono text-cyan-400">{stats.in_progress}</div>
            <div className="text-sm text-slate-500">In Progress</div>
          </button>
          <button
            onClick={() => setFilter("resolved")}
            className={cn(
              "p-4 rounded-lg border text-left transition-all",
              filter === "resolved" ? "border-emerald-500/50 bg-emerald-500/10" : "border-slate-800 bg-slate-950/50"
            )}
          >
            <div className="text-2xl font-bold font-mono text-emerald-400">{stats.resolved}</div>
            <div className="text-sm text-slate-500">Resolved</div>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search by subject, name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Tickets List */}
        <div className="bg-slate-950/50 border border-slate-800 rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500">
              <MessageSquare className="w-12 h-12 mb-4 opacity-30" />
              <p>No tickets found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredTickets.map((ticket: any) => (
                <div 
                  key={ticket.id}
                  className="p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:bg-slate-900/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(ticket.status)}>
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-white mb-1">{ticket.subject}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <User className="w-3 h-3" />
                      {ticket.profiles?.full_name || ticket.profiles?.email}
                    </div>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">
                      {ticket.message}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <p className="text-xs text-slate-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(ticket.created_at).toLocaleDateString()}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-slate-700 text-slate-300"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <MessageSquare className="w-4 h-4 mr-1" />
                      {ticket.response ? "View" : "Respond"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ticket Dialog */}
        <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
          <DialogContent className="max-w-2xl bg-slate-950 border-slate-800">
            <DialogHeader>
              <DialogTitle className="text-white">{selectedTicket?.subject}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <User className="w-4 h-4" />
                {selectedTicket?.profiles?.full_name} ({selectedTicket?.profiles?.email})
              </div>

              <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
                <p className="text-sm font-medium text-slate-400 mb-2">Message:</p>
                <p className="text-sm text-white">{selectedTicket?.message}</p>
              </div>

              {selectedTicket?.response && (
                <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <p className="text-sm font-medium text-emerald-400 mb-2">Response:</p>
                  <p className="text-sm text-white">{selectedTicket.response}</p>
                </div>
              )}

              {selectedTicket?.status !== "closed" && (
                <>
                  <Textarea
                    placeholder="Type your response..."
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    rows={4}
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                  <div className="flex gap-2 justify-end">
                    <Select
                      onValueChange={(status) => updateStatus.mutate({ ticketId: selectedTicket.id, status })}
                    >
                      <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white">
                        <SelectValue placeholder="Update status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        <SelectItem value="open" className="text-white">Open</SelectItem>
                        <SelectItem value="in_progress" className="text-white">In Progress</SelectItem>
                        <SelectItem value="resolved" className="text-white">Resolved</SelectItem>
                        <SelectItem value="closed" className="text-white">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={() => respondToTicket.mutate({ 
                        ticketId: selectedTicket.id, 
                        response, 
                        status: "resolved" 
                      })}
                      disabled={!response.trim() || respondToTicket.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
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
    </AdminLayout>
  );
};

export default AdminTickets;
