import { Link } from "react-router-dom";
import { AlertTriangle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KYCGuardProps {
  kycStatus: string | undefined | null;
}

const KYCGuard = ({ kycStatus }: KYCGuardProps) => {
  if (kycStatus === "approved") {
    return null;
  }

  return (
    <div className="p-4 rounded-md border-[0.5px] border-warning/50 bg-warning/10 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-warning/20 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-warning font-mono text-sm">
            Identity Verification Required
          </h3>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Please complete KYC verification to withdraw or transfer funds.
          </p>
          <Button 
            asChild 
            size="sm" 
            variant="outline" 
            className="mt-3 font-mono border-warning/50 text-warning hover:bg-warning/10"
          >
            <Link to="/dashboard/kyc">
              <Shield className="w-4 h-4 mr-2" />
              Verify Now
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default KYCGuard;