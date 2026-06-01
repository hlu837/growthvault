import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FraudFlag {
  indicator: string;
  score: number;
  details: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all profiles (exclude system accounts from fraud scanning)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, kyc_status, account_status, created_at, is_frozen, is_system_account")
      .neq("is_system_account", true);

    if (profilesError) throw profilesError;

    // Fetch all referrals
    const { data: referrals } = await supabase
      .from("referrals")
      .select("referrer_id, referred_id, created_at");

    // Fetch all wallets
    const { data: wallets } = await supabase
      .from("wallets")
      .select("user_id, wallet_type, balance");

    // Fetch all transactions
    const { data: transactions } = await supabase
      .from("transactions")
      .select("user_id, transaction_type, amount, created_at");

    // Fetch all withdrawals for bank details comparison
    const { data: withdrawals } = await supabase
      .from("withdrawals")
      .select("user_id, bank_details, status");

    // Build lookup maps
    const referralsByReferrer = new Map<string, any[]>();
    const referralsByReferred = new Map<string, any[]>();
    for (const ref of referrals || []) {
      if (!referralsByReferrer.has(ref.referrer_id)) referralsByReferrer.set(ref.referrer_id, []);
      referralsByReferrer.get(ref.referrer_id)!.push(ref);
      if (!referralsByReferred.has(ref.referred_id)) referralsByReferred.set(ref.referred_id, []);
      referralsByReferred.get(ref.referred_id)!.push(ref);
    }

    const walletsByUser = new Map<string, any[]>();
    for (const w of wallets || []) {
      if (!walletsByUser.has(w.user_id)) walletsByUser.set(w.user_id, []);
      walletsByUser.get(w.user_id)!.push(w);
    }

    const transactionsByUser = new Map<string, any[]>();
    for (const t of transactions || []) {
      if (!transactionsByUser.has(t.user_id)) transactionsByUser.set(t.user_id, []);
      transactionsByUser.get(t.user_id)!.push(t);
    }

    // Build bank details index for detecting shared payout destinations
    const bankDetailsMap = new Map<string, string[]>();
    for (const w of withdrawals || []) {
      if (w.bank_details) {
        const key = JSON.stringify(w.bank_details);
        if (!bankDetailsMap.has(key)) bankDetailsMap.set(key, []);
        const users = bankDetailsMap.get(key)!;
        if (!users.includes(w.user_id)) users.push(w.user_id);
      }
    }

    // Shared bank details lookup: user -> set of users sharing same bank details
    const sharedBankUsers = new Map<string, Set<string>>();
    for (const [, users] of bankDetailsMap) {
      if (users.length > 1) {
        for (const uid of users) {
          if (!sharedBankUsers.has(uid)) sharedBankUsers.set(uid, new Set());
          for (const other of users) {
            if (other !== uid) sharedBankUsers.get(uid)!.add(other);
          }
        }
      }
    }

    const now = new Date();
    const results: { user_id: string; risk_score: number; flags: FraudFlag[]; auto_action: string | null }[] = [];

    for (const profile of profiles || []) {
      const flags: FraudFlag[] = [];
      const userReferrals = referralsByReferrer.get(profile.id) || [];
      const userWallets = walletsByUser.get(profile.id) || [];
      const userTransactions = transactionsByUser.get(profile.id) || [];
      const totalBalance = userWallets.reduce((s: number, w: any) => s + Number(w.balance || 0), 0);

      // 1. REFERRAL BURST: Many referrals in 24 hours
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentRefs = userReferrals.filter((r: any) => new Date(r.created_at) > last24h);
      if (recentRefs.length >= 5) {
        flags.push({
          indicator: "referral_burst",
          score: 20,
          details: `${recentRefs.length} referrals in last 24 hours`,
        });
      }

      // Check for burst within 1 hour
      const last1h = new Date(now.getTime() - 60 * 60 * 1000);
      const hourRefs = userReferrals.filter((r: any) => new Date(r.created_at) > last1h);
      if (hourRefs.length >= 3) {
        flags.push({
          indicator: "extreme_referral_burst",
          score: 30,
          details: `${hourRefs.length} referrals in last hour`,
        });
      }

      // 2. INACTIVE REFERRALS: Referred users with no KYC and no activity
      if (userReferrals.length >= 3) {
        const referredIds = userReferrals.map((r: any) => r.referred_id);
        const referredProfiles = (profiles || []).filter((p: any) => referredIds.includes(p.id));
        const inactiveCount = referredProfiles.filter((p: any) => {
          const refTransactions = transactionsByUser.get(p.id) || [];
          const hasNoKyc = p.kyc_status !== "approved";
          const hasNoActivity = refTransactions.length === 0;
          return hasNoKyc && hasNoActivity;
        }).length;

        if (inactiveCount >= 3) {
          flags.push({
            indicator: "inactive_referrals",
            score: 15,
            details: `${inactiveCount} of ${userReferrals.length} referrals are completely inactive (no KYC, no transactions)`,
          });
        }
      }

      // 3. SAME BANK DETAILS: Multiple accounts sharing payout destination
      const shared = sharedBankUsers.get(profile.id);
      if (shared && shared.size > 0) {
        flags.push({
          indicator: "shared_bank_details",
          score: 25,
          details: `Shares bank/payout details with ${shared.size} other account(s)`,
        });
      }

      // 4. HIGH REFERRALS, LOW ACTIVITY: Large network but no meaningful investment
      if (userReferrals.length >= 5 && totalBalance < 10) {
        flags.push({
          indicator: "high_referral_low_activity",
          score: 20,
          details: `${userReferrals.length} referrals but total balance is only $${totalBalance.toFixed(2)}`,
        });
      }

      // 5. LOAN GAMING: Gets exactly 3 referrals then low network activity
      if (userReferrals.length >= 3 && userReferrals.length <= 4) {
        const loanTransactions = userTransactions.filter((t: any) => t.transaction_type === "loan");
        if (loanTransactions.length > 0) {
          const referredIds = userReferrals.map((r: any) => r.referred_id);
          const referredProfiles = (profiles || []).filter((p: any) => referredIds.includes(p.id));
          const allInactive = referredProfiles.every((p: any) => {
            const refTx = transactionsByUser.get(p.id) || [];
            return refTx.length === 0;
          });

          if (allInactive) {
            flags.push({
              indicator: "loan_gaming",
              score: 25,
              details: `Got ${userReferrals.length} referrals (all inactive) then took a loan — possible eligibility manipulation`,
            });
          }
        }
      }

      // 6. NEW ACCOUNT RAPID ACTIVITY: Account created very recently with suspicious patterns
      const accountAge = (now.getTime() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (accountAge < 2 && userReferrals.length >= 3) {
        flags.push({
          indicator: "new_account_rapid_referrals",
          score: 15,
          details: `Account is ${accountAge.toFixed(1)} days old with ${userReferrals.length} referrals already`,
        });
      }

      // Calculate total risk score
      if (flags.length > 0) {
        const riskScore = flags.reduce((sum, f) => sum + f.score, 0);
        let autoAction: string | null = null;

        if (riskScore >= 70) {
          autoAction = "auto_suspended";
        } else if (riskScore >= 50) {
          autoAction = "auto_under_review";
        }

        results.push({
          user_id: profile.id,
          risk_score: riskScore,
          flags,
          auto_action: autoAction,
        });
      }
    }

    // Upsert fraud flags
    for (const result of results) {
      const { error: upsertError } = await supabase
        .from("fraud_flags")
        .upsert(
          {
            user_id: result.user_id,
            risk_score: result.risk_score,
            flags: result.flags,
            status: result.auto_action === "auto_suspended"
              ? "suspended"
              : result.auto_action === "auto_under_review"
              ? "under_review"
              : "monitoring",
            auto_action_taken: result.auto_action,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (upsertError) {
        console.error(`Error upserting fraud flag for ${result.user_id}:`, upsertError);
      }

      // Auto-suspend accounts with risk >= 70
      if (result.auto_action === "auto_suspended") {
        await supabase
          .from("profiles")
          .update({ account_status: "suspended", is_frozen: true })
          .eq("id", result.user_id)
          .neq("account_status", "blacklisted"); // Don't downgrade blacklisted
      }

      // Auto put under review for risk 50-69
      if (result.auto_action === "auto_under_review") {
        await supabase
          .from("profiles")
          .update({ account_status: "under_review" })
          .eq("id", result.user_id)
          .eq("account_status", "active"); // Only affect active accounts
      }
    }

    // Clean up: remove flags for users no longer flagged
    const flaggedUserIds = results.map((r) => r.user_id);
    if (flaggedUserIds.length > 0) {
      // Get existing flags not in current scan
      const { data: existingFlags } = await supabase
        .from("fraud_flags")
        .select("user_id")
        .not("user_id", "in", `(${flaggedUserIds.join(",")})`);

      for (const existing of existingFlags || []) {
        await supabase.from("fraud_flags").delete().eq("user_id", existing.user_id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scanned: (profiles || []).length,
        flagged: results.length,
        auto_suspended: results.filter((r) => r.auto_action === "auto_suspended").length,
        auto_under_review: results.filter((r) => r.auto_action === "auto_under_review").length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fraud detection error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
