import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface EarlyWithdrawalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  balance: number;
  penaltyPercentage: number;
  penaltyAmount: number;
  netAmount: number;
  maturityDate: string;
  isLoading?: boolean;
}

const EarlyWithdrawalModal = ({
  open,
  onOpenChange,
  onConfirm,
  balance,
  penaltyPercentage,
  penaltyAmount,
  netAmount,
  maturityDate,
  isLoading,
}: EarlyWithdrawalModalProps) => {
  const { formatAmount } = useCurrency();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-warning/50 bg-card">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <AlertDialogTitle className="text-xl">
              Early Withdrawal Warning
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-muted-foreground">
              <p>
                This vault matures on{" "}
                <span className="font-mono text-foreground font-medium">
                  {format(new Date(maturityDate), "MMMM d, yyyy")}
                </span>
                . Withdrawing now incurs a{" "}
                <span className="font-mono text-warning font-bold">
                  {(penaltyPercentage * 100).toFixed(0)}%
                </span>{" "}
                penalty.
              </p>

              <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Current Balance</span>
                  <span className="font-mono font-semibold text-foreground">
                    {formatAmount(balance)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-warning">
                  <span className="text-sm">Penalty ({(penaltyPercentage * 100).toFixed(0)}%)</span>
                  <span className="font-mono font-semibold">
                    -{formatAmount(penaltyAmount)}
                  </span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between items-center">
                  <span className="text-sm font-medium text-foreground">You Will Receive</span>
                  <span className="font-mono font-bold text-lg text-accent">
                    {formatAmount(netAmount)}
                  </span>
                </div>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-warning text-warning-foreground hover:bg-warning/90"
          >
            {isLoading ? "Processing..." : "Confirm & Pay Penalty"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default EarlyWithdrawalModal;
