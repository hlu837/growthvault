import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type WalletType = 
  | "savings" 
  | "mlm_capital" 
  | "trading_principal" 
  | "mlm_bonus" 
  | "loan"
  | "prudent_saving"
  | "golden_saving"
  | "projects_saving"
  | "future_saving"
  | "loans_saving";

export interface Wallet {
  id: string;
  user_id: string;
  wallet_type: WalletType;
  total_balance: number;
  available_balance: number;
  locked_balance: number;
  is_locked: boolean;
}

export const useWallets = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["wallets", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Use new get_wallet_details function to get locking information
      const { data, error } = await (supabase.rpc as any)("get_wallet_details", {
        p_user_id: user.id
      });

      if (error) throw error;
      return (data ?? []) as Wallet[];
    },
    enabled: !!user,
  });
};

export const getWalletBalance = (
  wallets: Wallet[] | null | undefined,
  type: WalletType
): number => {
  if (!wallets) return 0;
  const wallet = wallets.find((w) => w.wallet_type === type);
  return wallet?.available_balance ?? 0;
};

export const getWalletTotalBalance = (
  wallets: Wallet[] | null | undefined,
  type: WalletType
): number => {
  if (!wallets) return 0;
  const wallet = wallets.find((w) => w.wallet_type === type);
  return wallet?.total_balance ?? 0;
};

export const getWalletLockedBalance = (
  wallets: Wallet[] | null | undefined,
  type: WalletType
): number => {
  if (!wallets) return 0;
  const wallet = wallets.find((w) => w.wallet_type === type);
  return wallet?.locked_balance ?? 0;
};

export const isWalletLocked = (
  wallets: Wallet[] | null | undefined,
  type: WalletType
): boolean => {
  if (!wallets) return false;
  const wallet = wallets.find((w) => w.wallet_type === type);
  return wallet?.is_locked ?? false;
};

export const walletDisplayNames: Record<WalletType, string> = {
  savings: "Savings",
  mlm_capital: "MLM Capital",
  trading_principal: "Investment Principal",
  mlm_bonus: "MLM Bonus",
  loan: "Loan",
  prudent_saving: "Prudent Saving",
  golden_saving: "Golden Saving",
  projects_saving: "Projects Saving",
  future_saving: "Future Saving",
  loans_saving: "Loans Saving",
};