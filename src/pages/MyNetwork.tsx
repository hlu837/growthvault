import { useState } from "react";
import { Users, ChevronDown, ChevronRight, User, ArrowUp, ArrowDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useUpline, useDownline, useTeamSize, NetworkMember } from "@/hooks/useNetwork";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const LEVEL_COLORS = [
  "bg-accent/20 text-accent border-accent/30",
  "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "bg-rose-500/20 text-rose-400 border-rose-500/30",
];

const LEVEL_LABELS = ["Level 1 — Direct", "Level 2", "Level 3", "Level 4", "Level 5"];

const MyNetwork = () => {
  const [view, setView] = useState<"downline" | "upline">("downline");
  const [expandedLevels, setExpandedLevels] = useState<Set<number>>(new Set([1]));
  const { profile } = useAuth();
  const { data: upline, isLoading: uplineLoading } = useUpline();
  const { data: downline, isLoading: downlineLoading } = useDownline();
  const { data: teamSize, isLoading: teamSizeLoading } = useTeamSize();

  const toggleLevel = (level: number) => {
    setExpandedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  // Group downline by level
  const downlineByLevel: Record<number, NetworkMember[]> = {};
  downline?.forEach((m) => {
    if (!downlineByLevel[m.level]) downlineByLevel[m.level] = [];
    downlineByLevel[m.level].push(m);
  });

  const isLoading = view === "downline" ? downlineLoading : uplineLoading;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Network</h1>
            <p className="text-muted-foreground mt-1">
              View your 5-level referral tree and team structure.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-4 rounded-md border border-border bg-card text-center min-w-[120px]">
              <div className="text-2xl font-bold font-mono">
                {teamSizeLoading ? (
                  <div className="h-8 w-12 mx-auto bg-secondary animate-pulse rounded" />
                ) : (
                  teamSize ?? 0
                )}
              </div>
              <div className="text-xs text-muted-foreground">Total Team Size</div>
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={view === "downline" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("downline")}
            className="gap-2"
          >
            <ArrowDown className="w-4 h-4" />
            My Downline
          </Button>
          <Button
            variant={view === "upline" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("upline")}
            className="gap-2"
          >
            <ArrowUp className="w-4 h-4" />
            My Upline
          </Button>
        </div>

        {/* You (root) */}
        <div className="p-4 rounded-md border-2 border-foreground/20 bg-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{profile?.full_name || "You"}</div>
            <div className="text-xs text-muted-foreground">{profile?.email}</div>
          </div>
          <Badge variant="outline" className="font-mono">YOU</Badge>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : view === "downline" ? (
          /* Downline Tree */
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((level) => {
              const members = downlineByLevel[level] || [];
              const isExpanded = expandedLevels.has(level);

              return (
                <div key={level} className="rounded-md border border-border bg-card overflow-hidden">
                  {/* Level Header */}
                  <button
                    onClick={() => toggleLevel(level)}
                    className="w-full p-4 flex items-center justify-between hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className="font-semibold text-sm">{LEVEL_LABELS[level - 1]}</span>
                      <Badge
                        variant="outline"
                        className={cn("font-mono text-xs", LEVEL_COLORS[level - 1])}
                      >
                        {members.length} {members.length === 1 ? "member" : "members"}
                      </Badge>
                    </div>
                    {/* Visual depth indicator */}
                    <div className="flex gap-1">
                      {Array.from({ length: level }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-2 h-2 rounded-full",
                            i < level ? "bg-accent/60" : "bg-secondary"
                          )}
                        />
                      ))}
                    </div>
                  </button>

                  {/* Members List */}
                  {isExpanded && (
                    <div className="border-t border-border divide-y divide-border">
                      {members.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                          No members at this level yet
                        </div>
                      ) : (
                        members.map((member) => (
                          <div
                            key={member.user_id}
                            className="p-4 flex items-center gap-4 hover:bg-secondary/20 transition-colors"
                            style={{ paddingLeft: `${level * 12 + 16}px` }}
                          >
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium">
                                {member.full_name
                                  ?.split(" ")
                                  .map((n) => n[0])
                                  .join("") || "??"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {member.full_name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {member.email}
                              </div>
                            </div>
                            <div className="text-right hidden sm:block">
                              <div className="text-xs text-muted-foreground">Tier</div>
                              <div className="text-sm">{member.investment_tier || "Bronze"}</div>
                            </div>
                            {member.joined_at && (
                              <div className="text-right hidden md:block">
                                <div className="text-xs text-muted-foreground">Joined</div>
                                <div className="text-sm">
                                  {format(new Date(member.joined_at), "MMM dd, yyyy")}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Upline Chain */
          <div className="space-y-3">
            {!upline || upline.length === 0 ? (
              <div className="p-8 text-center rounded-md border border-border bg-card">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground">No upline found</p>
              </div>
            ) : (
              upline.map((member, idx) => (
                <div
                  key={member.user_id}
                  className="p-4 rounded-md border border-border bg-card flex items-center gap-4"
                  style={{ marginLeft: `${idx * 20}px` }}
                >
                  <div className="flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-muted-foreground" />
                    <Badge
                      variant="outline"
                      className={cn("font-mono text-xs", LEVEL_COLORS[idx] || LEVEL_COLORS[4])}
                    >
                      L{member.level}
                    </Badge>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium">
                      {member.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("") || "??"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">
                      {member.full_name || "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {member.email}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground hidden sm:block">
                    {member.investment_tier || "Bronze"}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Commission Structure */}
        <div className="p-4 rounded-md border border-border bg-card">
          <h3 className="font-semibold mb-3">Commission Structure</h3>
          <div className="grid grid-cols-5 gap-2">
            {[
              { level: 1, rate: "5%" },
              { level: 2, rate: "3%" },
              { level: 3, rate: "2%" },
              { level: 4, rate: "1%" },
              { level: 5, rate: "0.5%" },
            ].map((item) => (
              <div key={item.level} className="text-center p-3 rounded-md bg-secondary/50">
                <div className="text-xs text-muted-foreground mb-1">Level {item.level}</div>
                <div className="font-mono font-bold text-accent">{item.rate}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default MyNetwork;
