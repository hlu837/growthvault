import { useState } from "react";
import { FileCheck, CreditCard, Fingerprint, Camera } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import DocumentPreview from "./DocumentPreview";
import { cn } from "@/lib/utils";

interface KYCDocumentGalleryProps {
  idDocumentUrl: string | null;
  passportUrl: string | null;
  selfieUrl: string | null;
  className?: string;
}

const KYCDocumentGallery = ({ 
  idDocumentUrl, 
  passportUrl, 
  selfieUrl,
  className 
}: KYCDocumentGalleryProps) => {
  const [activeTab, setActiveTab] = useState("id");

  const documents = [
    { 
      key: "id", 
      label: "ID Document", 
      url: idDocumentUrl, 
      icon: CreditCard,
      required: true 
    },
    { 
      key: "passport", 
      label: "Passport Photo", 
      url: passportUrl, 
      icon: Fingerprint,
      required: true 
    },
    { 
      key: "selfie", 
      label: "Selfie", 
      url: selfieUrl, 
      icon: Camera,
      required: true 
    },
  ];

  const uploadedCount = documents.filter(d => d.url).length;
  const allUploaded = uploadedCount === documents.length;

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Identity Documents
        </h3>
        <Badge 
          variant="outline" 
          className={cn(
            "font-mono text-[10px]",
            allUploaded 
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" 
              : "bg-amber-500/10 text-amber-400 border-amber-500/30"
          )}
        >
          {uploadedCount}/{documents.length} UPLOADED
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full bg-slate-900/50 border border-slate-800 p-1 h-auto">
          {documents.map((doc) => {
            const Icon = doc.icon;
            const hasDoc = !!doc.url;
            return (
              <TabsTrigger 
                key={doc.key} 
                value={doc.key}
                className={cn(
                  "flex-1 flex items-center gap-2 py-2 px-3 text-xs font-mono",
                  "data-[state=active]:bg-slate-800 data-[state=active]:text-white",
                  !hasDoc && "text-red-400"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{doc.label}</span>
                {hasDoc ? (
                  <FileCheck className="w-3 h-3 text-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {documents.map((doc) => (
          <TabsContent 
            key={doc.key} 
            value={doc.key} 
            className="flex-1 mt-3 data-[state=inactive]:hidden"
          >
            <DocumentPreview 
              filePath={doc.url}
              bucketName="kyc-documents"
              className="h-full min-h-[300px]"
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default KYCDocumentGallery;
