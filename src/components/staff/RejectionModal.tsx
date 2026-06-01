import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface RejectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  type: "kyc" | "deposit";
  isPending?: boolean;
}

const rejectionReasons = {
  kyc: [
    { id: "blurry", label: "Blurry Image", description: "Document image is not clear enough" },
    { id: "expired", label: "Expired ID", description: "Document has passed its expiration date" },
    { id: "mismatch", label: "Document Mismatch", description: "Information doesn't match profile" },
    { id: "incomplete", label: "Incomplete Document", description: "Parts of the document are cut off" },
    { id: "invalid", label: "Invalid Document Type", description: "Document type not accepted" },
    { id: "other", label: "Other", description: "Custom reason required" },
  ],
  deposit: [
    { id: "no_proof", label: "Missing Proof", description: "No payment proof provided" },
    { id: "amount_mismatch", label: "Amount Mismatch", description: "Proof doesn't match claimed amount" },
    { id: "invalid_reference", label: "Invalid Reference", description: "Bank reference cannot be verified" },
    { id: "duplicate", label: "Duplicate Submission", description: "This deposit was already processed" },
    { id: "suspicious", label: "Suspicious Activity", description: "Transaction flagged for review" },
    { id: "other", label: "Other", description: "Custom reason required" },
  ],
};

const RejectionModal = ({
  open,
  onClose,
  onConfirm,
  title,
  description,
  type,
  isPending = false,
}: RejectionModalProps) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customReason, setCustomReason] = useState("");

  const reasons = rejectionReasons[type];

  const handleConfirm = () => {
    if (!selectedReason) return;
    
    const reason = selectedReason === "other" 
      ? customReason 
      : reasons.find(r => r.id === selectedReason)?.label || selectedReason;
    
    onConfirm(reason);
    handleClose();
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason("");
    onClose();
  };

  const isValid = selectedReason && (selectedReason !== "other" || customReason.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-slate-950 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <Label className="text-slate-300 text-sm font-semibold">
            Select Rejection Reason *
          </Label>
          
          <div className="grid grid-cols-2 gap-2">
            {reasons.map((reason) => (
              <button
                key={reason.id}
                onClick={() => setSelectedReason(reason.id)}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all",
                  selectedReason === reason.id
                    ? "border-red-500/50 bg-red-500/10"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                )}
              >
                <span className={cn(
                  "text-sm font-medium",
                  selectedReason === reason.id ? "text-red-400" : "text-slate-300"
                )}>
                  {reason.label}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">
                  {reason.description}
                </p>
              </button>
            ))}
          </div>

          {selectedReason === "other" && (
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">Custom Reason *</Label>
              <Textarea
                placeholder="Enter detailed rejection reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[80px]"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={handleClose}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? "Processing..." : "Confirm Rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RejectionModal;
