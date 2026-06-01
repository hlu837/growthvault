import { CheckCircle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface KYCStatusBadgeProps {
  status: string | undefined | null;
  className?: string;
}

const KYCStatusBadge = ({ status, className }: KYCStatusBadgeProps) => {
  switch (status) {
    case "approved":
      return (
        <span 
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-sm",
            "bg-accent/20 text-accent border-[0.5px] border-accent/30",
            className
          )}
        >
          <CheckCircle className="w-3 h-3" />
          Verified
        </span>
      );
    case "pending":
      return (
        <span 
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-sm",
            "bg-warning/20 text-warning border-[0.5px] border-warning/30",
            className
          )}
        >
          <Clock className="w-3 h-3" />
          Under Review
        </span>
      );
    default:
      return (
        <span 
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-sm",
            "bg-destructive/20 text-destructive border-[0.5px] border-destructive/30",
            className
          )}
        >
          <AlertCircle className="w-3 h-3" />
          Unverified
        </span>
      );
  }
};

export default KYCStatusBadge;