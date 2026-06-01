import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const SellerApplicationDebug = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    fullName: "",
    businessName: "",
    businessEmail: "",
    businessPhone: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      console.log("Starting submission with data:", formData);
      console.log("User ID:", user?.id);

      // Test basic database connection
      const { data: testData, error: testError } = await supabase
        .from('seller_applications')
        .select('id')
        .limit(1);

      console.log("Database test result:", { testData, testError });

      if (testError) {
        throw new Error(`Database connection failed: ${testError.message}`);
      }

      // Test function call with minimal parameters
      console.log("Testing apply_as_seller function...");
      
      const { data, error } = await supabase.rpc("apply_as_seller", {
        p_full_name: formData.fullName,
        p_business_name: formData.businessName,
        p_business_email: formData.businessEmail,
        p_business_phone: formData.businessPhone,
      });

      console.log("Function call result:", { data, error });

      if (error) {
        throw new Error(`Function call failed: ${error.message}`);
      }

      toast({
        title: "Success!",
        description: "Debug test completed successfully.",
      });

    } catch (error: any) {
      console.error("Submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Seller Application Debug</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <AlertDescription>
                This is a debug version to test basic functionality. Check browser console for detailed logs.
              </AlertDescription>
            </Alert>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter your full name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  placeholder="Enter business name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessEmail">Business Email</Label>
                <Input
                  id="businessEmail"
                  type="email"
                  value={formData.businessEmail}
                  onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                  placeholder="business@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="businessPhone">Business Phone</Label>
                <Input
                  id="businessPhone"
                  value={formData.businessPhone}
                  onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/dashboard")}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? "Testing..." : "Test Submission"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SellerApplicationDebug;
