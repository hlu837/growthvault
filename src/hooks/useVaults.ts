import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { WalletType } from "./useWallets";

export interface SavingsVault {
  id: string;
  user_id: string;
  wallet_type: WalletType;
  vault_name: string;
  balance: number;
  target_amount: number | null;
  maturity_date: string | null;
  is_locked: boolean;
  recurring_frequency: "daily" | "weekly" | "monthly" | "manual" | null;
  recurring_amount: number;
  penalty_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface CreateVaultParams {
  wallet_type: WalletType;
  vault_name: string;
  target_amount?: number;
  maturity_date?: string;
  recurring_frequency?: "daily" | "weekly" | "monthly" | "manual";
  recurring_amount?: number;
  penalty_percentage?: number;
}

export interface WithdrawResult {
  requires_confirmation?: boolean;
  is_early?: boolean;
  balance?: number;
  penalty_percentage?: number;
  penalty_amount?: number;
  net_amount?: number;
  maturity_date?: string;
  success?: boolean;
  withdrawn_amount?: number;
}

export const useVaults = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["savings_vaults", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings_vaults")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SavingsVault[];
    },
    enabled: !!user,
  });
};

export const useCreateVault = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateVaultParams) => {
      // Use secure RPC for vault creation with server-side validation
      const { data, error } = await supabase.rpc("create_savings_vault", {
        p_wallet_type: params.wallet_type,
        p_vault_name: params.vault_name,
        p_target_amount: params.target_amount || null,
        p_maturity_date: params.maturity_date || null,
        p_recurring_frequency: params.recurring_frequency || "manual",
        p_recurring_amount: params.recurring_amount || 0,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_vaults"] });
    },
  });
};

export interface UpdateVaultMetadataParams {
  vaultId: string;
  vault_name?: string;
  target_amount?: number;
  recurring_frequency?: "daily" | "weekly" | "monthly" | "manual";
  recurring_amount?: number;
}

export const useUpdateVault = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateVaultMetadataParams) => {
      // Use secure RPC for vault updates - only allows safe metadata fields
      const { data, error } = await supabase.rpc("update_vault_metadata", {
        p_vault_id: params.vaultId,
        p_vault_name: params.vault_name || null,
        p_target_amount: params.target_amount || null,
        p_recurring_frequency: params.recurring_frequency || null,
        p_recurring_amount: params.recurring_amount ?? null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_vaults"] });
    },
  });
};

export const useDepositToVault = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vaultId, amount }: { vaultId: string; amount: number }) => {
      const { data, error } = await supabase.rpc("deposit_to_vault", {
        p_vault_id: vaultId,
        p_amount: amount,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_vaults"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
    },
  });
};

export const useWithdrawFromVault = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      vaultId,
      forceEarly = false,
    }: {
      vaultId: string;
      forceEarly?: boolean;
    }): Promise<WithdrawResult> => {
      const { data, error } = await supabase.rpc("process_vault_withdrawal", {
        p_vault_id: vaultId,
        p_force_early: forceEarly,
      });

      if (error) throw error;
      return data as WithdrawResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_vaults"] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
};

export const useDeleteVault = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vaultId: string) => {
      const { error } = await supabase
        .from("savings_vaults")
        .delete()
        .eq("id", vaultId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["savings_vaults"] });
    },
  });
};

// APY rates per vault/wallet type (base rates)
export const VAULT_APY_RATES: Record<string, number> = {
  prudent_saving: 0.10,   // 10% APY
  golden_saving: 0.15,    // 15% APY
  projects_saving: 0.12,  // 12% APY
  future_saving: 0.18,    // 18% APY
  loans_saving: 0.08,     // 8% APY
};

export const getVaultAPY = (walletType: string, multiplier: number = 1.0): number => {
  const base = VAULT_APY_RATES[walletType] ?? 0.10;
  return base * multiplier;
};

// Hook to fetch the global APY multiplier from system_settings
export const useGlobalAPYMultiplier = () => {
  return useQuery({
    queryKey: ["global_apy_multiplier"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("setting_value")
        .eq("setting_key", "global_apy_multiplier")
        .maybeSingle();

      if (error) throw error;
      return Number(data?.setting_value ?? 1);
    },
    staleTime: 60000, // cache for 1 minute
  });
};

// Helper to calculate days until maturity
export const getDaysUntilMaturity = (maturityDate: string | null): number | null => {
  if (!maturityDate) return null;
  const now = new Date();
  const maturity = new Date(maturityDate);
  const diff = maturity.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

// Helper to get maturity progress (0-100)
export const getMaturityProgress = (createdAt: string, maturityDate: string | null): number => {
  if (!maturityDate) return 100;
  const start = new Date(createdAt).getTime();
  const end = new Date(maturityDate).getTime();
  const now = Date.now();
  
  if (now >= end) return 100;
  if (now <= start) return 0;
  
  return Math.round(((now - start) / (end - start)) * 100);
};

// Check if vault is matured
export const isVaultMatured = (maturityDate: string | null): boolean => {
  if (!maturityDate) return true;
  return new Date(maturityDate) <= new Date();
};

// Calculate days elapsed since vault creation
export const getDaysElapsed = (createdAt: string): number => {
  const start = new Date(createdAt).getTime();
  const now = Date.now();
  return Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
};

// Calculate estimated daily profit
export const getDailyProfit = (balance: number, walletType: string, multiplier: number = 1.0): number => {
  const apy = getVaultAPY(walletType, multiplier);
  return balance * (apy / 365);
};

// Calculate total accrued profit since creation
export const getTotalAccruedProfit = (balance: number, walletType: string, createdAt: string, multiplier: number = 1.0): number => {
  const apy = getVaultAPY(walletType, multiplier);
  const daysElapsed = getDaysElapsed(createdAt);
  return balance * (apy / 365) * daysElapsed;
};

// Get total payout at maturity (principal + interest)
export const getMaturityPayout = (balance: number, walletType: string, createdAt: string, maturityDate: string | null, multiplier: number = 1.0): number => {
  if (!maturityDate) return balance;
  const apy = getVaultAPY(walletType, multiplier);
  const start = new Date(createdAt).getTime();
  const end = new Date(maturityDate).getTime();
  const totalDays = Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
  return balance + (balance * (apy / 365) * totalDays);
};
