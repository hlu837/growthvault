import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
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

      {/* Content */}
      <main className="pt-24 pb-16 px-6">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">
            Terms and Conditions
          </h1>
          <p className="text-muted-foreground mb-8 font-mono text-sm">
            Last updated: January 2026
          </p>

          <div className="prose prose-invert max-w-none space-y-8">
            <p className="text-muted-foreground">
              Welcome to Golden Wealth Achievers. These Terms and Conditions ("Terms") govern your access to and use of our website, platform, products, services, and compensation program. By registering, accessing, or using our services, you agree to be bound by these Terms.
            </p>

            {/* Section 1 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">1. Definitions</h2>
              <ul className="space-y-2 text-muted-foreground">
                <li><span className="text-foreground font-medium">Account:</span> A registered user profile on the Company platform.</li>
                <li><span className="text-foreground font-medium">Member:</span> An individual registered to participate in the Company program.</li>
                <li><span className="text-foreground font-medium">Compensation Plan:</span> The reward structure outlining commissions, bonuses, interest and incentives.</li>
                <li><span className="text-foreground font-medium">Downline:</span> Members sponsored directly or indirectly by another Member.</li>
                <li><span className="text-foreground font-medium">Platform:</span> Website, mobile application, dashboards, and related systems operated by the Company.</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">2. Eligibility</h2>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>You must provide accurate, complete, and current information.</li>
                <li>One account per individual is permitted unless expressly authorized.</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">3. Account Registration & Security</h2>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                <li>You are solely responsible for all activities under your account.</li>
                <li>The Company is not liable for losses caused by unauthorized access due to your negligence.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">4. Program Participation</h2>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>Earnings depend on personal effort, referrals, and team performance.</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">5. Compensation & Payouts</h2>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>Commissions, interest and bonuses are paid according to the published Compensation Plan.</li>
                <li>Payouts are subject to eligibility, qualification rules, caps, compliance requirements, and successful KYC verification.</li>
                <li>The Company reserves the right to modify commission, interest structures with prior notice.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">6. Loan Facility</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-accent">6.1 Loan Eligibility Requirements</h3>
                <p className="text-muted-foreground mb-3">
                  Access to the Company's loan facility is subject to strict eligibility conditions. To qualify for a loan, a Member must:
                </p>
                <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                  <li>Have an <strong className="text-foreground">active investment plan subscription</strong>;</li>
                  <li>Maintain a <strong className="text-foreground">minimum of three (3) active direct referrers</strong> on the Platform;</li>
                  <li>Have a verified account, including successful <strong className="text-foreground">KYC completion</strong>;</li>
                  <li>Comply with all platform rules, policies, and risk assessments.</li>
                </ul>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-accent">6.2 Loan Approval & Discretion</h3>
                <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                  <li>Meeting the minimum requirements does <strong className="text-foreground">not guarantee loan approval</strong>.</li>
                  <li>All loan requests are subject to internal review, credit assessment, and availability of funds.</li>
                  <li>The Company reserves the sole right to approve, decline, limit, or revoke loan access at any time.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3 text-accent">6.3 Loan Terms & Repayment</h3>
                <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                  <li>Loan amounts, repayment periods, interest (if any), and conditions shall be communicated separately at the time of loan approval.</li>
                  <li>Outstanding loans may be deducted from earnings, commissions, or wallet balances in accordance with applicable laws.</li>
                </ul>
              </div>
            </section>

            {/* Section 7 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">7. Going Concern & Rollover of Investment Plans</h2>
              
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-accent">7.1 Rollover Mechanism</h3>
                <p className="text-muted-foreground">
                  To ensure business continuity and avoid disruption of participation, the Company operates a <strong className="text-foreground">rollover mechanism</strong> on investment plans. Upon completion, expiration, or maturity of an investment plan, certain percentage of the investment and/or earnings may be <strong className="text-foreground">automatically rolled over</strong> into a new or equivalent plan, subject to platform rules.
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 text-accent">7.2 Purpose of Rollover</h3>
                <p className="text-muted-foreground mb-3">The rollover mechanism is designed to:</p>
                <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                  <li>Promote <strong className="text-foreground">continuity of participation</strong>;</li>
                  <li>Prevent account inactivity or discontinuity;</li>
                  <li>Support long-term platform sustainability and operational stability.</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3 text-accent">7.3 Conditions & Discretion</h3>
                <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                  <li>Rollover is subject to eligibility, compliance, KYC status, and system availability.</li>
                  <li>The Company reserves the right to determine rollover percentages, timing, qualifying plans, and conditions.</li>
                  <li>Members will be notified of applicable rollover terms via the Platform.</li>
                </ul>
              </div>
            </section>

            {/* Section 8 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">8. Fees, Payments & Refunds</h2>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>All registration or package fees are clearly stated prior to payment.</li>
                <li>Fees are <strong className="text-foreground">non-refundable</strong> unless required by applicable law.</li>
                <li>Chargebacks, fraud, or abuse may result in account suspension.</li>
              </ul>
            </section>

            {/* Section 9 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">9. Prohibited Conduct</h2>
              <p className="text-muted-foreground mb-3">Members agree NOT to:</p>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>Misrepresent income potential or guarantee returns.</li>
                <li>Engage in fraudulent, deceptive, or unlawful activities.</li>
                <li>Spam, harass, or misuse Company branding.</li>
                <li>Create multiple or fake accounts.</li>
              </ul>
            </section>

            {/* Section 10 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">10. Termination</h2>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>The Company may suspend or terminate accounts for policy violations.</li>
                <li>Terminated accounts forfeit unpaid commissions.</li>
                <li>Members may terminate their saving account at any time by written notice.</li>
              </ul>
            </section>

            {/* Section 11 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">11. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                The Company shall not be liable for indirect, incidental, or consequential damages, including loss of income or data.
              </p>
            </section>

            {/* Section 12 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">12. Amendments</h2>
              <p className="text-muted-foreground">
                We may update these Terms from time to time. Continued use constitutes acceptance of changes.
              </p>
            </section>
          </div>

          {/* Back to top */}
          <div className="mt-12 pt-8 border-t border-border text-center">
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" /> Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border">
        <div className="container mx-auto max-w-4xl text-center text-sm text-muted-foreground space-y-1">
          <div>© {new Date().getFullYear()} Golden Wealth Achievers. All rights reserved.</div>
          <div>Powered by Bisolkay Int'l Company, duly registered in Nigeria.</div>
        </div>
      </footer>
    </div>
  );
};

export default Terms;
