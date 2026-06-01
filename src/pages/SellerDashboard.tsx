import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Store, ArrowLeft, Info, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ApplicationStatus from "@/components/ApplicationStatus";

const SellerDashboard = () => {
  const navigate = useNavigate();
  const { user, isSeller } = useAuth();

  const { data: sellerProfile } = useQuery({
    queryKey: ["seller-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("seller_profiles")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isSeller,
  });

  const isHighValueCategory = sellerProfile?.business_type === 'real_estate' || sellerProfile?.business_type === 'automobiles';

  useEffect(() => {
    if (!user) {
      navigate("/auth");
    }
  }, [navigate, user]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Seller Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Manage your selling experience on the marketplace.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <ApplicationStatus />
        {isSeller && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Seller Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Welcome back, seller.</p>
                  <p className="text-sm text-muted-foreground">
                    Manage your listings, view seller payments, and keep an eye on order activity.
                  </p>
                </div>
                <div className="grid gap-3">
                  <Link to="/marketplace">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Store className="w-4 h-4" /> Browse marketplace
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Seller Next Steps</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isHighValueCategory && (
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-900 rounded-lg p-4 mb-4 flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-800 dark:text-blue-300">Listing Fees Required</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                        As an approved seller in a premium category (Real Estate or Automobiles), you must pay listing fees to activate your inventory and make items visible to buyers.
                      </p>
                      <Link to="/seller/listings/create">
                        <Button size="sm" variant="outline" className="mt-3 bg-white dark:bg-slate-900">
                          Create & Pay for Listing
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
                
                <ul className="space-y-3 text-sm text-muted-foreground list-disc list-inside">
                  <li>Create listings now that your seller account is approved.</li>
                  <li>Pay listing fees for categories that require them.</li>
                  <li>Respond quickly to buyer requests and disputes.</li>
                </ul>
                <p className="text-xs text-muted-foreground">
                  Note: The seller dashboard is intentionally kept lightweight until seller product creation is enabled.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default SellerDashboard;
