import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const Privacy = () => {
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
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-8 font-mono text-sm">
            Last updated: January 2026
          </p>

          <div className="prose prose-invert max-w-none space-y-8">
            <p className="text-muted-foreground">
              Golden Wealth Achievers ("we", "our", or "the Company") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
            </p>

            {/* Section 1 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
              <div className="space-y-4 text-muted-foreground">
                <div>
                  <h3 className="text-foreground font-medium mb-2">Personal Information</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Full name and contact information</li>
                    <li>Government-issued identification documents (for KYC verification)</li>
                    <li>Bank account and payment details</li>
                    <li>Email address and phone number</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-foreground font-medium mb-2">Usage Information</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Login activity and IP addresses</li>
                    <li>Transaction history and investment records</li>
                    <li>Device information and browser type</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>To create and manage your account</li>
                <li>To process transactions and payouts</li>
                <li>To verify your identity (KYC compliance)</li>
                <li>To communicate important updates and notifications</li>
                <li>To prevent fraud and ensure platform security</li>
                <li>To comply with legal and regulatory requirements</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">3. Information Sharing</h2>
              <p className="text-muted-foreground mb-3">We may share your information with:</p>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>Payment processors and financial institutions</li>
                <li>Identity verification services</li>
                <li>Law enforcement when required by law</li>
                <li>Service providers who assist in platform operations</li>
              </ul>
              <p className="text-muted-foreground mt-3">
                We do <strong className="text-foreground">not</strong> sell your personal information to third parties.
              </p>
            </section>

            {/* Section 4 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">4. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures including encryption, secure servers, and access controls to protect your personal information. However, no method of transmission over the internet is 100% secure.
              </p>
            </section>

            {/* Section 5 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">5. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information for as long as your account is active or as needed to provide services. We may also retain information to comply with legal obligations, resolve disputes, and enforce agreements.
              </p>
            </section>

            {/* Section 6 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">6. Your Rights</h2>
              <p className="text-muted-foreground mb-3">You have the right to:</p>
              <ul className="space-y-2 text-muted-foreground list-disc list-inside">
                <li>Access and review your personal information</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account (subject to legal requirements)</li>
                <li>Opt-out of marketing communications</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">7. Cookies</h2>
              <p className="text-muted-foreground">
                We use cookies and similar technologies to enhance your experience, analyze usage patterns, and maintain security. You can manage cookie preferences through your browser settings.
              </p>
            </section>

            {/* Section 8 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">8. Changes to This Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy periodically. We will notify you of significant changes via email or platform notification. Continued use of the platform constitutes acceptance of the updated policy.
              </p>
            </section>

            {/* Section 9 */}
            <section className="p-6 rounded-md border border-border bg-card">
              <h2 className="text-xl font-semibold mb-4">9. Contact Us</h2>
              <p className="text-muted-foreground">
                If you have questions about this Privacy Policy or your personal information, please contact us through the platform's support system.
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

export default Privacy;
