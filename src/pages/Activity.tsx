import { ArrowUpRight, ArrowDownRight, Users, ArrowLeftRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useTransactions } from "@/hooks/useTransactions";
import { useTransfers } from "@/hooks/useTransfers";
import { useCurrency } from "@/contexts/CurrencyContext";
import { format } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";

const Activity = () => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>("all");
  const { data: transactions, isLoading: txLoading } = useTransactions(50);
  const { data: transfers, isLoading: transfersLoading } = useTransfers(50);
  const { formatAmount } = useCurrency();

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "withdrawal":
        return <ArrowUpRight className="w-4 h-4 text-destructive" />;
      case "bonus":
        return <Users className="w-4 h-4 text-accent" />;
      case "transfer":
        return <ArrowLeftRight className="w-4 h-4 text-primary" />;
      default:
        return <ArrowDownRight className="w-4 h-4 text-accent" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "withdrawal":
        return "bg-destructive/20";
      case "bonus":
        return "bg-accent/20";
      case "transfer":
        return "bg-primary/20";
      default:
        return "bg-secondary";
    }
  };

  const filteredTransactions = transactions?.filter((tx) => {
    if (filter === "all") return true;
    return tx.transaction_type === filter;
  });

  const isLoading = txLoading || transfersLoading;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t("activity.title")}</h1>
            <p className="text-muted-foreground mt-1">{t("activity.subtitle")}</p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder={t("common.filter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("activity.allActivity")}</SelectItem>
                <SelectItem value="investment">{t("activity.investments")}</SelectItem>
                <SelectItem value="withdrawal">{t("activity.withdrawals")}</SelectItem>
                <SelectItem value="bonus">{t("activity.bonuses")}</SelectItem>
                <SelectItem value="transfer">{t("activity.transfers")}</SelectItem>
                <SelectItem value="deposit">{t("activity.deposits")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-6 rounded-md border border-border bg-card">
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-secondary/30 animate-pulse rounded-md" />
              ))
            ) : filteredTransactions && filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-md bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTransactionColor(tx.transaction_type)}`}>
                      {getTransactionIcon(tx.transaction_type)}
                    </div>
                    <div>
                      <div className="font-medium">{tx.description || tx.transaction_type}</div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(tx.created_at), "MMM dd, yyyy • h:mm a")}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-semibold ${
                      tx.transaction_type === "withdrawal" ? "text-destructive" : "text-accent"
                    }`}>
                      {tx.transaction_type === "withdrawal" ? "-" : "+"}{formatAmount(Number(tx.amount))}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {tx.status || "completed"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t("activity.noActivity")}</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => window.location.href = "/dashboard/investments"}
                >
                  {t("activity.makeFirstInvestment")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Activity;
