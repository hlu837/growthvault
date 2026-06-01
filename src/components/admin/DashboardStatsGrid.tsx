import { 
  Users, 
  TrendingUp, 
  Wallet, 
  Clock, 
  DollarSign,
  UserCheck,
  PiggyBank,
  Banknote
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsData {
  totalUsers: number;
  activeUsers: number;
  totalInvestments: number;
  totalLoans: number;
  outstandingLoans: number;
  interestIncome: { daily: number; monthly: number };
  liquidityReserve: number;
  pendingWithdrawals: number;
  kycCompletionRate: number;
}

interface DashboardStatsGridProps {
  stats: StatsData | undefined;
  isLoading: boolean;
}

const DashboardStatsGrid = ({ stats, isLoading }: DashboardStatsGridProps) => {
  const statCards = [
    {
      label: "Total Users",
      value: stats?.totalUsers || 0,
      subValue: `${stats?.activeUsers || 0} active`,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      format: "number"
    },
    {
      label: "Total Investments",
      value: stats?.totalInvestments || 0,
      icon: TrendingUp,
      color: "text-accent",
      bgColor: "bg-accent/10",
      format: "currency"
    },
    {
      label: "Total Loans Disbursed",
      value: stats?.totalLoans || 0,
      icon: Banknote,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
      format: "currency"
    },
    {
      label: "Outstanding Loan Balance",
      value: stats?.outstandingLoans || 0,
      icon: DollarSign,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
      format: "currency"
    },
    {
      label: "Interest Income (Daily)",
      value: stats?.interestIncome?.daily || 0,
      subValue: `$${(stats?.interestIncome?.monthly || 0).toLocaleString()}/mo`,
      icon: PiggyBank,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
      format: "currency"
    },
    {
      label: "Liquidity Reserve",
      value: stats?.liquidityReserve || 0,
      icon: Wallet,
      color: "text-chart-4",
      bgColor: "bg-chart-4/10",
      format: "currency"
    },
    {
      label: "Pending Withdrawals",
      value: stats?.pendingWithdrawals || 0,
      icon: Clock,
      color: "text-warning",
      bgColor: "bg-warning/10",
      format: "number"
    },
    {
      label: "KYC Completion Rate",
      value: stats?.kycCompletionRate || 0,
      icon: UserCheck,
      color: "text-accent",
      bgColor: "bg-accent/10",
      format: "percent"
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full ${stat.bgColor} flex items-center justify-center shrink-0`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold font-mono truncate">
                  {stat.format === "currency" 
                    ? `$${stat.value.toLocaleString()}`
                    : stat.format === "percent"
                    ? `${stat.value.toFixed(1)}%`
                    : stat.value.toLocaleString()
                  }
                </p>
                <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
                {stat.subValue && (
                  <p className="text-xs text-muted-foreground/70">{stat.subValue}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default DashboardStatsGrid;
