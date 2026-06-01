import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";

interface TermsVersion {
  id: string;
  version_number: string;
  content: string;
  effective_date: string;
}

export const TermsAcceptanceModal: React.FC = () => {
  const { needsTermsAcceptance, acceptTerms } = useAuth();
  const [latestTerms, setLatestTerms] = useState<TermsVersion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (needsTermsAcceptance) {
      fetchLatestTerms();
    }
  }, [needsTermsAcceptance]);

  const fetchLatestTerms = async () => {
    const { data, error } = await supabase
      .from("terms_and_conditions_versions")
      .select("*")
      .order("effective_date", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error("Error fetching terms:", error);
      setError("Failed to load terms and conditions");
    } else {
      setLatestTerms(data);
    }
  };

  const handleAccept = async () => {
    if (!latestTerms) return;

    setIsLoading(true);
    setError(null);

    const { error } = await acceptTerms(latestTerms.id);

    if (error) {
      setError("Failed to accept terms. Please try again.");
    }

    setIsLoading(false);
  };

  if (!needsTermsAcceptance || !latestTerms) return null;

  return (
    <Dialog open={needsTermsAcceptance} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Terms and Conditions Update</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please review and accept the updated terms and conditions to continue using the platform.
          </p>

          <div className="text-sm text-muted-foreground">
            <strong>Version:</strong> {latestTerms.version_number} | <strong>Effective Date:</strong> {new Date(latestTerms.effective_date).toLocaleDateString()}
          </div>

          <ScrollArea className="h-96 border rounded p-4">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap font-sans">{latestTerms.content}</pre>
            </div>
          </ScrollArea>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              onClick={handleAccept}
              disabled={isLoading}
              className="min-w-24"
            >
              {isLoading ? "Accepting..." : "Accept Terms"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};