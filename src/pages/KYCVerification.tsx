import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Upload, FileCheck, AlertCircle, CheckCircle, Clock, Camera, CreditCard, Fingerprint } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import CameraCaptureBox from "@/components/kyc/CameraCaptureBox";

const ID_TYPES = [
  { value: "national_id", label: "National ID (NIN)" },
  { value: "voters_card", label: "Voter's Card" },
  { value: "drivers_license", label: "Driver's License" },
];

interface FileUploadProps {
  label: string;
  required?: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
  icon: React.ReactNode;
  description: string;
}

const FileUploadBox = ({ label, required, file, onFileChange, icon, description }: FileUploadProps) => {
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
      if (!validTypes.includes(selectedFile.type)) {
        toast({ 
          title: "Invalid file type", 
          description: "Please upload a JPG, PNG, WebP, or PDF file", 
          variant: "destructive" 
        });
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({ 
          title: "File too large", 
          description: "Maximum file size is 5MB", 
          variant: "destructive" 
        });
        return;
      }
      onFileChange(selectedFile);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="font-mono text-sm">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="border-[0.5px] border-dashed border-border rounded-md p-4 text-center hover:border-accent/50 transition-colors">
        {file ? (
          <div className="space-y-2">
            <FileCheck className="w-6 h-6 mx-auto text-accent" />
            <p className="text-xs font-mono text-muted-foreground truncate max-w-[200px] mx-auto">
              {file.name}
            </p>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => onFileChange(null)}
              className="font-mono text-xs h-7"
            >
              Remove
            </Button>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-secondary flex items-center justify-center">
              {icon}
            </div>
            <p className="text-sm text-foreground font-mono mb-1">{description}</p>
            <p className="text-xs text-muted-foreground font-mono">
              JPG, PNG, WebP, or PDF (max 5MB)
            </p>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleChange}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
};

