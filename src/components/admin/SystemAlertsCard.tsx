import { AlertTriangle, TrendingDown, Clock, Users, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  icon: React.ReactNode;
}

interface SystemAlertsCardProps {
  alerts: Alert[];
}

const SystemAlertsCard = ({ alerts }: SystemAlertsCardProps) => {
  if (alerts.length === 0) {
    return (
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-5 h-5 text-accent" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 text-accent">
            <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
            <span className="font-medium">All systems operational</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          System Alerts
          <Badge variant="destructive" className="ml-auto">
            {alerts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <div 
            key={alert.id}
            className={`p-3 rounded-lg border ${
              alert.type === "critical" 
                ? "bg-destructive/10 border-destructive/30" 
                : alert.type === "warning"
                ? "bg-warning/10 border-warning/30"
                : "bg-primary/10 border-primary/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${
                alert.type === "critical" 
                  ? "text-destructive" 
                  : alert.type === "warning"
                  ? "text-warning"
                  : "text-primary"
              }`}>
                {alert.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{alert.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alert.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SystemAlertsCard;
