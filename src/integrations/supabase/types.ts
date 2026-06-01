export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          card_name: string
          card_number: string | null
          card_type: string
          created_at: string
          expires_at: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_name?: string
          card_number?: string | null
          card_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_name?: string
          card_number?: string | null
          card_type?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deposits: {
        Row: {
          amount: number
          bank_reference: string | null
          created_at: string | null
          id: string
          proof_url: string | null
          rejection_reason: string | null
          status: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          bank_reference?: string | null
          created_at?: string | null
          id?: string
          proof_url?: string | null
          rejection_reason?: string | null
          status?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          bank_reference?: string | null
          created_at?: string | null
          id?: string
          proof_url?: string | null
          rejection_reason?: string | null
          status?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          base_currency: string
          id: string
          rate: number
          target_currency: string
          updated_at: string
        }
        Insert: {
          base_currency?: string
          id?: string
          rate: number
          target_currency: string
          updated_at?: string
        }
        Update: {
          base_currency?: string
          id?: string
          rate?: number
          target_currency?: string
          updated_at?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          auto_action_taken: string | null
          created_at: string
          flags: Json
          id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk_score: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_action_taken?: string | null
          created_at?: string
          flags?: Json
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_action_taken?: string | null
          created_at?: string
          flags?: Json
          id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk_score?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_audit_log: {
        Row: {
          changed_by: string
          created_at: string | null
          id: string
          new_status: string
          previous_status: string | null
          rejection_reason: string | null
          user_id: string
        }
        Insert: {
          changed_by: string
          created_at?: string | null
          id?: string
          new_status: string
          previous_status?: string | null
          rejection_reason?: string | null
          user_id: string
        }
        Update: {
          changed_by?: string
          created_at?: string | null
          id?: string
          new_status?: string
          previous_status?: string | null
          rejection_reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      platform_fees: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          fee_type: string
          id: string
          user_id: string
          vault_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          user_id: string
          vault_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          fee_type?: string
          id?: string
          user_id?: string
          vault_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_fees_vault_id_fkey"
            columns: ["vault_id"]
            isOneToOne: false
            referencedRelation: "savings_vaults"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          bvn_number: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          id_number: string | null
          id_type: string | null
          investment_tier: Database["public"]["Enums"]["investment_tier"] | null
          is_frozen: boolean | null
          is_system_account: boolean | null
          kyc_document_url: string | null
          kyc_status: string | null
          kyc_submitted_at: string | null
          passport_url: string | null
          preferred_currency: string
          referral_code: string | null
          referred_by: string | null
          selfie_url: string | null
          updated_at: string | null
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          bvn_number?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          id_number?: string | null
          id_type?: string | null
          investment_tier?:
            | Database["public"]["Enums"]["investment_tier"]
            | null
          is_frozen?: boolean | null
          is_system_account?: boolean | null
          kyc_document_url?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          passport_url?: string | null
          preferred_currency?: string
          referral_code?: string | null
          referred_by?: string | null
          selfie_url?: string | null
          updated_at?: string | null
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          bvn_number?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          id_number?: string | null
          id_type?: string | null
          investment_tier?:
            | Database["public"]["Enums"]["investment_tier"]
            | null
          is_frozen?: boolean | null
          is_system_account?: boolean | null
          kyc_document_url?: string | null
          kyc_status?: string | null
          kyc_submitted_at?: string | null
          passport_url?: string | null
          preferred_currency?: string
          referral_code?: string | null
          referred_by?: string | null
          selfie_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string | null
          earnings: number | null
          id: string
          level: number | null
          referred_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string | null
          earnings?: number | null
          id?: string
          level?: number | null
          referred_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string | null
          earnings?: number | null
          id?: string
          level?: number | null
          referred_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      savings_vaults: {
        Row: {
          balance: number
          created_at: string
          id: string
          is_locked: boolean
          maturity_date: string | null
          penalty_percentage: number
          recurring_amount: number | null
          recurring_frequency: string | null
          target_amount: number | null
          updated_at: string
          user_id: string
          vault_name: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          is_locked?: boolean
          maturity_date?: string | null
          penalty_percentage?: number
          recurring_amount?: number | null
          recurring_frequency?: string | null
          target_amount?: number | null
          updated_at?: string
          user_id: string
          vault_name?: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          is_locked?: boolean
          maturity_date?: string | null
          penalty_percentage?: number
          recurring_amount?: number | null
          recurring_frequency?: string | null
          target_amount?: number | null
          updated_at?: string
          user_id?: string
          vault_name?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          id: string
          message: string
          priority: string | null
          responded_at: string | null
          responded_by: string | null
          response: string | null
          status: string
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          message: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          id?: string
          message?: string
          priority?: string | null
          responded_at?: string | null
          responded_by?: string | null
          response?: string | null
          status?: string
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: number
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: number
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      system_settings_history: {
        Row: {
          change_reason: string | null
          changed_by: string
          created_at: string | null
          id: string
          new_value: number
          old_value: number | null
          setting_key: string
        }
        Insert: {
          change_reason?: string | null
          changed_by: string
          created_at?: string | null
          id?: string
          new_value: number
          old_value?: number | null
          setting_key: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string
          created_at?: string | null
          id?: string
          new_value?: number
          old_value?: number | null
          setting_key?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          amount_mlm: number | null
          amount_trading: number | null
          created_at: string | null
          description: string | null
          id: string
          status: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          amount_mlm?: number | null
          amount_trading?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          amount_mlm?: number | null
          amount_trading?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          status?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: []
      }
      transfers: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          from_wallet_type: Database["public"]["Enums"]["wallet_type"]
          id: string
          recipient_id: string | null
          sender_id: string
          status: string
          to_wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          from_wallet_type: Database["public"]["Enums"]["wallet_type"]
          id?: string
          recipient_id?: string | null
          sender_id: string
          status?: string
          to_wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          from_wallet_type?: Database["public"]["Enums"]["wallet_type"]
          id?: string
          recipient_id?: string | null
          sender_id?: string
          status?: string
          to_wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bank_details: Json | null
          created_at: string | null
          id: string
          rejection_reason: string | null
          status: string
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json | null
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          user_id: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bank_details?: Json | null
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          user_id?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_balance: {
        Args: {
          p_amount: number
          p_reason: string
          p_user_id: string
          p_wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: boolean
      }
      approve_deposit_and_credit: {
        Args: {
          p_deposit_id: string
          p_tier?: Database["public"]["Enums"]["investment_tier"]
        }
        Returns: boolean
      }
      approve_kyc: {
        Args: { p_new_status: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      approve_withdrawal: {
        Args: { p_withdrawal_id: string }
        Returns: boolean
      }
      create_savings_vault: {
        Args: {
          p_maturity_date?: string
          p_recurring_amount?: number
          p_recurring_frequency?: string
          p_target_amount?: number
          p_vault_name: string
          p_wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: string
      }
      deposit_to_vault: {
        Args: { p_amount: number; p_vault_id: string }
        Returns: boolean
      }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_staff: { Args: { _user_id: string }; Returns: boolean }
      process_investment: {
        Args: {
          p_amount: number
          p_tier: Database["public"]["Enums"]["investment_tier"]
          p_user_id: string
        }
        Returns: string
      }
      process_vault_withdrawal: {
        Args: { p_force_early?: boolean; p_vault_id: string }
        Returns: Json
      }
      process_wallet_transfer: {
        Args: {
          p_amount: number
          p_description?: string
          p_from_wallet_type: Database["public"]["Enums"]["wallet_type"]
          p_recipient_id?: string
          p_to_wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Returns: string
      }
      reject_withdrawal: {
        Args: { p_reason: string; p_withdrawal_id: string }
        Returns: boolean
      }
      staff_update_account_status: {
        Args: {
          p_new_status: Database["public"]["Enums"]["account_status"]
          p_user_id: string
        }
        Returns: boolean
      }
      update_system_setting: {
        Args: { p_new_value: number; p_reason?: string; p_setting_key: string }
        Returns: boolean
      }
      update_vault_metadata: {
        Args: {
          p_recurring_amount?: number
          p_recurring_frequency?: string
          p_target_amount?: number
          p_vault_id: string
          p_vault_name?: string
        }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "active" | "suspended" | "blacklisted" | "under_review"
      app_role: "admin" | "staff" | "member"
      investment_tier:
        | "starter"
        | "golden"
        | "premium"
        | "business"
        | "platinum"
        | "achiever"
      transaction_type:
        | "investment"
        | "withdrawal"
        | "bonus"
        | "loan"
        | "transfer"
      wallet_type:
        | "savings"
        | "mlm_capital"
        | "trading_principal"
        | "mlm_bonus"
        | "loan"
        | "prudent_saving"
        | "golden_saving"
        | "projects_saving"
        | "future_saving"
        | "loans_saving"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "blacklisted", "under_review"],
      app_role: ["admin", "staff", "member"],
      investment_tier: [
        "starter",
        "golden",
        "premium",
        "business",
        "platinum",
        "achiever",
      ],
      transaction_type: [
        "investment",
        "withdrawal",
        "bonus",
        "loan",
        "transfer",
      ],
      wallet_type: [
        "savings",
        "mlm_capital",
        "trading_principal",
        "mlm_bonus",
        "loan",
        "prudent_saving",
        "golden_saving",
        "projects_saving",
        "future_saving",
        "loans_saving",
      ],
    },
  },
} as const
