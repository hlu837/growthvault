import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Section = ({ number, title, children }: { number: number; title: string; children: React.ReactNode }) => (
  <section className="p-6 rounded-md border border-border bg-card">
    <h2 className="text-xl font-semibold mb-4">{number}. {title}</h2>
    {children}
  </section>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="space-y-2 text-muted-foreground list-disc list-inside">
    {items.map((item, i) => <li key={i}>{item}</li>)}
  </ul>
);

const LoanPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Golden Wealth Achievers logo" className="w-8 h-8 rounded-md shadow-md" />
            <span className="font-semibold tracking-tight">Golden Wealth Achievers</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </Button>
          </Link>
        </div>
      </nav>

      <main className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Loan Policy</h1>
          <p className="text-muted-foreground mb-8 font-mono text-sm">Last updated: March 2026</p>

          <p className="text-muted-foreground mb-8">
            This Loan Policy outlines the rules, eligibility criteria, procedures, and conditions governing access to loan facilities provided by Golden Wealth Achievers (the "Company"). This policy is an integral part of the Company's Terms & Conditions and applies to all Members.
          </p>

          <div className="space-y-8">
            <Section number={1} title="Purpose of the Loan Policy">
              <BulletList items={[
                "Provide financial support to qualified Members;",
                "Promote responsible borrowing and repayment;",
                "Protect the sustainability and going-concern status of the Company;",
                "Reduce default risk and ensure fairness across the platform."
              ]} />
            </Section>

            <Section number={2} title="Loan Facility Overview">
              <BulletList items={[
                "Loans are offered as a member benefit, not a right.",
                "Loan availability is subject to internal risk controls, liquidity, and compliance requirements.",
                "Loan approval is not guaranteed, even if all eligibility criteria are met."
              ]} />
            </Section>

            <Section number={3} title="Eligibility Requirements">
              <p className="text-muted-foreground mb-3">To qualify for a loan, a Member must:</p>
              <BulletList items={[
                "Be at least 18 years old;",
                "Have an active investment plan on the Platform;",
                "Maintain a minimum of three (3) active direct referrers;",
                "Have a fully verified KYC status, including photograph and valid government-issued identification;",
                "Maintain an active, compliant account with no unresolved violations;",
                "Have an account aged at least 90 days;",
                "Meet any additional criteria communicated by the Company from time to time."
              ]} />
            </Section>

            <Section number={4} title="Surety / Guarantor Requirement">
              <BulletList items={[
                "Each loan applicant must provide at least two (2) qualified sureties/guarantors, unless otherwise stated.",
                "The surety must be an active, KYC-verified Member in good standing.",
                "Combined surety coverage must equal or exceed 120% of the loan amount.",
                "A surety cannot guarantee more than one (1) active loan at any time.",
                "By acting as a surety, the guarantor agrees to share repayment responsibility in the event of default, as permitted by law."
              ]} />
            </Section>

            <Section number={5} title="Loan Application Process">
              <ol className="space-y-2 text-muted-foreground list-decimal list-inside">
                <li>Member submits a loan request through the Platform.</li>
                <li>A completed Loan Recommendation & Surety Agreement Form must be provided.</li>
                <li>The Company conducts internal review, verification, and risk assessment.</li>
                <li>The Member is notified of approval, conditional approval, or rejection.</li>
              </ol>
              <p className="text-muted-foreground mt-3">The Company reserves the right to request additional information at any stage.</p>
            </Section>

            <Section number={6} title="Loan Amounts & Limits">
              <p className="text-muted-foreground mb-3">Loan amounts are determined based on:</p>
              <BulletList items={[
                "Investment plan level;",
                "Account activity and history;",
                "Savings vault balance (loan cannot exceed 50% of savings);",
                "Referral strength and engagement;",
                "Available loan pool."
              ]} />
              <p className="text-muted-foreground mt-3">The Company may impose loan caps, minimums, or tier-based limits.</p>
            </Section>

            <Section number={7} title="Interest, Fees & Charges">
              <BulletList items={[
                "Loans may be issued with interest, as determined by the Company.",
                "Applicable interest rates, service fees, or administrative charges (if any) will be clearly disclosed before loan acceptance.",
                "Acceptance of a loan constitutes acceptance of all disclosed charges."
              ]} />
            </Section>

            <Section number={8} title="Repayment Terms">
              <p className="text-muted-foreground mb-3">Repayment schedules, duration, and methods will be communicated at loan approval. Repayments may be made through:</p>
              <BulletList items={[
                "Wallet deductions;",
                "Commission or bonus deductions;",
                "Other approved payment methods."
              ]} />
              <p className="text-muted-foreground mt-3">Early repayment may be allowed without penalty unless stated otherwise.</p>
            </Section>

            <Section number={9} title="Default & Recovery">
              <p className="text-muted-foreground mb-3">A loan shall be considered in default if repayment obligations are not met within the agreed timeframe. A 7-day grace period applies after the due date. In the event of default, the Company may:</p>
              <BulletList items={[
                "Deduct outstanding amounts from the borrower's earnings, bonuses, or wallet balance;",
                "Deduct from the borrower's savings vault;",
                "Split remaining debt between designated sureties and recover from their wallets or earnings;",
                "Recover funds from the surety's earnings or wallet (where legally permitted);",
                "Suspend withdrawals, bonuses, or account privileges;",
                "Redirect borrower's commissions to sureties until fully repaid (Reverse Recovery Engine);",
                "Terminate the borrower's or surety's account;",
                "Take lawful recovery actions in accordance with applicable laws."
              ]} />
            </Section>

            <Section number={10} title="Withholding of Withdrawals">
              <p className="text-muted-foreground mb-3">The Company reserves the right to withhold or restrict withdrawals for Members with:</p>
              <BulletList items={[
                "Active outstanding loans;",
                "Overdue loan repayments;",
                "Incomplete or failed KYC verification."
              ]} />
              <p className="text-muted-foreground mt-3">Such withholding shall not constitute a breach of contract or liability on the part of the Company.</p>
            </Section>

            <Section number={11} title="Rollover & Going Concern">
              <BulletList items={[
                "Loan obligations remain enforceable notwithstanding any rollover of investment plans.",
                "Rollover of investments does not cancel, replace, or offset outstanding loan balances unless expressly stated by the Company."
              ]} />
            </Section>

            <Section number={12} title="Misrepresentation & Fraud">
              <BulletList items={[
                "Submission of false information, forged documents, or misleading details will result in immediate disqualification.",
                "Fraudulent activity may lead to permanent account termination, forfeiture of earnings, and legal action."
              ]} />
            </Section>

            <Section number={13} title="No Guarantee of Loan or Income">
              <BulletList items={[
                "Loans are discretionary and subject to approval.",
                "The Company does not guarantee loan access, profits, or income."
              ]} />
            </Section>

            <Section number={14} title="Late Payment Penalties">
              <BulletList items={[
                "A penalty fee may apply for late repayments (e.g., 2% weekly on overdue balance).",
                "Penalty rates and terms will be disclosed at loan approval.",
                "Penalties are auto-applied by the system after the grace period expires."
              ]} />
            </Section>

            <Section number={15} title="Policy Amendments">
              <p className="text-muted-foreground">
                The Company reserves the right to modify this Loan Policy at any time. Changes will be communicated through the Platform and take effect immediately upon publication.
              </p>
            </Section>

            <Section number={16} title="Governing Law">
              <p className="text-muted-foreground">
                This Loan Policy shall be governed by and interpreted in accordance with the applicable laws of the jurisdiction.
              </p>
            </Section>

            <Section number={17} title="Contact Information">
              <p className="text-muted-foreground mb-3">For loan-related inquiries:</p>
              <div className="space-y-1 text-muted-foreground">
                <p><strong className="text-foreground">Company Name:</strong> Golden Wealth Achievers</p>
                <p><strong className="text-foreground">Email:</strong> support@goldenwealthachivers.com</p>
              </div>
            </Section>

            {/* Acknowledgment */}
            <div className="p-6 rounded-md border border-primary/30 bg-primary/5">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">ACKNOWLEDGMENT:</strong> By applying for or accepting a loan on the Platform, you acknowledge that you have read, understood, and agreed to this Loan Policy.
              </p>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border text-center">
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 px-6 border-t border-border">
        <div className="container mx-auto max-w-4xl text-center text-sm text-muted-foreground space-y-1">
          <div>© {new Date().getFullYear()} Golden Wealth Achievers. All rights reserved.</div>
          <div>Powered by Bisolkay Int'l Company, duly registered in Nigeria.</div>
        </div>
      </footer>
    </div>
  );
};

export default LoanPolicy;