const KYCVerification = () => {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [bvnNumber, setBvnNumber] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${user!.id}/${folder}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(fileName, file);

    if (error) throw error;
    return fileName;
  };

  const handleSubmit = async () => {
    if (!idType || !idNumber || !idFile || !passportFile || !selfieFile) {
      toast({ 
        title: "Missing required fields", 
        description: "Please complete all required fields and upload all documents", 
        variant: "destructive" 
      });
      return;
    }

    if (!user) return;

    setUploading(true);
    try {
      // Upload all files
      const [idUrl, passportUrl, selfieUrl] = await Promise.all([
        uploadFile(idFile, "id"),
        uploadFile(passportFile, "passport"),
        uploadFile(selfieFile, "selfie"),
      ]);

      // Update profile with KYC info
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          id_type: idType,
          id_number: idNumber,
          bvn_number: bvnNumber || null,
          kyc_document_url: idUrl,
          passport_url: passportUrl,
          selfie_url: selfieUrl,
          kyc_status: "pending",
          kyc_submitted_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast({ 
        title: "Verification submitted", 
        description: "Your documents are being reviewed. This usually takes 1-2 business days." 
      });
      
      navigate("/dashboard");
    } catch (error: any) {
      console.error("KYC submission error:", error);
      toast({ 
        title: "Submission failed", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusDisplay = () => {
    switch (profile?.kyc_status) {
      case "approved":
        return (
          <div className="p-6 rounded-md border border-accent/50 bg-accent/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold text-accent">{t("kyc.identityVerified")}</h2>
                <p className="text-sm text-muted-foreground">{t("kyc.fullAccess")}</p>
              </div>
            </div>
          </div>
        );
      case "pending":
        return (
          <div className="p-6 rounded-md border border-warning/50 bg-warning/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-warning/20 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
              <div>
                <h2 className="font-semibold text-warning">{t("kyc.verificationPending")}</h2>
                <p className="text-sm text-muted-foreground">{t("kyc.reviewTime")}</p>
              </div>
            </div>
          </div>
        );
      case "rejected":
        return (
          <div className="p-6 rounded-md border border-destructive/50 bg-destructive/10 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h2 className="font-semibold text-destructive">{t("kyc.verificationRejected")}</h2>
                <p className="text-sm text-muted-foreground">{t("kyc.resubmit")}</p>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // If already verified, show status only
  if (profile?.kyc_status === "approved") {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono">{t("kyc.title")}</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">{t("kyc.subtitle")}</p>
          </div>
          {getStatusDisplay()}
        </div>
      </DashboardLayout>
    );
  }

  // If pending AND documents were actually submitted, show status only
  if (profile?.kyc_status === "pending" && profile?.kyc_document_url) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono">{t("kyc.title")}</h1>
            <p className="text-muted-foreground mt-1 font-mono text-sm">{t("kyc.subtitle")}</p>
          </div>
          {getStatusDisplay()}
        </div>
      </DashboardLayout>
    );
  }

  const isFormValid = idType && idNumber && idFile && passportFile && selfieFile;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-mono">{t("kyc.title")}</h1>
          <p className="text-muted-foreground mt-1 font-mono text-sm">{t("kyc.subtitle")}</p>
        </div>

        {/* Show rejected status if applicable */}
        {profile?.kyc_status === "rejected" && getStatusDisplay()}

        {/* KYC Form */}
        <div className="p-6 rounded-md border-[0.5px] border-border bg-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold font-mono">{t("kyc.submitDocuments")}</h2>
              <p className="text-sm text-muted-foreground font-mono">{t("kyc.uploadRequired")}</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* ID Type Selection */}
            <div className="space-y-2">
              <Label className="font-mono text-sm">{t("kyc.idType")} <span className="text-destructive">*</span></Label>
              <Select value={idType} onValueChange={setIdType}>
                <SelectTrigger className="font-mono border-[0.5px]">
                  <SelectValue placeholder={t("kyc.selectIdType")} />
                </SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="font-mono">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ID Number */}
            <div className="space-y-2">
              <Label className="font-mono text-sm">{t("kyc.idNumber")} <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Enter your ID number"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="font-mono border-[0.5px]"
              />
            </div>

            {/* BVN Number (Optional) */}
            <div className="space-y-2">
              <Label className="font-mono text-sm">
                {t("kyc.bvnNumber")} <span className="text-muted-foreground text-xs">({t("kyc.bvnOptional")})</span>
              </Label>
              <Input
                placeholder="Enter your 11-digit BVN"
                value={bvnNumber}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 11);
                  setBvnNumber(value);
                }}
                className="font-mono border-[0.5px]"
                maxLength={11}
              />
              <p className="text-xs text-muted-foreground font-mono">{t("kyc.bvnDesc")}</p>
            </div>

            {/* Document Uploads */}
            <div className="pt-2 border-t border-border">
              <h3 className="font-mono text-sm font-medium mb-4">{t("kyc.documentUploads")}</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <FileUploadBox
                  label="ID Document"
                  required
                  file={idFile}
                  onFileChange={setIdFile}
                  icon={<CreditCard className="w-5 h-5 text-muted-foreground" />}
                  description={t("kyc.uploadIdCard")}
                />
                <FileUploadBox
                  label="Passport Photo"
                  required
                  file={passportFile}
                  onFileChange={setPassportFile}
                  icon={<Fingerprint className="w-5 h-5 text-muted-foreground" />}
                  description={t("kyc.uploadPassport")}
                />
                <CameraCaptureBox
                  label="Selfie Photo"
                  required
                  file={selfieFile}
                  onFileChange={setSelfieFile}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              className="w-full font-mono" 
              onClick={handleSubmit}
              disabled={uploading || !isFormValid}
            >
              {uploading ? t("kyc.uploading") : t("kyc.submitForVerification")}
            </Button>

            <p className="text-xs text-muted-foreground font-mono text-center">{t("kyc.documentsSecure")}</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default KYCVerification;
