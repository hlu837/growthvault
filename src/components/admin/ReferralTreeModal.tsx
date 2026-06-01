import { useState, useEffect } from "react";
import { Users, ChevronRight, ChevronDown, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getTierDisplayName } from "@/lib/utils";

interface ReferralNode {
  id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  investment_tier: string | null;
  created_at: string | null;
  is_system_account?: boolean;
  children: ReferralNode[];
}

interface ReferralTreeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const ReferralTreeNode = ({ node, level = 0 }: { node: ReferralNode; level?: number }) => {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div className="select-none">
      <div 
        className={`flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors ${
          level === 0 ? "bg-primary/10 border border-primary/30" : ""
        }`}
        style={{ marginLeft: level * 20 }}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}
        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {node.full_name || "Unknown User"}
            {node.is_system_account && (
              <span className="ml-2 text-xs text-cyan-400 font-mono">[SYSTEM]</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground truncate">{node.email}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          {getTierDisplayName(node.investment_tier)}
        </Badge>
        {hasChildren && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            {node.children.length} referrals
          </Badge>
        )}
      </div>
      {expanded && hasChildren && (
        <div className="border-l border-border ml-5 mt-1">
          {node.children.map((child) => (
            <ReferralTreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const ReferralTreeModal = ({ open, onOpenChange, userId, userName }: ReferralTreeModalProps) => {
  const [loading, setLoading] = useState(true);
  const [tree, setTree] = useState<ReferralNode | null>(null);
  const [stats, setStats] = useState({ total: 0, levels: new Map<number, number>() });

  useEffect(() => {
    if (open && userId) {
      fetchReferralTree();
    }
  }, [open, userId]);

  const fetchReferralTree = async () => {
    setLoading(true);
    try {
      // Fetch root user
      const { data: rootUser } = await supabase
        .from("profiles")
        .select("id, full_name, email, referral_code, investment_tier, created_at, is_system_account")
        .eq("id", userId)
        .single();

      if (!rootUser) return;

      // Recursive function to build tree
      const buildTree = async (parentId: string, level: number): Promise<ReferralNode[]> => {
        const { data: referrals } = await supabase
          .from("referrals")
          .select("referred_id")
          .eq("referrer_id", parentId);

        if (!referrals || referrals.length === 0) return [];

        const children: ReferralNode[] = [];
        for (const ref of referrals) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, full_name, email, referral_code, investment_tier, created_at, is_system_account")
            .eq("id", ref.referred_id)
            .single();

          if (profile) {
            const grandChildren = level < 5 ? await buildTree(profile.id, level + 1) : [];
            children.push({
              ...profile,
              children: grandChildren,
            });
          }
        }
        return children;
      };

      const children = await buildTree(userId, 1);
      
      // Calculate stats
      let total = 0;
      const levels = new Map<number, number>();
      
      const countNodes = (nodes: ReferralNode[], level: number) => {
        nodes.forEach((node) => {
          total++;
          levels.set(level, (levels.get(level) || 0) + 1);
          countNodes(node.children, level + 1);
        });
      };
      
      countNodes(children, 1);
      
      setTree({
        ...rootUser,
        children,
      });
      setStats({ total, levels });
    } catch (error) {
      console.error("Failed to fetch referral tree:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Referral Tree: {userName}
          </DialogTitle>
          <DialogDescription>
            View the complete downline hierarchy and referral structure.
          </DialogDescription>
        </DialogHeader>

        {/* Stats Summary */}
        <div className="flex gap-4 py-3 border-b border-border">
          <div>
            <p className="text-2xl font-bold font-mono">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total Referrals</p>
          </div>
          {Array.from(stats.levels.entries()).slice(0, 5).map(([level, count]) => (
            <div key={level} className="border-l border-border pl-4">
              <p className="text-lg font-bold font-mono">{count}</p>
              <p className="text-xs text-muted-foreground">Level {level}</p>
            </div>
          ))}
        </div>

        {/* Tree View */}
        <div className="flex-1 overflow-y-auto py-4 space-y-1">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" style={{ marginLeft: i * 20 }} />
              ))}
            </div>
          ) : tree ? (
            <ReferralTreeNode node={tree} />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No referral data found</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferralTreeModal;
