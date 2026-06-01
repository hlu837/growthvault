import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Banknote, Clock, CheckCircle2, AlertTriangle, FileText,
  Plus, Eye, CreditCard, Shield, TrendingUp, Lock
} from "lucide-react";
import { 
  useUserLoans, useApplyForLoan, useLoanSureties, useLoanRepayments, useMakeLoanRepayment,
  useLoanRequests, useRecommendedSureties, useRequestSurety, useRespondToSuretyRequest
} from "@/hooks/useLoans";
import { useCheckEligibility } from "@/hooks/useRiskScore";
import { useWallets, getWalletBalance } from "@/hooks/useWallets";
import { useLoanEligibilityCheck } from "@/hooks/useLoanEligibility";
import { useLoanWithdrawalGuard } from "@/hooks/useLoanWithdrawalGuard";
import SuretyConsentForm from "@/components/loans/SuretyConsentForm";
import { Link } from "react-router-dom";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  pending: { label: "Pending", variant: "outline" },
  surety_pending: { label: "Surety Pending", variant: "outline" },
  under_review: { label: "Under Review", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  disbursed: { label: "Disbursed", variant: "default" },
  repaying: { label: "Repaying", variant: "default" },
  completed: { label: "Completed", variant: "secondary" },
  defaulted: { label: "Defaulted", variant: "destructive" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const LOAN_PURPOSES = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

const LOAN_TYPES = [
  { value: "short_term", label: "Short-term Loan (30–90 days)" },
  { value: "asset_backed", label: "Asset-backed Loan (car, electronics, property)" },
  { value: "wallet_backed", label: "Wallet-backed Loan (against savings balance)" },
  { value: "mlm_qualification", label: "MLM Qualification Loan (upgrade support)" },
];

const INVESTMENT_PLANS = [
  { value: "25", label: "$25" },
  { value: "50", label: "$50" },
  { value: "250", label: "$250" },
  { value: "500", label: "$500" },
  { value: "1250", label: "$1,250" },
  { value: "2500", label: "$2,500" },
];

const MemberLoans = () => {
  const { data: loans, isLoading } = useUserLoans();
  const { data: wallets } = useWallets();
  const applyLoan = useApplyForLoan();
  const { data: eligibilityCheck } = useLoanEligibilityCheck();
  const { data: withdrawalGuard } = useLoanWithdrawalGuard();

  // Application form state
  const [showApply, setShowApply] = useState(false);
  const [showSuretyForm, setShowSuretyForm] = useState(false);
  const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);
  const [currentLoanRequestId, setCurrentLoanRequestId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState("3");
  const [purposeCategory, setPurposeCategory] = useState("");
  const [purposeOther, setPurposeOther] = useState("");
  const [memberName, setMemberName] = useState("");
  const [residentialAddress, setResidentialAddress] = useState("");
  const [occupation, setOccupation] = useState("");
  const [employer, setEmployer] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [loanType, setLoanType] = useState("");
  const [investmentPlan, setInvestmentPlan] = useState("");
  const [interestType, setInterestType] = useState<"annual" | "monthly">("annual");

  // Detail view
  const [repayAmount, setRepayAmount] = useState("");

  const parsedAmount = parseFloat(amount) || 0;
  const { data: eligibility } = useCheckEligibility(parsedAmount > 0 ? parsedAmount : undefined);

  const selectedLoan = loans?.find((l) => l.id === selectedLoanId);
  const { data: sureties } = useLoanSureties(selectedLoanId ?? undefined);
  const { data: repayments } = useLoanRepayments(selectedLoanId ?? undefined);
  const makeRepayment = useMakeLoanRepayment();
  const { data: loanRequests } = useLoanRequests();
  const { data: recommendedSureties } = useRecommendedSureties(currentLoanRequestId);
  const requestSurety = useRequestSurety();

  const savingsBalance = getWalletBalance(wallets, "savings");
  const loansSavingBalance = getWalletBalance(wallets, "loans_saving");
  const maxBorrowable = loansSavingBalance * 3;

  // Summary stats
  const activeLoans = loans?.filter((l) => ["disbursed", "repaying"].includes(l.status)) || [];
  const totalOwed = activeLoans.reduce((s, l) => s + (l.amount_approved || l.amount_requested) - l.total_repaid, 0);

  // Surety tracking for selected loan
  const acceptedSureties = sureties?.filter((s: any) => s.status !== "rejected") || [];
  const suretyCount = acceptedSureties.length;
  const needsMoreSureties = suretyCount < 2;
  const totalSuretyCoverage = acceptedSureties.reduce((t: number, s: any) => t + s.guarantee_amount, 0);
  const coverageMet = totalSuretyCoverage >= (selectedLoan?.amount_requested || 0) * 1.2;

  const purposeText = purposeCategory === "other" ? purposeOther.trim() : purposeCategory;

  // Amount validation against 3x limit
  const amountExceedsLimit = parsedAmount > maxBorrowable && maxBorrowable > 0;

  const handleApply = () => {
    if (!memberName.trim() || parsedAmount <= 0 || !purposeText) return;
    if (eligibilityCheck && !eligibilityCheck.eligible) return;
    if (amountExceedsLimit) return;

    applyLoan.mutate(
      {
        p_amount: parsedAmount,
        p_duration_months: parseInt(duration),
        p_purpose: purposeText,
        p_member_name: memberName,
        p_residential_address: residentialAddress.trim() || undefined,
        p_business_address: undefined,
        p_occupation: occupation.trim() || undefined,
        p_employer_name: employer.trim() || undefined,
        p_monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
        p_interest_type: interestType as "annual" | "monthly",
      },
      {
        onSuccess: (loanRequestId) => {
          // Store the loan request ID for surety recommendations
          setCurrentLoanRequestId(loanRequestId);
          
          // Reset form
          setAmount("");
          setDuration("3");
          setPurposeCategory("");
          setPurposeOther("");
          setMemberName("");
          setResidentialAddress("");
          setOccupation("");
          setEmployer("");
          setMonthlyIncome("");
          setLoanType("");
          setShowApply(false);
          toast({ title: "Loan application submitted successfully" });
        },
        onError: (error: Error) => {
          toast({ title: "Application failed", description: error.message, variant: "destructive" });
        },
      }
    );
  };

  const handleRepay = () => {
    if (!selectedLoanId || !repayAmount) return;
    makeRepayment.mutate(
      { p_loan_id: selectedLoanId, p_amount: parseFloat(repayAmount) },
      { onSuccess: () => setRepayAmount("") }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Loan Facility</h1>
            <p className="text-muted-foreground text-sm">Apply for loans, track repayments, and manage sureties</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/loan-policy"><FileText className="w-4 h-4 mr-2" /> Loan Policy</Link>
            </Button>
            <Button size="sm" onClick={() => setShowApply(true)} disabled={eligibilityCheck && !eligibilityCheck.eligible}>
              <Plus className="w-4 h-4 mr-2" /> Apply for Loan
            </Button>
          </div>
        </div>

        {/* Withdrawal Freeze Warning */}
        {withdrawalGuard?.blocked && (
          <Alert className="border-destructive/50 bg-destructive/5">
            <Lock className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-destructive">
              <strong>Withdrawals Frozen:</strong> {withdrawalGuard.reasons.join(". ")}
            </AlertDescription>
          </Alert>
        )}

        {/* Eligibility Warning */}
        {eligibilityCheck && !eligibilityCheck.eligible && (
          <Alert className="border-destructive/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Not eligible to apply:</strong>
              <ul className="mt-1 list-disc list-inside text-sm">
                {eligibilityCheck.reasons.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Banknote className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Loans</p>
                  <p className="text-2xl font-bold">{activeLoans.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><TrendingUp className="w-5 h-5 text-destructive" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Owed</p>
                  <p className="text-2xl font-bold">${totalOwed.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/10"><CreditCard className="w-5 h-5 text-accent-foreground" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Loan Savings</p>
                  <p className="text-2xl font-bold">${loansSavingBalance.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Shield className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Max Borrowable</p>
                  <p className="text-2xl font-bold">${maxBorrowable.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Loan Application Dialog */}
        <Dialog open={showApply} onOpenChange={setShowApply}>
          <DialogContent className="w-full max-w-full sm:max-w-3xl md:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Loan Application</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* 3x limit info */}
              <Alert className="border-primary/30">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  You can borrow up to <strong>3× your Loan Savings Account</strong> balance.
                  Current balance: <strong>${loansSavingBalance.toLocaleString()}</strong> → Max: <strong>${maxBorrowable.toLocaleString()}</strong>
                </AlertDescription>
              </Alert>

              {/* Loan Type Selection */}
              <div className="space-y-2">
                <Label>Loan Type *</Label>
                <Select value={loanType} onValueChange={setLoanType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select loan type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOAN_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Interest Frequency *</Label>
                <Select value={interestType} onValueChange={(value) => setInterestType(value as "annual" | "monthly")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select interest type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Investment Plan Subscribed */}
              <div className="space-y-2">
                <Label>Investment Plan Subscribed *</Label>
                <Select value={investmentPlan} onValueChange={setInvestmentPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTMENT_PLANS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {amountExceedsLimit && (
                <Alert className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Amount exceeds your borrowing limit of <strong>${maxBorrowable.toLocaleString()}</strong> (3× your Loan Savings).
                  </AlertDescription>
                </Alert>
              )}

              {eligibility && !eligibility.eligible && (
                <Alert className="border-destructive/50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Not eligible:</strong> {eligibility.reasons.join(", ")}
                  </AlertDescription>
                </Alert>
              )}
              {eligibility && eligibility.eligible && !amountExceedsLimit && (
                <Alert className="border-primary/50">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Eligible! Max loan: <strong>${eligibility.max_loan_amount.toLocaleString()}</strong>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name (as on ID) *</Label>
                  <Input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Enter full legal name" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Loan Amount ($) *</Label>
                  <Input type="number" min="0" max={maxBorrowable || undefined} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Duration (months)</Label>
                  <Input type="number" min="1" max="36" value={duration} onChange={(e) => setDuration(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Purpose of Loan *</Label>
                  <Select value={purposeCategory} onValueChange={setPurposeCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOAN_PURPOSES.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {purposeCategory === "other" && (
                  <div className="space-y-2 md:col-span-2">
                    <Label>Please specify *</Label>
                    <Textarea value={purposeOther} onChange={(e) => setPurposeOther(e.target.value)} placeholder="Describe the purpose" rows={2} maxLength={500} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Occupation</Label>
                  <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Employer</Label>
                  <Input value={employer} onChange={(e) => setEmployer(e.target.value)} maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Income ($)</Label>
                  <Input type="number" min="0" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Residential Address</Label>
                <Input value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} maxLength={255} />
              </div>
              <div className="space-y-2">
                <Label>Surety/Guarantor Name</Label>
                <Input placeholder="Enter surety/guarantor full name" maxLength={100} />
              </div>

              {/* Two-surety requirement notice */}
              <Alert className="border-muted">
                <Shield className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <strong>Important:</strong> After submitting, you must add <strong>exactly 2 sureties</strong> who are KYC-verified members with active deposits.
                  Combined surety coverage must be at least <strong>120%</strong> of the loan amount.
                </AlertDescription>
              </Alert>

              <Button
                onClick={handleApply}
                disabled={
                  applyLoan.isPending ||
                  !memberName.trim() ||
                  parsedAmount <= 0 ||
                  !purposeText ||
                  !loanType ||
                  !investmentPlan ||
                  amountExceedsLimit ||
                  (eligibilityCheck && !eligibilityCheck.eligible)
                }
                className="w-full"
              >
                {applyLoan.isPending ? "Submitting…" : "Submit Application"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Surety Recommendations - Show after loan application is submitted */}
        {currentLoanRequestId && recommendedSureties && recommendedSureties.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Recommended Sureties for Your Loan Application
              </CardTitle>
              <CardDescription>
                These are KYC-approved members from your network who can act as sureties for your loan.
                Select at least 2 to meet the 120% coverage requirement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                {recommendedSureties.map((surety) => (
                  <div key={surety.user_id} className="flex items-center justify-between p-4 border rounded-lg bg-card">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {surety.full_name?.split(" ").map((n) => n[0]).join("") || "??"}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium">{surety.full_name}</div>
                        <div className="text-sm text-muted-foreground">{surety.email}</div>
                        <div className="text-xs text-muted-foreground">Referral: {surety.referral_code || "None"}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 mb-2">
                        {surety.is_recommended && (
                          <Badge variant="secondary" className="text-xs">Recommended</Badge>
                        )}
                        <Badge variant={surety.relationship_score >= 80 ? "default" : "secondary"} className="text-xs">
                          Score: {surety.relationship_score}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => requestSurety.mutate({
                          p_loan_request_id: currentLoanRequestId!,
                          p_surety_user_id: surety.user_id,
                          p_guarantee_amount: Math.ceil((parsedAmount * 1.2) / 2), // 60% of 120% requirement
                          p_relationship: surety.relationship_score >= 80 ? "Network Connection" : "Other Member"
                        })}
                        disabled={requestSurety.isPending}
                      >
                        {requestSurety.isPending ? "Requesting..." : "Request Surety"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <Alert className="mt-4">
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Next Steps:</strong> After your sureties accept, your loan application will be reviewed by admin staff.
                  Make sure you have at least 2 accepted sureties with 120% total coverage.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Loans List & Detail */}
        {selectedLoan ? (
          <div className="space-y-6">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedLoanId(null); setShowSuretyForm(false); }}>
              ← Back to all loans
            </Button>

            {/* Loan Detail Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Loan #{selectedLoan.id.slice(0, 8)}</CardTitle>
                  <Badge variant={statusConfig[selectedLoan.status]?.variant || "secondary"}>
                    {statusConfig[selectedLoan.status]?.label || selectedLoan.status}
                  </Badge>
                </div>
                <CardDescription>{selectedLoan.purpose}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Requested</span><p className="font-semibold">${selectedLoan.amount_requested.toLocaleString()}</p></div>
                  <div><span className="text-muted-foreground">Approved</span><p className="font-semibold">{selectedLoan.amount_approved ? `$${selectedLoan.amount_approved.toLocaleString()}` : "—"}</p></div>
                  <div><span className="text-muted-foreground">Interest</span><p className="font-semibold">{selectedLoan.interest_rate}% ({selectedLoan.interest_type || 'annual'})</p></div>
                  <div><span className="text-muted-foreground">Duration</span><p className="font-semibold">{selectedLoan.duration_months} months</p></div>
                </div>

                {/* Surety requirement status */}
                {["draft", "pending", "surety_pending"].includes(selectedLoan.status) && (
                  <div className="p-3 rounded-lg border border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Surety Requirements</span>
                      <Badge variant={suretyCount >= 2 && coverageMet ? "default" : "destructive"}>
                        {suretyCount >= 2 && coverageMet ? "Met" : "Incomplete"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        {suretyCount >= 2 ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                        <span>Sureties: {suretyCount}/2 required</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {coverageMet ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                        <span>Coverage: {Math.round((totalSuretyCoverage / selectedLoan.amount_requested) * 100)}% (min 120%)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Repayment Progress */}
                {selectedLoan.amount_approved && ["disbursed", "repaying"].includes(selectedLoan.status) && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Repayment Progress</span>
                      <span className="font-medium">${selectedLoan.total_repaid.toLocaleString()} / ${selectedLoan.amount_approved.toLocaleString()}</span>
                    </div>
                    <Progress value={Math.min(100, (selectedLoan.total_repaid / selectedLoan.amount_approved) * 100)} />
                    {selectedLoan.monthly_installment && (
                      <p className="text-xs text-muted-foreground">Monthly installment: ${selectedLoan.monthly_installment.toLocaleString()}</p>
                    )}
                    {selectedLoan.next_payment_date && (
                      <p className="text-xs text-muted-foreground">Next payment: {new Date(selectedLoan.next_payment_date).toLocaleDateString()}</p>
                    )}
                  </div>
                )}

                {selectedLoan.rejection_reason && (
                  <Alert className="border-destructive/50">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>Rejected: {selectedLoan.rejection_reason}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            <Tabs defaultValue="sureties">
              <TabsList>
                <TabsTrigger value="sureties">Sureties ({sureties?.length || 0}/2)</TabsTrigger>
                <TabsTrigger value="repayments">Repayments ({repayments?.length || 0})</TabsTrigger>
                {["disbursed", "repaying"].includes(selectedLoan.status) && (
                  <TabsTrigger value="pay">Make Payment</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="sureties" className="space-y-4">
                {sureties && sureties.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sureties.map((s: any) => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.surety_name}</TableCell>
                          <TableCell>${s.guarantee_amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={s.status === "accepted" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>
                              {s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No sureties added yet. You must add exactly 2 sureties.</p>
                )}

                {["draft", "pending", "surety_pending"].includes(selectedLoan.status) && suretyCount < 2 && (
                  <>
                    <Separator />
                    {showSuretyForm ? (
                      <SuretyConsentForm
                        loanId={selectedLoan.id}
                        loanAmount={selectedLoan.amount_requested}
                        existingSuretyTotal={totalSuretyCoverage}
                        onSuccess={() => setShowSuretyForm(false)}
                      />
                    ) : (
                      <div className="space-y-2">
                        <Button variant="outline" onClick={() => setShowSuretyForm(true)}>
                          <Shield className="w-4 h-4 mr-2" /> Add Surety ({suretyCount}/2)
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {2 - suretyCount} more surety/sureties required. Each must be a KYC-verified member with active deposits.
                        </p>
                      </div>
                    )}
                  </>
                )}

                {suretyCount >= 2 && (
                  <Alert className="border-primary/50">
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      Both sureties have been added. {coverageMet ? "Coverage requirement met (≥120%)." : "Combined coverage does not yet meet the 120% minimum."}
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              <TabsContent value="repayments">
                {repayments && repayments.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repayments.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm">{new Date(r.paid_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">${r.amount.toLocaleString()}</TableCell>
                          <TableCell className="text-sm">{r.payment_type}</TableCell>
                          <TableCell><Badge variant="secondary">{r.status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No repayments yet.</p>
                )}
              </TabsContent>

              {["disbursed", "repaying"].includes(selectedLoan.status) && (
                <TabsContent value="pay" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Make a Repayment</CardTitle>
                      <CardDescription>Funds will be deducted from your savings wallet (${savingsBalance.toLocaleString()} available)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Amount ($)</Label>
                        <Input type="number" min="0" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} placeholder="0.00" />
                      </div>
                      <Button onClick={handleRepay} disabled={makeRepayment.isPending || !repayAmount || parseFloat(repayAmount) <= 0}>
                        {makeRepayment.isPending ? "Processing…" : "Submit Payment"}
                      </Button>
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        ) : (
          /* Loans Table */
          <Card>
            <CardHeader>
              <CardTitle>My Loans</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
              ) : !loans?.length ? (
                <div className="text-center py-12 space-y-3">
                  <Banknote className="w-12 h-12 mx-auto text-muted-foreground/40" />
                  <p className="text-muted-foreground">No loan applications yet</p>
                  <Button size="sm" onClick={() => setShowApply(true)} disabled={eligibilityCheck && !eligibilityCheck.eligible}>
                    <Plus className="w-4 h-4 mr-2" /> Apply Now
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Repaid</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => (
                      <TableRow key={loan.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLoanId(loan.id)}>
                        <TableCell className="text-sm">{new Date(loan.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">${loan.amount_requested.toLocaleString()}</TableCell>
                        <TableCell>{loan.duration_months}m</TableCell>
                        <TableCell>
                          <Badge variant={statusConfig[loan.status]?.variant || "secondary"}>
                            {statusConfig[loan.status]?.label || loan.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">${loan.total_repaid.toLocaleString()}</TableCell>
                        <TableCell><Eye className="w-4 h-4 text-muted-foreground" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MemberLoans;
