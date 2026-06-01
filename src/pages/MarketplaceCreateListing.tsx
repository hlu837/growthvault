import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, PackagePlus, UploadCloud, FileText, CheckCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MarketplaceCategory } from "@/hooks/useMarketplace";

const STEPS = ["Basic Info", "Asset Documents", "Preview & Submit"];

const MarketplaceCreateListing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<MarketplaceCategory>("electronic");
  
  // Specific Fields
  const [serialNumber, setSerialNumber] = useState("");
  const [vinNumber, setVinNumber] = useState("");

  // Document Files
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [doc1File, setDoc1File] = useState<File | null>(null); // Real Estate: Deed, Auto: Inspection, Elec: Receipt
  const [doc2File, setDoc2File] = useState<File | null>(null); // Real Estate: Survey, Auto: Registration
  
  const [declarationChecked, setDeclarationChecked] = useState(false);

  const getDocRequirements = () => {
    switch (category) {
      case "real_estate":
        return { doc1Label: "Deed of Assignment", doc2Label: "Survey Plan", requiresDoc2: true };
      case "automobile":
        return { doc1Label: "Vehicle Inspection Report", doc2Label: "Registration Documents", requiresDoc2: true };
      case "electronic":
      default:
        return { doc1Label: "Original Receipt", doc2Label: "", requiresDoc2: false };
    }
  };

  const { doc1Label, doc2Label, requiresDoc2 } = getDocRequirements();

  const handleNext = () => {
    if (currentStep === 0) {
      if (!title || !price || !category) {
        toast.error("Please fill in all required basic info.");
        return;
      }
    } else if (currentStep === 1) {
      if (!thumbnailFile) {
        toast.error("Please upload a primary photo for your listing.");
        return;
      }
      if (!doc1File) {
        toast.error(`Please upload the required document: ${doc1Label}`);
        return;
      }
      if (requiresDoc2 && !doc2File) {
        toast.error(`Please upload the required document: ${doc2Label}`);
        return;
      }
      if (category === "electronic" && !serialNumber) {
        toast.error("Serial Number is required for electronics.");
        return;
      }
      if (category === "automobile" && !vinNumber) {
        toast.error("VIN Number is required for automobiles.");
        return;
      }
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const uploadFile = async (file: File, pathFolder: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user?.id}/${pathFolder}/${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from("listing_documents")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from("listing_documents")
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!declarationChecked) return;
    setIsSubmitting(true);

    try {
      if (!user) throw new Error("Not authenticated");

      // 1. Upload Documents
      let thumbnailUrl = "";
      let doc1Url = "";
      let doc2Url = "";

      if (thumbnailFile) thumbnailUrl = await uploadFile(thumbnailFile, "thumbnails");
      if (doc1File) doc1Url = await uploadFile(doc1File, "documents");
      if (requiresDoc2 && doc2File) doc2Url = await uploadFile(doc2File, "documents");

      // 2. Determine initial status
      const needsFee = category === "real_estate" || category === "automobile";
      const initialStatus = "pending_verification";

      // 3. Build specifications JSON
      const specifications: any = {
        documents: {
          [doc1Label]: doc1Url,
          ...(requiresDoc2 && { [doc2Label]: doc2Url })
        }
      };

      if (category === "electronic") specifications.serial_number = serialNumber;
      if (category === "automobile") specifications.vin_number = vinNumber;

      // 4. Insert into marketplace_products
      const { data, error } = await supabase
        .from("marketplace_products")
        .insert({
          title,
          description,
          price: Number(price),
          category,
          location,
          status: initialStatus,
          currency: "USD", // Default or user setting
          stock_quantity: 1,
          images: thumbnailUrl ? [thumbnailUrl] : [],
          thumbnail_url: thumbnailUrl,
          created_by: user.id,
          specifications,
          featured: false,
          legal_accepted_at: new Date().toISOString(),
          listing_fee_paid: !needsFee
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Listing created successfully!");

      // 5. Redirect based on fee requirements
      if (needsFee && data) {
        navigate(`/seller/listing-fee/${data.id}`);
      } else {
        navigate("/seller/listings");
      }

    } catch (error: any) {
      console.error("Submit error:", error);
      toast.error(error.message || "Failed to create listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <PackagePlus className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Asset Onboarding</h1>
              <p className="text-sm text-muted-foreground">
                Create a new marketplace listing
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-secondary -z-10 rounded-full" />
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary -z-10 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }}
            />
            {STEPS.map((step, idx) => (
              <div key={step} className="flex flex-col items-center gap-2 bg-background px-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors
                  ${currentStep > idx ? 'bg-primary border-primary text-primary-foreground' : 
                    currentStep === idx ? 'border-primary text-primary' : 'border-muted text-muted-foreground'}`}>
                  {currentStep > idx ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-xs font-medium ${currentStep >= idx ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-border/50 bg-card/50 backdrop-blur-sm shadow-xl shadow-black/5">
          <CardHeader>
            <CardTitle>{STEPS[currentStep]}</CardTitle>
            <CardDescription>
              {currentStep === 0 && "Start with the core details of your asset."}
              {currentStep === 1 && "Upload required legal and verification documents based on your category."}
              {currentStep === 2 && "Review your listing and accept the legal declaration before submission."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* STEP 0: Basic Info */}
            {currentStep === 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <Label>Asset Category <span className="text-red-500">*</span></Label>
                  <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="electronic">Electronics & General</SelectItem>
                      <SelectItem value="automobile">Automobiles</SelectItem>
                      <SelectItem value="real_estate">Real Estate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Listing Title <span className="text-red-500">*</span></Label>
                  <Input 
                    placeholder="e.g., 2021 Tesla Model 3 / 4-Bedroom Villa / iPhone 13 Pro" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    placeholder="Describe your asset in detail..." 
                    className="min-h-[120px]"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Price (USD) <span className="text-red-500">*</span></Label>
                    <Input 
                      type="number" 
                      placeholder="0.00" 
                      value={price} 
                      onChange={e => setPrice(e.target.value)} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input 
                      placeholder="City, State" 
                      value={location} 
                      onChange={e => setLocation(e.target.value)} 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 1: Documents & Specifics */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                
                {/* Category Warning */}
                {(category === "real_estate" || category === "automobile") && (
                  <Alert className="bg-primary/10 border-primary/20">
                    <AlertDescription className="text-primary font-medium">
                      Note: You have selected a premium category. A listing fee will be required after submission before your asset becomes visible.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label>Primary Photo <span className="text-red-500">*</span></Label>
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:bg-secondary/20 transition-colors">
                    <Input 
                      type="file" 
                      className="hidden" 
                      id="thumbnail" 
                      accept="image/*"
                      onChange={e => setThumbnailFile(e.target.files?.[0] || null)}
                    />
                    <Label htmlFor="thumbnail" className="cursor-pointer flex flex-col items-center gap-2">
                      <UploadCloud className="w-8 h-8 text-muted-foreground" />
                      <span className="font-medium">{thumbnailFile ? thumbnailFile.name : "Click to upload a clear photo"}</span>
                      <span className="text-xs text-muted-foreground">JPEG, PNG up to 5MB</span>
                    </Label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Category Specifics</h3>
                  
                  {category === "electronic" && (
                    <div className="space-y-2">
                      <Label>Serial Number <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="Enter device serial number" 
                        value={serialNumber} 
                        onChange={e => setSerialNumber(e.target.value)} 
                      />
                    </div>
                  )}

                  {category === "automobile" && (
                    <div className="space-y-2">
                      <Label>VIN Number <span className="text-red-500">*</span></Label>
                      <Input 
                        placeholder="17-character Vehicle Identification Number" 
                        value={vinNumber} 
                        onChange={e => setVinNumber(e.target.value)} 
                      />
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{doc1Label} <span className="text-red-500">*</span></Label>
                      <Input 
                        type="file" 
                        onChange={e => setDoc1File(e.target.files?.[0] || null)}
                      />
                      <p className="text-xs text-muted-foreground">Required for verification.</p>
                    </div>

                    {requiresDoc2 && (
                      <div className="space-y-2">
                        <Label>{doc2Label} <span className="text-red-500">*</span></Label>
                        <Input 
                          type="file" 
                          onChange={e => setDoc2File(e.target.files?.[0] || null)}
                        />
                        <p className="text-xs text-muted-foreground">Required for verification.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Preview & Submit */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="rounded-lg border bg-card p-6 shadow-sm space-y-4">
                  <h3 className="font-semibold text-lg">Listing Preview</h3>
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div>
                      {thumbnailFile ? (
                        <div className="w-full aspect-video rounded-md bg-secondary/50 flex items-center justify-center overflow-hidden">
                          <img src={URL.createObjectURL(thumbnailFile)} alt="Preview" className="object-cover w-full h-full" />
                        </div>
                      ) : (
                        <div className="w-full aspect-video rounded-md bg-secondary/50 flex flex-col items-center justify-center text-muted-foreground">
                          <PackagePlus className="w-8 h-8 mb-2 opacity-50" />
                          <span>No Image</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="inline-block px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-md uppercase tracking-wider mb-2">
                        {category.replace('_', ' ')}
                      </div>
                      <h4 className="text-xl font-bold">{title || "Untitled Asset"}</h4>
                      <p className="text-2xl font-semibold text-primary">${price || "0.00"}</p>
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                        {description || "No description provided."}
                      </p>
                      {location && <p className="text-sm mt-2">📍 {location}</p>}
                    </div>
                  </div>
                  
                  <div className="border-t pt-4 mt-4">
                    <h5 className="font-medium mb-2">Attached Documents</h5>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {doc1File && <li className="flex items-center gap-2"><FileText className="w-3 h-3"/> {doc1Label}</li>}
                      {requiresDoc2 && doc2File && <li className="flex items-center gap-2"><FileText className="w-3 h-3"/> {doc2Label}</li>}
                      {serialNumber && <li>Serial Number: {serialNumber}</li>}
                      {vinNumber && <li>VIN: {vinNumber}</li>}
                    </ul>
                  </div>
                </div>

                <div className="bg-secondary/30 rounded-lg p-4 border border-border/50">
                  <div className="flex items-start space-x-3">
                    <Checkbox 
                      id="declaration" 
                      checked={declarationChecked}
                      onCheckedChange={(checked) => setDeclarationChecked(checked as boolean)}
                      className="mt-1"
                    />
                    <div className="space-y-1 leading-none">
                      <Label htmlFor="declaration" className="font-medium">
                        Section 18 Declaration (Mandatory)
                      </Label>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                        I confirm that all information provided is accurate and I accept that this submission is legally binding under the Marketplace Rules. I understand that fraudulent listings will result in immediate account suspension and legal action.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Navigation Buttons */}
          <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between rounded-b-xl">
            <Button 
              variant="outline" 
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
            >
              <ChevronLeft className="w-4 h-4 mr-2" /> Back
            </Button>

            {currentStep < STEPS.length - 1 ? (
              <Button onClick={handleNext}>
                Continue <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button 
                onClick={handleSubmit} 
                disabled={!declarationChecked || isSubmitting}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? "Submitting..." : "Submit Listing"}
              </Button>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};

export default MarketplaceCreateListing;
