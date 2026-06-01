import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Store, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft,
  Building,
  Car,
  Smartphone,
  Package
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const businessTypes = [
  { value: "real_estate", label: "Real Estate", icon: Building, description: "Properties, land, housing" },
  { value: "automobile", label: "Automobile", icon: Car, description: "Vehicles, parts, accessories" },
  { value: "electronic", label: "Electronics", icon: Smartphone, description: "Gadgets, devices, tech" },
  { value: "general", label: "General", icon: Package, description: "Mixed categories" },
];

const SellerApplication = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    businessDescription: "",
    businessAddress: "",
    businessPhone: "",
    businessEmail: "",
    registrationNumber: "",
    taxId: "",
    websiteUrl: "",
    yearsInBusiness: "",
    employeeCount: "",
    monthlyRevenue: "",
    inventorySize: "",
  });

  // Check for existing applications on component mount
  useEffect(() => {
    const checkExistingApplication = async () => {
      if (!user) {
        setIsLoadingExisting(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("seller_applications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (error) {
          console.error("Error checking existing application:", error);
        } else if (data && data.status !== 'rejected') {
          setExistingApplication(data);
        }
      } catch (err) {
        console.error("Failed to check existing application:", err);
      } finally {
        setIsLoadingExisting(false);
      }
    };

    checkExistingApplication();
  }, [user]);

  const [kycDocuments, setKycDocuments] = useState<File[]>([]);
  const [businessDocuments, setBusinessDocuments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('seller-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message}`);
    }

    return filePath;
  };

  const applyAsSeller = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error('User not authenticated');

      // Upload KYC documents
      const kycDocumentUrls = [];
      for (const doc of kycDocuments) {
        try {
          const filePath = await uploadFile(doc, `kyc/${user.id}`);
          kycDocumentUrls.push({
            name: doc.name,
            size: doc.size,
            type: doc.type,
            url: filePath
          });
        } catch (error) {
          console.error('Failed to upload KYC document:', error);
          throw new Error(`Failed to upload KYC document ${doc.name}`);
        }
      }

      // Upload business documents
      const businessDocumentUrls = [];
      for (const doc of businessDocuments) {
        try {
          const filePath = await uploadFile(doc, `business/${user.id}`);
          businessDocumentUrls.push({
            name: doc.name,
            size: doc.size,
            type: doc.type,
            url: filePath
          });
        } catch (error) {
          console.error('Failed to upload business document:', error);
          throw new Error(`Failed to upload business document ${doc.name}`);
        }
      }

      const { error } = await (supabase.rpc as any)("apply_as_seller", {
        p_business_name: data.businessName,
        p_business_type: data.businessType,
        p_business_description: data.businessDescription || null,
        p_business_address: data.businessAddress || null,
        p_business_phone: data.businessPhone || null,
        p_business_email: data.businessEmail || null,
        p_registration_number: data.registrationNumber || null,
        p_tax_id: data.taxId || null,
        p_website_url: data.websiteUrl || null,
        p_years_in_business: data.yearsInBusiness ? parseInt(data.yearsInBusiness) : null,
        p_employee_count: data.employeeCount ? parseInt(data.employeeCount) : null,
        p_monthly_revenue: data.monthlyRevenue ? parseFloat(data.monthlyRevenue) : null,
        p_inventory_size: data.inventorySize ? parseInt(data.inventorySize) : null,
        p_kyc_documents: kycDocumentUrls,
        p_business_documents: businessDocumentUrls,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted",
        description: "Your seller application has been submitted successfully. We'll review it within 3-5 business days.",
      });
      navigate("/dashboard");
    },
    onError: (error: any) => {
      toast({
        title: "Application Failed",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.businessName || !formData.businessType) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    applyAsSeller.mutate(formData);
  };

  const handleFileChange = (files: File[], setter: (files: File[]) => void) => {
    setter(files);
  };

  const selectedBusinessType = businessTypes.find(type => type.value === formData.businessType);

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Show loading state while checking existing application
  if (isLoadingExisting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-muted-foreground">Checking application status...</p>
        </div>
      </div>
    );
  }

  // Show existing application if found
  if (existingApplication) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary" />
                Application Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-4">
                <Badge variant={existingApplication.status === 'approved' ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                  {existingApplication.status.charAt(0).toUpperCase() + existingApplication.status.slice(1)}
                </Badge>
                <p className="text-lg font-medium">
                  Your application is currently <span className="font-semibold">{existingApplication.status}</span>
                </p>
                {existingApplication.status === 'pending' && (
                  <p className="text-muted-foreground">
                    We'll review your application within 3-5 business days.
                  </p>
                )}
                {existingApplication.status === 'approved' && (
                  <p className="text-green-600">
                    Congratulations! Your seller account has been approved.
                  </p>
                )}
                {existingApplication.status === 'rejected' && (
                  <p className="text-red-600">
                    Your application was rejected. Please contact support for details.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Button>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Golden Wealth Achievers logo" className="w-10 h-10 rounded-md shadow-md" />
            <h1 className="text-xl font-semibold">Become a Seller</h1>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <img src="/logo.png" alt="Golden Wealth Achievers logo" className="w-6 h-6 rounded-md shadow-sm" />
                Seller Application
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Join our trusted marketplace of verified sellers. As a seller, you'll be able to:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Create Listings</p>
                    <p className="text-sm text-muted-foreground">List products in your approved categories</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Receive Payments</p>
                    <p className="text-sm text-muted-foreground">Secure escrow payments with commission</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Build Reputation</p>
                    <p className="text-sm text-muted-foreground">Earn ratings and increase visibility</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Access Analytics</p>
                    <p className="text-sm text-muted-foreground">Track sales and performance metrics</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Application Form */}
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Business Type Selection */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Business Type *</Label>
                  <div className="grid md:grid-cols-2 gap-4">
                    {businessTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.value}
                          className={`p-4 border rounded-lg cursor-pointer transition-all ${
                            formData.businessType === type.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                          onClick={() => setFormData({ ...formData, businessType: type.value })}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className="w-6 h-6" />
                            <span className="font-medium">{type.label}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* Basic Business Information */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      placeholder="Enter your business name"
                      required
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
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessDescription">Business Description</Label>
                  <Textarea
                    id="businessDescription"
                    value={formData.businessDescription}
                    onChange={(e) => setFormData({ ...formData, businessDescription: e.target.value })}
                    placeholder="Describe your business, products, and services..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="businessAddress">Business Address</Label>
                  <Input
                    id="businessAddress"
                    value={formData.businessAddress}
                    onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                    placeholder="123 Business St, City, Country"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="businessPhone">Business Phone</Label>
                    <Input
                      id="businessPhone"
                      value={formData.businessPhone}
                      onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="websiteUrl">Website URL</Label>
                    <Input
                      id="websiteUrl"
                      value={formData.websiteUrl}
                      onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                      placeholder="https://www.yourbusiness.com"
                    />
                  </div>
                </div>

                <Separator />

                {/* Legal & Financial Information */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Legal & Financial Information</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="registrationNumber">Business Registration Number</Label>
                      <Input
                        id="registrationNumber"
                        value={formData.registrationNumber}
                        onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                        placeholder="Reg. #123456789"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                      <Input
                        id="taxId"
                        value={formData.taxId}
                        onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                        placeholder="Tax ID"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Business Metrics */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Business Metrics</h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="yearsInBusiness">Years in Business</Label>
                      <Input
                        id="yearsInBusiness"
                        type="number"
                        value={formData.yearsInBusiness}
                        onChange={(e) => setFormData({ ...formData, yearsInBusiness: e.target.value })}
                        placeholder="5"
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeCount">Number of Employees</Label>
                      <Input
                        id="employeeCount"
                        type="number"
                        value={formData.employeeCount}
                        onChange={(e) => setFormData({ ...formData, employeeCount: e.target.value })}
                        placeholder="10"
                        min="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="monthlyRevenue">Monthly Revenue ($)</Label>
                      <Input
                        id="monthlyRevenue"
                        type="number"
                        value={formData.monthlyRevenue}
                        onChange={(e) => setFormData({ ...formData, monthlyRevenue: e.target.value })}
                        placeholder="10000"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inventorySize">Inventory Size</Label>
                      <Input
                        id="inventorySize"
                        type="number"
                        value={formData.inventorySize}
                        onChange={(e) => setFormData({ ...formData, inventorySize: e.target.value })}
                        placeholder="100"
                        min="0"
                      />
                      <p className="text-xs text-muted-foreground">
                        Approximate number of products/items you plan to list
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Document Upload */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Required Documents</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label className="text-base font-medium">KYC Documents</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload government-issued ID, proof of address, and business registration documents
                      </p>
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drag and drop files here, or click to select
                        </p>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(Array.from(e.target.files || []), setKycDocuments)}
                          className="hidden"
                          id="kyc-documents"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('kyc-documents')?.click()}
                          className="mt-2"
                        >
                          Select Files
                        </Button>
                        {kycDocuments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {kycDocuments.map((doc, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <FileText className="w-4 h-4" />
                                <span>{doc.name}</span>
                                <Badge variant="secondary">{(doc.size / 1024).toFixed(1)} KB</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-base font-medium">Business Documents</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Upload business licenses, permits, certificates, and other relevant documents
                      </p>
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drag and drop files here, or click to select
                        </p>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(Array.from(e.target.files || []), setBusinessDocuments)}
                          className="hidden"
                          id="business-documents"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('business-documents')?.click()}
                          className="mt-2"
                        >
                          Select Files
                        </Button>
                        {businessDocuments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {businessDocuments.map((doc, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <FileText className="w-4 h-4" />
                                <span>{doc.name}</span>
                                <Badge variant="secondary">{(doc.size / 1024).toFixed(1)} KB</Badge>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Terms and Submit */}
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      By submitting this application, you confirm that all information provided is accurate and complete. 
                      False information may result in immediate rejection and potential legal action.
                    </AlertDescription>
                  </Alert>

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
                      disabled={isSubmitting || !formData.businessName || !formData.businessType || existingApplication}
                      className="flex-1"
                    >
                      {isSubmitting ? "Submitting..." : existingApplication ? "Application Already Submitted" : "Submit Application"}
                    </Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SellerApplication;
