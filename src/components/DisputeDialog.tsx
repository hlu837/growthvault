import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOpenDispute } from "@/hooks/useMarketplace";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface DisputeDialogProps {
  orderId: string;
  productTitle: string;
  trigger?: React.ReactNode;
}

export const DisputeDialog = ({ orderId, productTitle, trigger }: DisputeDialogProps) => {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm({
    defaultValues: {
      complaintType: "",
      preferredResolution: "",
      description: "",
      evidenceUrl: "",
    },
  });

  useEffect(() => {
    register("complaintType", { required: "Complaint type is required" });
    register("preferredResolution", { required: "Preferred resolution is required" });
    register("evidenceUrl", { required: "Evidence is required" });
  }, [register]);

  const openDispute = useOpenDispute();

  const onSubmit = async (data: any) => {
    try {
      await openDispute.mutateAsync({
        orderId,
        complaintType: data.complaintType,
        preferredResolution: data.preferredResolution,
        description: data.description,
        evidenceUrl: data.evidenceUrl || undefined,
      });

      toast.success("Dispute opened successfully. Escrow release has been paused.");
      setOpen(false);
    } catch (error) {
      toast.error("Failed to open dispute. Please try again.");
    }
  };

  const defaultTrigger = (
    <Button variant="destructive" size="sm" className="gap-2">
      <AlertTriangle className="w-4 h-4" />
      Open Dispute
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Open Dispute
          </DialogTitle>
          <DialogDescription>
            Opening a dispute will pause the escrow release countdown and require admin intervention.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="complaintType">Complaint Type *</Label>
            <Select onValueChange={(value) => setValue("complaintType", value, { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue placeholder="Select complaint type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="item_not_as_described">Item not as described</SelectItem>
                <SelectItem value="item_damaged">Item damaged or defective</SelectItem>
                <SelectItem value="seller_unresponsive">Seller unresponsive</SelectItem>
                <SelectItem value="fraud_suspected">Fraud suspected</SelectItem>
                <SelectItem value="delivery_issue">Delivery issue</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {errors.complaintType && (
              <p className="text-sm text-destructive">{errors.complaintType.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredResolution">Preferred Resolution *</Label>
            <Select onValueChange={(value) => setValue("preferredResolution", value, { shouldValidate: true })}>
              <SelectTrigger>
                <SelectValue placeholder="Select resolution" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full_refund">Full Refund</SelectItem>
                <SelectItem value="partial_refund">Partial Refund</SelectItem>
                <SelectItem value="replacement">Replacement</SelectItem>
              </SelectContent>
            </Select>
            {errors.preferredResolution && (
              <p className="text-sm text-destructive">{errors.preferredResolution.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              placeholder="Please describe the issue in detail..."
              {...register("description", { required: "Description is required" })}
              className="min-h-[100px]"
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="evidenceUrl">Evidence URL *</Label>
            <Input
              id="evidenceUrl"
              placeholder="https://example.com/evidence.jpg"
              {...register("evidenceUrl", { required: "Evidence is required" })}
            />
            {errors.evidenceUrl && (
              <p className="text-sm text-destructive">{errors.evidenceUrl.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Provide a link to photos, videos, or documents supporting your claim
            </p>
          </div>

          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-sm text-destructive font-medium">Important:</p>
            <ul className="text-sm text-destructive/80 mt-1 space-y-1">
              <li>• Opening a dispute will immediately pause escrow release</li>
              <li>• Admin review may take 1-3 business days</li>
              <li>• False disputes may result in account penalties</li>
            </ul>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={openDispute.isPending}
            >
              {openDispute.isPending ? "Opening Dispute..." : "Open Dispute"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};