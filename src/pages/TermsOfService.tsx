import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const TermsOfService = () => {
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
            <CardTitle className="text-2xl">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground">
                By accessing and using GrowthVault, you agree to be bound by these Terms of Service and all applicable laws and regulations.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">2. Seller Responsibilities</h2>
              <p className="text-muted-foreground">
                As a seller on GrowthVault, you are responsible for:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Providing accurate and complete information</li>
                <li>Maintaining valid licenses and certifications</li>
                <li>Ensuring all listings comply with applicable laws</li>
                <li>Responding promptly to buyer inquiries</li>
                <li>Fulfilling orders as described</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">3. Prohibited Activities</h2>
              <p className="text-muted-foreground">
                Sellers may not engage in:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Fraudulent or deceptive practices</li>
                <li>Sale of illegal or prohibited items</li>
                <li>Violation of intellectual property rights</li>
                <li>Manipulation of the marketplace system</li>
                <li>Harassment or abusive behavior</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">4. Fees and Payments</h2>
              <p className="text-muted-foreground">
                GrowthVault charges transaction fees and listing fees as outlined in our fee schedule. 
                All payments are processed through our secure payment system and are subject to our payment policies.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">5. Account Termination</h2>
              <p className="text-muted-foreground">
                We reserve the right to suspend or terminate accounts that violate these terms or engage in prohibited activities.
                Sellers may request account closure at any time.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">6. Limitation of Liability</h2>
              <p className="text-muted-foreground">
                GrowthVault is not liable for any indirect, incidental, or consequential damages arising from your use of our platform.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">7. Contact Information</h2>
              <p className="text-muted-foreground">
                For questions about these terms, contact us at legal@growthvault.com
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

export default TermsOfService;
