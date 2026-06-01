import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>
              <p className="text-muted-foreground">
                GrowthVault collects the following types of information:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Personal information (name, email, phone)</li>
                <li>Business information (company details, licenses)</li>
                <li>Financial information (bank details for payments)</li>
                <li>Identity verification documents</li>
                <li>Usage data and analytics</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
              <p className="text-muted-foreground">
                We use your information to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Process seller applications and verify identity</li>
                <li>Facilitate transactions and payments</li>
                <li>Provide customer support</li>
                <li>Improve our services</li>
                <li>Comply with legal requirements</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">3. Information Sharing</h2>
              <p className="text-muted-foreground">
                We may share your information with:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Buyers in completed transactions</li>
                <li>Payment processors for financial transactions</li>
                <li>Legal authorities when required by law</li>
                <li>Third-party service providers (with your consent)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">4. Data Security</h2>
              <p className="text-muted-foreground">
                We implement industry-standard security measures including:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>SSL encryption for data transmission</li>
                <li>Secure storage of sensitive documents</li>
                <li>Regular security audits</li>
                <li>Access controls and authentication</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">5. Your Rights</h2>
              <p className="text-muted-foreground">
                You have the right to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Access your personal information</li>
                <li>Correct inaccurate information</li>
                <li>Delete your account and data</li>
                <li>Opt-out of marketing communications</li>
                <li>Request data portability</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">6. Cookies and Tracking</h2>
              <p className="text-muted-foreground">
                We use cookies and similar technologies to:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Remember your preferences</li>
                <li>Analyze platform usage</li>
                <li>Provide personalized experiences</li>
                <li>Ensure security and fraud prevention</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">7. Contact Information</h2>
              <p className="text-muted-foreground">
                For privacy-related inquiries, contact us at privacy@growthvault.com
              </p>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Last updated: May 3, 2026
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
