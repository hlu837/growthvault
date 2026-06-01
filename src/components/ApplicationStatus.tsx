import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, Clock, FileText, Store, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

interface SellerApplication {
  id: string;
  status: string;
  rejection_reason?: string;
  created_at: string;
  approved_at?: string;
}

const ApplicationStatus = () => {
  const { user, isSeller } = useAuth();
  const navigate = useNavigate();

  const { data: application, isLoading, refetch } = useQuery({
    queryKey: ["seller-application-status"],
    queryFn: async () => {
      if (!user) return null;
      
      console.log("Querying for user ID:", user.id);
      
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      console.log("Query result:", { data, error });
      
      if (error) throw error;
      return data && data.length > 0 ? data[0] as SellerApplication : null;
    },
    enabled: !!user,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 0, // Always consider data stale
  });

  // Immediate redirect when application is approved
  useEffect(() => {
    if (application?.status === 'approved') {
      console.log("Application approved, redirecting to seller dashboard");
      navigate('/seller/dashboard');
    }
  }, [application, navigate]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Application Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading your application status...</p>
        </CardContent>
      </Card>
    );
  }

  // If user is already a seller, show seller access message
  if (isSeller) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" /> Seller Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-medium">You have seller access!</span>
          </div>
          <p className="text-muted-foreground">
            Congratulations! Your seller application has been approved. You can now start listing products and managing your seller account.
          </p>
          <div className="flex gap-2">
            <Link to="/seller/listings/create">
              <Button>Create New Listing</Button>
            </Link>
            <Link to="/seller/listings">
              <Button variant="outline">Manage Listings</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!application) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" /> Become a Seller
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            You haven't submitted a seller application yet. Apply now to start selling on our marketplace.
          </p>
          <Link to="/seller/application">
            <Button>Apply to Become a Seller</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "rejected":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "rejected":
        return "Rejected";
      case "pending":
        return "Under Review";
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Application Status
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(application.status)}
            <span className="font-medium">Application {getStatusText(application.status)}</span>
          </div>
          <Badge className={getStatusColor(application.status)}>
            {getStatusText(application.status)}
          </Badge>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>Submitted: {new Date(application.created_at).toLocaleDateString()}</p>
          {application.approved_at && (
            <p>Approved: {new Date(application.approved_at).toLocaleDateString()}</p>
          )}
        </div>

        {application.status === "pending" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              Your application is currently under review. Our team typically processes applications within 24-72 hours. You'll receive a notification once a decision has been made.
            </p>
          </div>
        )}

        {application.status === "approved" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-800">
              Congratulations! Your seller application has been approved. You now have seller access and can start listing products on the marketplace.
            </p>
          </div>
        )}

        {application.status === "rejected" && application.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800 font-medium mb-2">Reason for rejection:</p>
            <p className="text-sm text-red-700">{application.rejection_reason}</p>
            <p className="text-sm text-red-800 mt-2">
              You can submit a new application once you've addressed the issues mentioned above.
            </p>
            <Link to="/seller/application" className="mt-3 inline-block">
              <Button size="sm">Submit New Application</Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApplicationStatus;
