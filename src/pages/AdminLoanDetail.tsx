import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Shield, ArrowLeft, CheckCircle, XCircle, Banknote, AlertTriangle, User, Clock, FileText, Zap, RotateCcw, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import AdminLayout from "@/components/AdminLayout";
import { useAllLoans, useLoanSureties, useLoanRepayments, useApproveLoan, useDisburseLoan, LoanStatus } from "@/hooks/useLoans";
import { useCalculateRiskScore, getRiskDecisionLabel, getRiskDecisionColor, getRiskScoreColor } from "@/hooks/useRiskScore";
import { useAutoDeductBorrower, useTriggerSuretyRecovery, useReverseRecovery, useApplyLatePenalty, isLoanPastGracePeriod, daysOverdue, calculateLatePenalty, weeksOverdue } from "@/hooks/useDefaultRecovery";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const AdminLoanDetail = () => {
  const { loanId } = useParams<{ loanId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: loans } = useAllLoans();
  const loan = loans?.find(l => l.id === loanId);
  const { data: sureties } = useLoanSureties(loanId);
  const { data: repayments } = useLoanRepayments(loanId);
  const approveLoan = useApproveLoan();
  const disburseLoan = useDisburseLoan();
  const calculateRisk = useCalculateRiskScore();
  const autoDeduct = useAutoDeductBorrower();
  const suretyRecovery = useTriggerSuretyRecovery();
  const reverseRecovery = useReverseRecovery();
  const applyPenalty = useApplyLatePenalty();

  const [rejectionReason, setRejectionReason] = useState("");
  const [approvedAmount, setApprovedAmount] = useState<number>(0);

  const rejectLoan = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("loans").update({
        status: "rejected",
        rejection_reason: rejectionReason,
        reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", loanId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: "Loan rejected" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const declareDefault = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("loans").update({
        status: "defaulted",
        is_defaulted: true,
        default_declared_at: new Date().toISOString(),
      }).eq("id", loanId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: "Loan declared as defaulted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const writeOff = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("loans").update({
        status: "completed",
        recovery_amount: loan?.recovery_amount || 0,
        is_defaulted: true,
        updated_at: new Date().toISOString(),
      }).eq("id", loanId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      toast({ title: "Loan written off as irrecoverable" });
    },
    onError: (e: Error) => toast({ title: "Write-off failed", description: e.message, variant: "destructive" }),
  });

  if (!loan) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <p className="text-muted-foreground">Loan not found</p>
          <Button variant="ghost" onClick={() => navigate("/admin/loans")} className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Loans
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const totalOwed = loan.amount_approved || loan.amount_requested;
  const annualRate = loan.interest_type === 'monthly' ? loan.interest_rate * 12 : loan.interest_rate;
  const totalWithInterest = totalOwed * (1 + annualRate / 100);
  const repaidPercent = totalWithInterest > 0 ? Math.min((loan.total_repaid / totalWithInterest) * 100, 100) : 0;
  const remainingDebt = Math.max(0, totalWithInterest - loan.total_repaid);

  // Surety coverage
  const acceptedSureties = (sureties || []).filter(s => s.status === "accepted");
  const totalSuretyCoverage = acceptedSureties.reduce((s, su) => s + su.guarantee_amount, 0);
  const coveragePercent = totalOwed > 0 ? (totalSuretyCoverage / totalOwed) * 100 : 0;
  const hasTwoSureties = acceptedSureties.length >= 2;

  // 50/50 split calculation for display
  const halfDebt = remainingDebt / 2;

  const handleRecalculateRisk = () => {
    calculateRisk.mutate({
      p_user_id: loan.user_id,
      p_loan_amount: loan.amount_requested,
      p_duration_months: loan.duration_months,
    });
  };

  // Weekly penalty: 2% of installment per week overdue
  const weeks = weeksOverdue(loan.next_payment_date);
  const weeklyPenalty = calculateLatePenalty(loan.monthly_installment || 0) * weeks;

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/loans")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Shield className="w-4 h-4" /> Loan Detail
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{loan.member_name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{loan.id}</p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {loan.status.replace("_", " ").toUpperCase()}
          </Badge>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Requested</p>
              <p className="text-xl font-bold font-mono">${loan.amount_requested.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Approved</p>
              <p className="text-xl font-bold font-mono">${(loan.amount_approved || 0).toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Risk Score</p>
              <p className={`text-xl font-bold font-mono ${getRiskScoreColor(loan.risk_score)}`}>{loan.risk_score}/100</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Interest Rate</p>
              <p className="text-xl font-bold font-mono">{loan.interest_rate}% ({loan.interest_type || 'annual'})</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-xl font-bold font-mono text-destructive">${remainingDebt.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Surety & Coverage Validation */}
        {!hasTwoSureties && ["pending", "surety_pending", "under_review"].includes(loan.status) && (
          <Alert className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Missing Sureties:</strong> This loan requires exactly 2 accepted sureties before approval. Currently {acceptedSureties.length}/2.
            </AlertDescription>
          </Alert>
        )}
        {hasTwoSureties && coveragePercent < 120 && (
          <Alert className="border-yellow-500/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Surety coverage is {coveragePercent.toFixed(0)}% — minimum 120% required before approval.
            </AlertDescription>
          </Alert>
        )}

        {/* Repayment Progress */}
        <Card className="border-border">
          <CardContent className="pt-5">
            <div className="flex justify-between mb-2">
              <span className="text-sm text-muted-foreground">Repayment Progress</span>
              <span className="text-sm font-mono">${loan.total_repaid.toLocaleString()} / ${totalWithInterest.toLocaleString()}</span>
            </div>
            <Progress value={repaidPercent} className="h-3" />
            <div className="flex justify-between mt-1 text-xs text-muted-foreground">
              <span>{repaidPercent.toFixed(1)}% repaid</span>
              {loan.next_payment_date && <span>Next: {new Date(loan.next_payment_date).toLocaleDateString()}</span>}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="borrower" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="borrower">Borrower</TabsTrigger>
            <TabsTrigger value="sureties">Sureties ({sureties?.length || 0}/2)</TabsTrigger>
            <TabsTrigger value="repayments">Repayments ({repayments?.length || 0})</TabsTrigger>
            <TabsTrigger value="actions">Admin Actions</TabsTrigger>
          </TabsList>

          {/* Borrower Info */}
          <TabsContent value="borrower">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Borrower Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    ["Name", loan.member_name],
                    ["Member #", loan.member_number || "N/A"],
                    ["Occupation", loan.occupation || "N/A"],
                    ["Employer", loan.employer_name || "N/A"],
                    ["Monthly Income", loan.monthly_income ? `$${loan.monthly_income.toLocaleString()}` : "N/A"],
                    ["Residential Address", loan.residential_address || "N/A"],
                    ["Business Address", loan.business_address || "N/A"],
                    ["Purpose", loan.purpose],
                    ["Duration", `${loan.duration_months} months`],
                    ["Monthly Installment", loan.monthly_installment ? `$${loan.monthly_installment.toLocaleString()}` : "N/A"],
                    ["Applied", new Date(loan.created_at).toLocaleDateString()],
                    ["Credit Limit", `$${loan.credit_limit.toLocaleString()}`],
                  ].map(([label, value]) => (
                    <div key={label as string} className="flex justify-between py-2 border-b border-border">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sureties */}
          <TabsContent value="sureties">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Surety Coverage</CardTitle>
                <CardDescription>
                  <span className="flex items-center gap-2">
                    Sureties: <Badge variant={hasTwoSureties ? "default" : "destructive"}>{acceptedSureties.length}/2</Badge>
                    {" | "}
                    Coverage: <span className={coveragePercent >= 120 ? "text-green-400" : "text-destructive"}>{coveragePercent.toFixed(0)}%</span> 
                    {coveragePercent < 120 && <span className="text-destructive ml-1">(Min 120% required)</span>}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!sureties?.length ? (
                  <p className="text-muted-foreground text-center py-4">No sureties attached.</p>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead>Name</TableHead>
                          <TableHead>Guarantee Amount</TableHead>
                          <TableHead>Relationship</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Declaration</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sureties.map((s) => (
                          <TableRow key={s.id} className="border-border">
                            <TableCell>
                              <div>
                                <p className="font-medium">{s.surety_name}</p>
                                <p className="text-xs text-muted-foreground">{s.surety_phone || s.surety_email || "—"}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">${s.guarantee_amount.toLocaleString()}</TableCell>
                            <TableCell>{s.relationship_to_borrower || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                s.status === "accepted" ? "bg-green-500/20 text-green-400" :
                                s.status === "rejected" ? "bg-red-500/20 text-red-400" :
                                s.status === "called" ? "bg-orange-500/20 text-orange-400" :
                                "bg-yellow-500/20 text-yellow-400"
                              }>
                                {s.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {s.declaration_agreed ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <XCircle className="w-4 h-4 text-muted-foreground" />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* 50/50 Split Preview for defaulted loans */}
                    {loan.status === "defaulted" && acceptedSureties.length === 2 && remainingDebt > 0 && (
                      <div className="mt-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5 space-y-2">
                        <p className="text-sm font-medium text-destructive flex items-center gap-1">
                          <Lock className="w-4 h-4" /> 50/50 Recovery Split Preview
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="p-3 rounded bg-background border border-border">
                            <p className="text-muted-foreground text-xs">{acceptedSureties[0].surety_name}</p>
                            <p className="font-mono font-bold">${halfDebt.toLocaleString()}</p>
                          </div>
                          <div className="p-3 rounded bg-background border border-border">
                            <p className="text-muted-foreground text-xs">{acceptedSureties[1].surety_name}</p>
                            <p className="font-mono font-bold">${halfDebt.toLocaleString()}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Total remaining: ${remainingDebt.toLocaleString()} split equally</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Repayments */}
          <TabsContent value="repayments">
            <Card className="border-border">
              <CardHeader>
                <CardTitle>Repayment History</CardTitle>
              </CardHeader>
              <CardContent>
                {!repayments?.length ? (
                  <p className="text-muted-foreground text-center py-4">No repayments yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>From Wallet</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repayments.map((r) => (
                        <TableRow key={r.id} className="border-border">
                          <TableCell>{new Date(r.paid_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-mono">${r.amount.toLocaleString()}</TableCell>
                          <TableCell>{r.payment_type}</TableCell>
                          <TableCell>{r.from_wallet_type}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={r.status === "completed" ? "bg-green-500/20 text-green-400" : ""}>
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Admin Actions */}
          <TabsContent value="actions">
            <div className="space-y-4">
              {/* Risk Recalculation */}
              <Card className="border-border">
                <CardHeader>
                  <CardTitle>Risk Assessment</CardTitle>
                  <CardDescription>
                    Score determines: 80-100 = Auto-Approve | 60-79 = Manual Review | 40-59 = Extra Collateral | &lt;40 = Reject
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button onClick={handleRecalculateRisk} disabled={calculateRisk.isPending}>
                    {calculateRisk.isPending ? "Calculating..." : "Recalculate Risk Score"}
                  </Button>
                  {calculateRisk.data && (
                    <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Score</span>
                        <span className={`font-mono font-bold ${getRiskScoreColor(calculateRisk.data.total_score)}`}>{calculateRisk.data.total_score}/100</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Decision</span>
                        <span className={`font-medium ${getRiskDecisionColor(calculateRisk.data.decision)}`}>{getRiskDecisionLabel(calculateRisk.data.decision)}</span>
                      </div>
                      {/* Breakdown */}
                      {calculateRisk.data.breakdown && (
                        <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border">
                          <div className="flex justify-between"><span className="text-muted-foreground">Account Stability</span><span className="font-mono">{calculateRisk.data.breakdown.account_stability.score}/{calculateRisk.data.breakdown.account_stability.max}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Savings Strength</span><span className="font-mono">{calculateRisk.data.breakdown.savings_strength.score}/{calculateRisk.data.breakdown.savings_strength.max}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Income Flow</span><span className="font-mono">{calculateRisk.data.breakdown.income_flow.score}/{calculateRisk.data.breakdown.income_flow.max}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Loan History</span><span className="font-mono">{calculateRisk.data.breakdown.loan_history.score}/{calculateRisk.data.breakdown.loan_history.max}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Surety Strength</span><span className="font-mono">{calculateRisk.data.breakdown.surety_strength.score}/{calculateRisk.data.breakdown.surety_strength.max}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Loan Behavior</span><span className="font-mono">{calculateRisk.data.breakdown.loan_behavior.score}/{calculateRisk.data.breakdown.loan_behavior.max}</span></div>
                        </div>
                      )}
                      {calculateRisk.data.fraud_flags.length > 0 && (
                        <div className="mt-2 p-3 rounded bg-destructive/10 border border-destructive/20">
                          <p className="text-xs font-medium text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Fraud Flags</p>
                          <ul className="mt-1 text-xs text-destructive/80 list-disc list-inside">
                            {calculateRisk.data.fraud_flags.map((f, i) => <li key={i}>{f}</li>)}
                          </ul>
                          <p className="mt-1 text-xs text-muted-foreground">Score deduction: -{calculateRisk.data.fraud_deductions} pts</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Approve/Reject (only for pending/under_review + must have 2 sureties + 120% coverage) */}
              {["pending", "surety_pending", "under_review"].includes(loan.status) && (
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Approve or Reject</CardTitle>
                    <CardDescription>
                      {!hasTwoSureties && "⚠ Cannot approve: needs 2 accepted sureties. "}
                      {hasTwoSureties && coveragePercent < 120 && "⚠ Cannot approve: surety coverage below 120%. "}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-sm text-muted-foreground">Approved Amount (leave 0 for full)</label>
                        <Input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(Number(e.target.value))} className="mt-1" placeholder="Leave 0 for requested amount" />
                      </div>
                      <Button
                        className="mt-6"
                        onClick={() => approveLoan.mutate({ p_loan_id: loan.id, ...(approvedAmount > 0 ? { p_approved_amount: approvedAmount } : {}) })}
                        disabled={approveLoan.isPending || !hasTwoSureties || coveragePercent < 120}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" /> Approve
                      </Button>
                    </div>
                    <div className="border-t border-border pt-4 space-y-3">
                      <Textarea placeholder="Reason for rejection..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} />
                      <Button variant="destructive" onClick={() => rejectLoan.mutate()} disabled={!rejectionReason || rejectLoan.isPending}>
                        <XCircle className="w-4 h-4 mr-2" /> Reject Loan
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Disburse (only approved) */}
              {loan.status === "approved" && (
                <Card className="border-border">
                  <CardHeader>
                    <CardTitle>Disburse Loan</CardTitle>
                    <CardDescription>Transfer approved funds to borrower's wallet.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => disburseLoan.mutate(loan.id)} disabled={disburseLoan.isPending}>
                      <Banknote className="w-4 h-4 mr-2" /> Disburse ${(loan.amount_approved || loan.amount_requested).toLocaleString()}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Declare Default (for disbursed/repaying) */}
              {["disbursed", "repaying"].includes(loan.status) && (
                <Card className="border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Declare Default</CardTitle>
                    <CardDescription>Mark this loan as defaulted and trigger recovery processes.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="destructive" onClick={() => declareDefault.mutate()} disabled={declareDefault.isPending}>
                      Declare Default
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Recovery Actions (for defaulted loans) */}
              {loan.status === "defaulted" && (
                <Card className="border-orange-500/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Zap className="w-5 h-5 text-orange-400" /> Recovery Actions</CardTitle>
                    <CardDescription>
                      Recovery sequence: <strong>1)</strong> Auto-deduct borrower wallets → <strong>2)</strong> Apply late penalty → <strong>3)</strong> 50/50 surety recovery → <strong>4)</strong> Reverse recovery engine
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Grace & penalty info */}
                    {loan.next_payment_date && (
                      <div className="p-3 rounded-lg bg-secondary/30 text-sm space-y-1">
                        <p className="text-muted-foreground">
                          Days overdue: <span className="text-destructive font-mono font-bold">{daysOverdue(loan.next_payment_date)}</span>
                          {" | "}Weeks: <span className="text-destructive font-mono font-bold">{weeks}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Past grace period (7 days): {isLoanPastGracePeriod(loan.next_payment_date) ? <span className="text-destructive">Yes</span> : <span className="text-green-400">No</span>}
                        </p>
                      </div>
                    )}

                    {/* Step 1: Auto-deduct from borrower */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs mr-1">Step 1</Badge>
                          Auto-Deduct from Borrower Wallets
                        </p>
                        <p className="text-xs text-muted-foreground">Deduct from: Main Wallet → Savings Vault (in order)</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={autoDeduct.isPending} onClick={() => autoDeduct.mutate({ loan_id: loan.id, amount_due: remainingDebt, user_id: loan.user_id })}>
                        <Zap className="w-3 h-3 mr-1" /> Auto-Deduct
                      </Button>
                    </div>

                    {/* Step 2: Apply Late Penalty */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs mr-1">Step 2</Badge>
                          Apply Late Penalty
                        </p>
                        <p className="text-xs text-muted-foreground">2% weekly × {weeks} weeks = ${weeklyPenalty.toFixed(2)}</p>
                      </div>
                      <Button size="sm" variant="outline" disabled={applyPenalty.isPending} onClick={() => applyPenalty.mutate({ loan_id: loan.id, penalty_amount: weeklyPenalty })}>
                        Apply Penalty
                      </Button>
                    </div>

                    {/* Step 3: 50/50 Surety Recovery */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1">
                          <Badge variant="secondary" className="text-xs mr-1">Step 3</Badge>
                          50/50 Surety Recovery
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Split ${remainingDebt.toLocaleString()} equally between {acceptedSureties.length} sureties
                          {acceptedSureties.length === 2 && ` (${acceptedSureties[0].surety_name} & ${acceptedSureties[1].surety_name})`}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" disabled={suretyRecovery.isPending || acceptedSureties.length < 2} onClick={() => suretyRecovery.mutate({ loan_id: loan.id, recovery_amount: remainingDebt })}>
                        Surety Recovery
                      </Button>
                    </div>

                    {/* Step 4: Reverse Recovery Engine */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                      <div>
                        <p className="text-sm font-medium text-destructive flex items-center gap-1">
                          <Badge variant="destructive" className="text-xs mr-1">Step 4</Badge>
                          Reverse Recovery Engine
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Freeze borrower account • Block new loans • Redirect commissions/ROI to sureties • Legal recovery status
                        </p>
                      </div>
                      <Button size="sm" variant="destructive" disabled={reverseRecovery.isPending} onClick={() => reverseRecovery.mutate({ loan_id: loan.id, user_id: loan.user_id, reason: "All automated recovery exhausted — activating reverse recovery engine" })}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Activate
                      </Button>
                    </div>

                    {/* Step 5: Write-off (Last Resort) */}
                    <div className="flex items-center justify-between p-3 rounded-lg border border-muted bg-muted/10">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Badge variant="outline" className="text-xs mr-1">Step 5</Badge>
                          Write Off (Last Resort)
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Mark loan as irrecoverable. Remaining balance of ${remainingDebt.toLocaleString()} will be written off.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-muted-foreground/30 text-muted-foreground hover:text-destructive hover:border-destructive"
                        disabled={writeOff.isPending}
                        onClick={() => {
                          if (confirm("Are you sure you want to write off this loan? This action marks the debt as irrecoverable.")) {
                            writeOff.mutate();
                          }
                        }}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Write Off
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminLoanDetail;
