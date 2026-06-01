import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { useAddSurety, useSuretyCandidates } from "@/hooks/useLoans";

interface SuretyConsentFormProps {
  loanId: string;
  loanAmount: number;
  existingSuretyTotal: number;
  onSuccess?: () => void;
}

const RELATIONSHIPS = [
  "Family Member",
  "Friend",
  "Business Partner",
  "Colleague",
  "Other",
];

const SuretyConsentForm = ({ loanId, loanAmount, existingSuretyTotal, onSuccess }: SuretyConsentFormProps) => {
  const addSurety = useAddSurety();

  // Form fields
  const [suretyUserId, setSuretyUserId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [suretyName, setSuretyName] = useState("");
  const [suretyMemberNumber, setSuretyMemberNumber] = useState("");
  const [suretyEmail, setSuretyEmail] = useState("");
  const [suretyPhone, setSuretyPhone] = useState("");
  const [suretyAddress, setSuretyAddress] = useState("");
  const [suretyOccupation, setSuretyOccupation] = useState("");
  const [suretyEmployer, setSuretyEmployer] = useState("");
  const [suretyMonthlyIncome, setSuretyMonthlyIncome] = useState("");
  const [guaranteeAmount, setGuaranteeAmount] = useState("");
  const [relationship, setRelationship] = useState("");
  const [activeDirectReferrals, setActiveDirectReferrals] = useState("");

  // Section C: Recommendation Confirmation
  const [confirmKnowApplicant, setConfirmKnowApplicant] = useState(false);
  const [confirmActiveCompliant, setConfirmActiveCompliant] = useState(false);
  const [confirmNoGuarantee, setConfirmNoGuarantee] = useState(false);

  // Section D: Surety Undertaking & Legal Consent
  const [agreeActAsSurety, setAgreeActAsSurety] = useState(false);
  const [agreeFinancialResponsibility, setAgreeFinancialResponsibility] = useState(false);
  const [agreeAutoDeduction, setAgreeAutoDeduction] = useState(false);
  const [agreeNoRefund, setAgreeNoRefund] = useState(false);
  const [agreeTermination, setAgreeTermination] = useState(false);

  // Section E: Digital Declaration & E-Signature
  const [declareInfoTrue, setDeclareInfoTrue] = useState(false);
  const [declareFalseInfoConsequences, setDeclareFalseInfoConsequences] = useState(false);
  const [digitalSignature, setDigitalSignature] = useState("");

  // Coverage validation
  const requiredTotal = loanAmount * 1.2; // 120% coverage
  const remainingNeeded = Math.max(0, requiredTotal - existingSuretyTotal);
  const guaranteeNum = parseFloat(guaranteeAmount) || 0;
  const newTotal = existingSuretyTotal + guaranteeNum;
  const coveragePercent = loanAmount > 0 ? Math.round((newTotal / loanAmount) * 100) : 0;
  const meetsMinimum = guaranteeNum >= remainingNeeded && guaranteeNum > 0;

  const suretyCandidates = useSuretyCandidates(searchTerm);

  // All consent checkboxes
  const allSectionCChecked = confirmKnowApplicant && confirmActiveCompliant && confirmNoGuarantee;
  const allSectionDChecked = agreeActAsSurety && agreeFinancialResponsibility && agreeAutoDeduction && agreeNoRefund && agreeTermination;
  const allSectionEChecked = declareInfoTrue && declareFalseInfoConsequences;
  const signatureValid = digitalSignature.trim().length > 0 && digitalSignature.trim().toLowerCase() === suretyName.trim().toLowerCase();

  const selectCandidate = (candidate: any) => {
    setSuretyUserId(candidate.id);
    setSuretyName(candidate.full_name || "");
    setSuretyEmail(candidate.email || "");
    setSuretyMemberNumber(candidate.referral_code || "");
    setSearchInput("");
    setSearchTerm("");
  };

  const canSubmit = useMemo(() => {
    return (
      suretyName.trim().length > 0 &&
      suretyEmail.trim().length > 0 &&
      guaranteeNum > 0 &&
      relationship.length > 0 &&
      allSectionCChecked &&
      allSectionDChecked &&
      allSectionEChecked &&
      signatureValid &&
      !addSurety.isPending
    );
  }, [suretyName, suretyEmail, guaranteeNum, relationship, allSectionCChecked, allSectionDChecked, allSectionEChecked, signatureValid, addSurety.isPending]);

  const handleSubmit = () => {
    if (!canSubmit) return;

    addSurety.mutate(
      {
        loan_id: loanId,
        surety_user_id: suretyUserId || undefined,
        surety_name: suretyName.trim(),
        surety_member_number: suretyMemberNumber.trim() || undefined,
        surety_email: suretyEmail.trim(),
        surety_phone: suretyPhone.trim() || undefined,
        surety_address: suretyAddress.trim() || undefined,
        surety_occupation: suretyOccupation.trim() || undefined,
        surety_employer: suretyEmployer.trim() || undefined,
        surety_monthly_income: suretyMonthlyIncome ? parseFloat(suretyMonthlyIncome) : undefined,
        guarantee_amount: guaranteeNum,
        relationship_to_borrower: relationship,
      },
      { onSuccess }
    );
  };

  return (
    <div className="space-y-6">
      {/* Surety candidate selection */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Quick surety lookup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input
              placeholder="Search by name, email, or referral code"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <Button
              onClick={() => setSearchTerm(searchInput.trim())}
              disabled={!searchInput.trim()}
            >
              Search
            </Button>
            <Button
              variant="outline"
              onClick={() => { setSuretyUserId(null); setSearchInput(""); setSearchTerm(""); }}
            >
              Clear
            </Button>
          </div>

          {suretyCandidates.isLoading ? (
            <p className="text-sm text-muted-foreground">Searching candidates…</p>
          ) : suretyCandidates.data?.length ? (
            <div className="space-y-2">
              {suretyCandidates.data.map((candidate: any) => (
                <Button
                  key={candidate.id}
                  variant={candidate.id === suretyUserId ? "default" : "secondary"}
                  className="w-full justify-start"
                  onClick={() => selectCandidate(candidate)}
                >
                  <span className="font-semibold">{candidate.full_name || candidate.email}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{candidate.email}</span>
                </Button>
              ))}
            </div>
          ) : searchTerm ? (
            <p className="text-sm text-muted-foreground">No matching eligible members found.</p>
          ) : (
            <p className="text-sm text-muted-foreground">Search for a verified member to prefill surety details.</p>
          )}

          {suretyUserId && (
            <Alert className="border-primary/50">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Selected surety will be inserted as a verified member and routed to their surety requests view.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Coverage Status */}
      <Alert className={meetsMinimum || existingSuretyTotal >= requiredTotal ? "border-success/50" : "border-warning/50"}>
        <Shield className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>
            Minimum 120% surety coverage required: <strong>${requiredTotal.toLocaleString()}</strong>
            {" "}| Current: <strong>${existingSuretyTotal.toLocaleString()}</strong>
            {" "}| Remaining needed: <strong>${remainingNeeded.toLocaleString()}</strong>
          </span>
          <Badge variant={coveragePercent >= 120 ? "default" : "secondary"}>
            {coveragePercent}% covered
          </Badge>
        </AlertDescription>
      </Alert>

      {/* Section A: Surety Details */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Section A: Surety Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="surety-name">Full Name (as on ID) *</Label>
              <Input id="surety-name" value={suretyName} onChange={(e) => setSuretyName(e.target.value)} placeholder="Enter full legal name" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-member">Username / Member ID</Label>
              <Input id="surety-member" value={suretyMemberNumber} onChange={(e) => setSuretyMemberNumber(e.target.value)} placeholder="Platform member ID" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-email">Email Address *</Label>
              <Input id="surety-email" type="email" value={suretyEmail} onChange={(e) => setSuretyEmail(e.target.value)} placeholder="surety@email.com" maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-phone">Phone Number</Label>
              <Input id="surety-phone" value={suretyPhone} onChange={(e) => setSuretyPhone(e.target.value)} placeholder="+1 234 567 8900" maxLength={20} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-address">Residential Address</Label>
              <Input id="surety-address" value={suretyAddress} onChange={(e) => setSuretyAddress(e.target.value)} placeholder="Full address" maxLength={255} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-occupation">Occupation</Label>
              <Input id="surety-occupation" value={suretyOccupation} onChange={(e) => setSuretyOccupation(e.target.value)} placeholder="Current occupation" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-employer">Employer Name</Label>
              <Input id="surety-employer" value={suretyEmployer} onChange={(e) => setSuretyEmployer(e.target.value)} placeholder="Employer / Business" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-income">Monthly Income ($)</Label>
              <Input id="surety-income" type="number" min="0" value={suretyMonthlyIncome} onChange={(e) => setSuretyMonthlyIncome(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-relationship">Relationship to Borrower *</Label>
              <Select value={relationship} onValueChange={setRelationship}>
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship" />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="surety-referrals">Number of Active Direct Referrals</Label>
              <Input id="surety-referrals" type="number" min="0" value={activeDirectReferrals} onChange={(e) => setActiveDirectReferrals(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="guarantee-amount">Guarantee Amount ($) *</Label>
              <Input id="guarantee-amount" type="number" min="0" value={guaranteeAmount} onChange={(e) => setGuaranteeAmount(e.target.value)} placeholder={`Min: $${remainingNeeded.toLocaleString()}`} />
              {guaranteeNum > 0 && !meetsMinimum && existingSuretyTotal < requiredTotal && (
                <p className="text-xs text-destructive">Must be at least ${remainingNeeded.toLocaleString()} to meet 120% coverage</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section C: Recommendation Confirmation */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Section C: Recommendation Confirmation
            {allSectionCChecked && <Badge variant="default" className="ml-auto">Complete</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Required — must be checked to proceed</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox id="c1" checked={confirmKnowApplicant} onCheckedChange={(v) => setConfirmKnowApplicant(v === true)} />
            <Label htmlFor="c1" className="text-sm leading-relaxed cursor-pointer">
              I confirm that I personally know the applicant and voluntarily recommend him/her for loan consideration on this platform.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="c2" checked={confirmActiveCompliant} onCheckedChange={(v) => setConfirmActiveCompliant(v === true)} />
            <Label htmlFor="c2" className="text-sm leading-relaxed cursor-pointer">
              I confirm that the applicant is an active and compliant member to the best of my knowledge.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="c3" checked={confirmNoGuarantee} onCheckedChange={(v) => setConfirmNoGuarantee(v === true)} />
            <Label htmlFor="c3" className="text-sm leading-relaxed cursor-pointer">
              I understand that my recommendation does not guarantee loan approval.
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Section D: Surety Undertaking & Legal Consent */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Section D: Surety Undertaking & Legal Consent
            {allSectionDChecked && <Badge variant="default" className="ml-auto">Complete</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Mandatory — submission disabled unless all boxes are checked</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">By checking ALL boxes below, I (the Surety) legally agree that:</p>
          <div className="flex items-start gap-3">
            <Checkbox id="d1" checked={agreeActAsSurety} onCheckedChange={(v) => setAgreeActAsSurety(v === true)} />
            <Label htmlFor="d1" className="text-sm leading-relaxed cursor-pointer">
              I voluntarily agree to act as a surety/guarantor for the loan requested by the applicant.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="d2" checked={agreeFinancialResponsibility} onCheckedChange={(v) => setAgreeFinancialResponsibility(v === true)} />
            <Label htmlFor="d2" className="text-sm leading-relaxed cursor-pointer">
              I understand and accept that in the event of default by the borrower, I shall be jointly and severally liable for the outstanding loan amount up to my guarantee limit.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="d3" checked={agreeAutoDeduction} onCheckedChange={(v) => setAgreeAutoDeduction(v === true)} />
            <Label htmlFor="d3" className="text-sm leading-relaxed cursor-pointer">
              I authorize the platform to automatically deduct repayment amounts from my wallet, savings vault, or commissions in the event the borrower defaults.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="d4" checked={agreeNoRefund} onCheckedChange={(v) => setAgreeNoRefund(v === true)} />
            <Label htmlFor="d4" className="text-sm leading-relaxed cursor-pointer">
              I understand that any amount deducted from my account for default recovery is non-refundable by the platform and must be recovered independently from the borrower.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="d5" checked={agreeTermination} onCheckedChange={(v) => setAgreeTermination(v === true)} />
            <Label htmlFor="d5" className="text-sm leading-relaxed cursor-pointer">
              I acknowledge that failure to honor my surety obligation may result in restrictions on my account, including suspension of withdrawals and commissions.
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Section E: Digital Declaration & E-Signature */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Section E: Digital Declaration & E-Signature
            {allSectionEChecked && signatureValid && <Badge variant="default" className="ml-auto">Complete</Badge>}
          </CardTitle>
          <p className="text-sm text-muted-foreground">Required</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox id="e1" checked={declareInfoTrue} onCheckedChange={(v) => setDeclareInfoTrue(v === true)} />
            <Label htmlFor="e1" className="text-sm leading-relaxed cursor-pointer">
              I declare that all information provided is true, accurate, and complete.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox id="e2" checked={declareFalseInfoConsequences} onCheckedChange={(v) => setDeclareFalseInfoConsequences(v === true)} />
            <Label htmlFor="e2" className="text-sm leading-relaxed cursor-pointer">
              I understand that providing false information may result in account suspension, loss of earnings, or legal action.
            </Label>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="e-sig">Digital Signature (type your full name exactly) *</Label>
              <Input
                id="e-sig"
                value={digitalSignature}
                onChange={(e) => setDigitalSignature(e.target.value)}
                placeholder="Type your full name as signature"
                className="font-serif italic text-lg"
                maxLength={100}
              />
              {digitalSignature.trim().length > 0 && !signatureValid && (
                <p className="text-xs text-destructive">Signature must match the full name entered above: "{suretyName}"</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input value={new Date().toLocaleDateString()} disabled className="bg-muted" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Final Notice */}
      <Alert className="border-warning/50">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          <strong>Final Notice:</strong> Submission of this form does not constitute loan approval. All loans remain subject to KYC verification, risk assessment, internal approval, and fund availability.
        </AlertDescription>
      </Alert>

      {/* Submit */}
      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit} size="lg" className="min-w-[200px]">
          {addSurety.isPending ? "Submitting…" : "Submit Surety Agreement"}
        </Button>
      </div>
    </div>
  );
};

export default SuretyConsentForm;
