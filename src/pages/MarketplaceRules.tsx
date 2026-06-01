import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

const MarketplaceRules = () => {
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
            <CardTitle className="text-2xl">Marketplace Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">1. Listing Requirements</h2>
              <p className="text-muted-foreground">
                All listings must include:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Accurate and detailed descriptions</li>
                <li>Clear, high-quality images</li>
                <li>Honest pricing and fees</li>
                <li>Availability and shipping information</li>
                <li>Return and warranty policies</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">2. Prohibited Items</h2>
              <p className="text-muted-foreground">
                The following items cannot be listed:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Illegal goods or services</li>
                <li>Stolen or counterfeit items</li>
                <li>Weapons and dangerous materials</li>
                <li>Adult content or services</li>
                <li>Items requiring special licensing without proper documentation</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">3. Real Estate Rules</h2>
              <p className="text-muted-foreground">
                Real estate listings must:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Include property identification numbers</li>
                <li>Have proper legal authority documentation</li>
                <li>Disclose all known defects or issues</li>
                <li>Comply with local real estate laws</li>
                <li>Include accurate property boundaries and measurements</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">4. Automobile Rules</h2>
              <p className="text-muted-foreground">
                Vehicle listings must:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Include VIN numbers and vehicle history</li>
                <li>Have valid dealer licensing (for dealers)</li>
                <li>Disclose all accidents and repairs</li>
                <li>Include current mileage and condition</li>
                <li>Comply with local automotive regulations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">5. Electronics Rules</h2>
              <p className="text-muted-foreground">
                Electronics listings must:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Clearly indicate new, refurbished, or used condition</li>
                <li>Include warranty information if applicable</li>
                <li>Specify all accessories included</li>
                <li>Test functionality before listing</li>
                <li>Comply with electronic waste regulations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">6. Transaction Rules</h2>
              <p className="text-muted-foreground">
                All transactions must:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Use GrowthVault's escrow system</li>
                <li>Follow agreed-upon terms and timelines</li>
                <li>Include proper documentation and receipts</li>
                <li>Comply with tax and reporting requirements</li>
                <li>Maintain professional communication</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">7. Dispute Resolution</h2>
              <p className="text-muted-foreground">
                Disputes are handled through:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Direct negotiation between parties</li>
                <li>GrowthVault mediation services</li>
                <li>Escrow protection for buyers and sellers</li>
                <li>Evidence-based resolution process</li>
                <li>Fair market value assessments</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">8. Enforcement</h2>
              <p className="text-muted-foreground">
                Violations may result in:
              </p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-muted-foreground">
                <li>Listing removal and warnings</li>
                <li>Account suspension</li>
                <li>Financial penalties</li>
                <li>Permanent account termination</li>
                <li>Legal action for serious violations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4">9. Contact Information</h2>
              <p className="text-muted-foreground">
                For marketplace rule questions, contact us at marketplace@growthvault.com
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

export default MarketplaceRules;
