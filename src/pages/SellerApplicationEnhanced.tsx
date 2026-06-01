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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
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
  Package,
  User,
  CreditCard,
  Shield,
  FileCheck,
  Lock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const categoryOptions = [
  { value: "real_estate", label: "Real Estate Seller", icon: Building, description: "Properties, land, housing" },
  { value: "automobile", label: "Automobile Dealer", icon: Car, description: "Vehicles, parts, accessories" },
  { value: "electronic", label: "Electronics Vendor", icon: Smartphone, description: "Gadgets, devices, tech" },
];

const securityQuestions = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was your first school?",
  "What is your favorite book?",
];

const SellerApplicationEnhanced = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    // Personal/Business Information
    accountType: "",
    fullName: profile?.full_name || "",
    username: "",
    businessName: "",
    businessDescription: "",
    businessAddress: "",
    businessPhone: "",
    businessEmail: profile?.email || "",
    registrationNumber: "",
    taxId: "",
    websiteUrl: "",
    yearsInBusiness: "",
    employeeCount: "",
    monthlyRevenue: "",
    
    // KYC Information
    dateOfBirth: "",
    nationality: "",
    residentialAddress: "",
    
    // Bank Details
    bankAccountName: "",
    bankName: "",
    bankAccountNumber: "",
    payoutMethod: "",
    
    // Security
    password: "",
    confirmPassword: "",
    securityQuestion: "",
    securityAnswer: "",
    
    // Agreements
    commitmentAgreement: false,
    escrowAgreement1: false,
    escrowAgreement2: false,
    escrowAgreement3: false,
    escrowAgreement4: false,
    disputeAgreement1: false,
    disputeAgreement2: false,
    disputeAgreement3: false,
    termsAgreement: false,
    
    // Final Declaration
    finalDeclarationSignature: "",
    finalDeclarationDate: new Date().toISOString().split('T')[0],
    
    // Categories (multi-select)
    appliedCategories: [] as string[],
    
    // Category-specific details
    realEstateSellerType: "",
    hasLegalAuthority: null,
    automobileSellerType: "",
    estimatedInventorySize: "",
    electronicsProductType: "",
    offersWarranty: null,
  });

  const [kycDocuments, setKycDocuments] = useState<File[]>([]);
  const [selfieDocuments, setSelfieDocuments] = useState<File[]>([]);
  const [utilityBillDocuments, setUtilityBillDocuments] = useState<File[]>([]);
  const [dealerLicenseDocuments, setDealerLicenseDocuments] = useState<File[]>([]);
  const [authorizationDocuments, setAuthorizationDocuments] = useState<File[]>([]);
  const [businessDocuments, setBusinessDocuments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const uploadFile = async (file: File, folder: string): Promise<string> => {
    const fileExt = file.name.split('.').pop() || 'bin';
    const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('seller-documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error(`Storage upload error for ${file.name}:`, uploadError);
      throw new Error(`Failed to upload ${file.name}: ${uploadError.message || 'Unknown storage error'}`);
    }

    return filePath;
  };

  const { data: existingApplication, isLoading: checkingApplication } = useQuery({
    queryKey: ['seller-application', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('seller_applications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data;
    },
    enabled: !!user,
  });

  const applyAsSeller = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!user) throw new Error('User not authenticated');

      // Validate password confirmation
      if (data.password !== data.confirmPassword) {
        throw new Error('Password confirmation does not match');
      }

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

      // Upload selfie documents
      const selfieDocumentUrls = [];
      for (const doc of selfieDocuments) {
        try {
          const filePath = await uploadFile(doc, `selfie/${user.id}`);
          selfieDocumentUrls.push({
            name: doc.name,
            size: doc.size,
            type: doc.type,
            url: filePath
          });
        } catch (error) {
          console.error('Failed to upload selfie document:', error);
          throw new Error(`Failed to upload selfie document ${doc.name}`);
        }
      }

      // Upload utility bill documents
      const utilityBillDocumentUrls = [];
      for (const doc of utilityBillDocuments) {
        try {
          const filePath = await uploadFile(doc, `utility_bill/${user.id}`);
          utilityBillDocumentUrls.push({
            name: doc.name,
            size: doc.size,
            type: doc.type,
            url: filePath
          });
        } catch (error) {
          console.error('Failed to upload utility bill document:', error);
          throw new Error(`Failed to upload utility bill document ${doc.name}`);
        }
      }

      // Upload dealer license documents
      const dealerLicenseDocumentUrls = [];
      for (const doc of dealerLicenseDocuments) {
        try {
          const filePath = await uploadFile(doc, `dealer_license/${user.id}`);
          dealerLicenseDocumentUrls.push({
            name: doc.name,
            size: doc.size,
            type: doc.type,
            url: filePath
          });
        } catch (error) {
          console.error('Failed to upload dealer license document:', error);
          throw new Error(`Failed to upload dealer license document ${doc.name}`);
        }
      }

      // Upload authorization documents
      const authorizationDocumentUrls = [];
      for (const doc of authorizationDocuments) {
        try {
          const filePath = await uploadFile(doc, `authorization/${user.id}`);
          authorizationDocumentUrls.push({
            name: doc.name,
            size: doc.size,
            type: doc.type,
            url: filePath
          });
        } catch (error) {
          console.error('Failed to upload authorization document:', error);
          throw new Error(`Failed to upload authorization document ${doc.name}`);
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
        p_account_type: data.accountType || null,
        p_full_name: data.fullName || null,
        p_username: data.username || null,
        p_business_name: data.businessName || null,
        p_business_type: data.appliedCategories[0] || null,
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
        p_date_of_birth: data.dateOfBirth || null,
        p_nationality: data.nationality || null,
        p_residential_address: data.residentialAddress || null,
        p_bank_account_name: data.bankAccountName || null,
        p_bank_name: data.bankName || null,
        p_bank_account_number: data.bankAccountNumber || null,
        p_payout_method: data.payoutMethod || null,
        p_password: data.password || null,
        p_security_question: data.securityQuestion || null,
        p_security_answer: data.securityAnswer || null,
        p_commitment_agreement: data.commitmentAgreement,
        p_escrow_agreement: data.escrowAgreement1 && data.escrowAgreement2 && data.escrowAgreement3 && data.escrowAgreement4,
        p_dispute_agreement: data.disputeAgreement1 && data.disputeAgreement2 && data.disputeAgreement3,
        p_terms_agreement: data.termsAgreement,
        p_final_declaration_signature: data.finalDeclarationSignature || null,
        p_final_declaration_date: data.finalDeclarationDate || null,
        p_applied_categories: data.appliedCategories,
        p_real_estate_seller_type: data.realEstateSellerType || null,
        p_has_legal_authority: data.hasLegalAuthority,
        p_automobile_seller_type: data.automobileSellerType || null,
        p_estimated_inventory_size: data.estimatedInventorySize ? parseInt(data.estimatedInventorySize) : null,
        p_electronics_product_type: data.electronicsProductType || null,
        p_offers_warranty: data.offersWarranty,
        p_kyc_documents: [...kycDocumentUrls, ...selfieDocumentUrls, ...utilityBillDocumentUrls],
        p_business_documents: [...businessDocumentUrls, ...dealerLicenseDocumentUrls, ...authorizationDocumentUrls],
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted",
        description: "Your seller application has been successfully submitted. Our team will review your information within 24–72 hours. You will receive a notification once your account is approved or if additional information is required.",
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
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const isFormComplete = (): boolean => {
    // Basic required fields
    if (!formData.fullName.trim()) return false;
    if (!formData.accountType) return false;
    if (!formData.businessEmail.trim()) return false;
    if (!formData.businessPhone.trim()) return false;
    
    // Business specific fields
    if (formData.accountType === "business") {
      if (!formData.businessName.trim()) return false;
      if (!formData.businessAddress.trim()) return false;
    }
    
    // Category selection
    if (formData.appliedCategories.length === 0) return false;
    
    // KYC fields
    if (!formData.dateOfBirth) return false;
    if (!formData.nationality.trim()) return false;
    if (!formData.residentialAddress.trim()) return false;
    if (kycDocuments.length === 0) return false;
    if (selfieDocuments.length === 0) return false;
    if (utilityBillDocuments.length === 0) return false;
    
    // Bank details
    if (!formData.bankAccountName.trim()) return false;
    if (!formData.bankName.trim()) return false;
    if (!formData.bankAccountNumber.trim()) return false;
    if (!formData.payoutMethod) return false;
    
    // Security
    if (!formData.password) return false;
    if (!formData.confirmPassword) return false;
    if (formData.password !== formData.confirmPassword) return false;
    
    // Category-specific fields
    if (formData.appliedCategories.includes("real_estate")) {
      if (!formData.realEstateSellerType) return false;
      if (formData.hasLegalAuthority === null) return false;
      if (authorizationDocuments.length === 0) return false;
    }
    
    if (formData.appliedCategories.includes("automobile")) {
      if (!formData.automobileSellerType) return false;
      if (!formData.estimatedInventorySize.trim()) return false;
      if (dealerLicenseDocuments.length === 0) return false;
    }
    
    if (formData.appliedCategories.includes("electronic")) {
      if (!formData.electronicsProductType) return false;
      if (formData.offersWarranty === null) return false;
    }
    
    // Agreements
    if (!formData.commitmentAgreement || 
        !formData.escrowAgreement1 || !formData.escrowAgreement2 || 
        !formData.escrowAgreement3 || !formData.escrowAgreement4 ||
        !formData.disputeAgreement1 || !formData.disputeAgreement2 || 
        !formData.disputeAgreement3 || !formData.termsAgreement) return false;
    
    // Final declaration
    if (!formData.finalDeclarationSignature.trim()) return false;
    if (!formData.finalDeclarationDate) return false;
    
    return true;
  };

  const validateForm = (): string | null => {
    if (!formData.fullName.trim()) return "Please enter your full name.";
    if (!formData.accountType) return "Please select an account type.";
    if (!formData.businessEmail.trim()) return "Please enter your email address.";
    if (!formData.businessPhone.trim()) return "Please enter your phone number.";
    if (formData.accountType === "business") {
      if (!formData.businessName.trim()) return "Please enter your business name.";
      if (!formData.businessAddress.trim()) return "Please enter your business address.";
    }
    if (formData.appliedCategories.length === 0) return "Please select at least one category.";
    if (!formData.dateOfBirth) return "Please enter your date of birth.";
    if (!formData.nationality.trim()) return "Please enter your nationality.";
    if (!formData.residentialAddress.trim()) return "Please enter your residential address.";
    
    // Only require documents if user has selected relevant categories
    if (formData.appliedCategories.length > 0) {
      if (kycDocuments.length === 0) return "Please upload your government ID.";
      if (selfieDocuments.length === 0) return "Please upload a selfie photo.";
      if (utilityBillDocuments.length === 0) return "Please upload a utility bill.";
      
      if (formData.appliedCategories.includes("real_estate") && authorizationDocuments.length === 0) {
        return "Please upload authorization documents for real estate.";
      }
      if (formData.appliedCategories.includes("automobile") && dealerLicenseDocuments.length === 0) {
        return "Please upload dealer license for automobile.";
      }
    }
    if (!formData.bankAccountName.trim()) return "Please enter your bank account name.";
    if (!formData.bankName.trim()) return "Please enter your bank name.";
    if (!formData.bankAccountNumber.trim()) return "Please enter your bank account number.";
    if (!formData.payoutMethod) return "Please select your preferred payout method.";
    if (!formData.password) return "Please create a password.";
    if (!formData.confirmPassword) return "Please confirm your password.";
    if (formData.password !== formData.confirmPassword) return "Password confirmation does not match.";
    if (formData.appliedCategories.includes("real_estate")) {
      if (!formData.realEstateSellerType) return "Please select your real estate seller type.";
      if (formData.hasLegalAuthority === null) return "Please answer whether you have legal authority to list properties.";
      if (authorizationDocuments.length === 0) return "Please upload authorization documents for real estate.";
    }
    if (formData.appliedCategories.includes("automobile")) {
      if (!formData.automobileSellerType) return "Please select your automobile seller type.";
      if (!formData.estimatedInventorySize.trim()) return "Please enter your estimated inventory size.";
    }
    if (formData.appliedCategories.includes("electronic")) {
      if (!formData.electronicsProductType) return "Please select your electronics product type.";
      if (formData.offersWarranty === null) return "Please specify whether you offer warranty.";
    }
    if (!formData.commitmentAgreement || 
        !formData.escrowAgreement1 || !formData.escrowAgreement2 || 
        !formData.escrowAgreement3 || !formData.escrowAgreement4 ||
        !formData.disputeAgreement1 || !formData.disputeAgreement2 || 
        !formData.disputeAgreement3 || !formData.termsAgreement) {
      return "Please accept all required agreements.";
    }
    if (!formData.finalDeclarationSignature.trim()) return "Please enter your full name in the final declaration.";
    if (!formData.finalDeclarationDate) return "Please select the final declaration date.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("Starting form submission...");
    
    const validationError = validateForm();
    if (validationError) {
      console.log("Validation failed:", validationError);
      toast({
        title: "Missing Information",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    console.log("Validation passed, starting submission...");
    setIsSubmitting(true);
    
    try {
      console.log("Calling applyAsSeller mutation...");
      const result = await applyAsSeller.mutateAsync(formData);
      console.log("Submission completed successfully:", result);
    } catch (error: any) {
      console.log("Submission failed:", error);
      console.log("Error details:", error?.message || error);
      // Error handling is already in the mutation config
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (files: File[], setter: (files: File[]) => void) => {
    setter(files);
  };

  const handleCategoryToggle = (category: string) => {
    setFormData(prev => ({
      ...prev,
      appliedCategories: prev.appliedCategories.includes(category)
        ? prev.appliedCategories.filter(c => c !== category)
        : [...prev.appliedCategories, category]
    }));
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (checkingApplication) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (existingApplication && existingApplication.status === 'pending') {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <div className="flex items-center gap-3">
              <Store className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-semibold">Seller Application</h1>
            </div>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-24 text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
              <Store className="w-10 h-10 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-4">Application Pending</h2>
          <p className="text-muted-foreground mb-8">
            You have already submitted a seller application. Our team is currently reviewing your information. You will be notified once your account is approved.
          </p>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Return to Dashboard
          </Button>
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
            <Store className="w-6 h-6 text-primary" />
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
                <Store className="w-6 h-6 text-primary" />
                Seller Application
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Join our trusted marketplace of verified sellers. Complete the form below to apply for seller status.
              </p>
            </CardContent>
          </Card>

          {/* Application Form */}
          <Card>
            <CardHeader>
              <CardTitle>PERSONAL / BUSINESS INFORMATION</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Account Type */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Account Type *</Label>
                  <RadioGroup
                    value={formData.accountType}
                    onValueChange={(value) => {
                      if (value !== formData.accountType) {
                        setFormData(prev => ({ ...prev, accountType: value }));
                      }
                    }}
                    className="flex flex-col space-y-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="individual" id="individual" />
                      <Label htmlFor="individual">Individual</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="business" id="business" />
                      <Label htmlFor="business">Registered Business</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Personal Information */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      placeholder="Choose a unique username"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="businessEmail">Email Address *</Label>
                    <Input
                      id="businessEmail"
                      type="email"
                      value={formData.businessEmail}
                      onChange={(e) => setFormData({ ...formData, businessEmail: e.target.value })}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessPhone">Phone Number *</Label>
                    <Input
                      id="businessPhone"
                      value={formData.businessPhone}
                      onChange={(e) => setFormData({ ...formData, businessPhone: e.target.value })}
                      placeholder="+1 (555) 123-4567"
                      required
                    />
                  </div>
                </div>

                {/* Business Information (if business account) */}
                {formData.accountType === 'business' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Business Details</h3>
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
                          <Label htmlFor="registrationNumber">Business Registration Number</Label>
                          <Input
                            id="registrationNumber"
                            value={formData.registrationNumber}
                            onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                            placeholder="Reg. #123456789"
                          />
                        </div>
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

                      <div className="space-y-2">
                        <Label htmlFor="taxId">Tax ID (Optional)</Label>
                        <Input
                          id="taxId"
                          value={formData.taxId}
                          onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                          placeholder="Tax ID"
                        />
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Category Application */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">CATEGORY APPLICATION (Select all that apply)</Label>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryOptions.map((category) => {
                      const Icon = category.icon;
                      const isSelected = formData.appliedCategories.includes(category.value);
                      return (
                        <div
                          key={category.value}
                          className={`w-full p-4 border rounded-lg transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex-shrink-0">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => handleCategoryToggle(category.value)}
                                onClick={(event) => event.stopPropagation()}
                              />
                            </div>
                            <div className="flex-shrink-0">
                              <Icon className="w-6 h-6" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium block truncate">{category.label}</span>
                              <p className="text-sm text-muted-foreground break-words">{category.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator />

                {/* KYC Verification */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">IDENTITY VERIFICATION (KYC)</Label>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth">Date of Birth</Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nationality">Nationality</Label>
                      <Input
                        id="nationality"
                        value={formData.nationality}
                        onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                        placeholder="Enter your nationality"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="residentialAddress">Residential Address</Label>
                    <Input
                      id="residentialAddress"
                      value={formData.residentialAddress}
                      onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
                      placeholder="Your residential address"
                    />
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-medium">Upload Required Documents</Label>
                    
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Government ID (Passport / NIN / Driver's License)
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
                      <p className="text-sm text-muted-foreground mb-2">
                        Selfie Photo (Live or Upload)
                      </p>
                      <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          Drag and drop files here, or click to select
                        </p>
                        <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png"
                          onChange={(e) => handleFileChange(Array.from(e.target.files || []), setSelfieDocuments)}
                          className="hidden"
                          id="selfie-documents"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('selfie-documents')?.click()}
                          className="mt-2"
                        >
                          Select Files
                        </Button>
                        {selfieDocuments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {selfieDocuments.map((doc, index) => (
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
                      <p className="text-sm text-muted-foreground mb-2">
                        Utility Bill (Proof of Address)
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
                          onChange={(e) => handleFileChange(Array.from(e.target.files || []), setUtilityBillDocuments)}
                          className="hidden"
                          id="utility-bill-documents"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('utility-bill-documents')?.click()}
                          className="mt-2"
                        >
                          Select Files
                        </Button>
                        {utilityBillDocuments.length > 0 && (
                          <div className="mt-4 space-y-2">
                            {utilityBillDocuments.map((doc, index) => (
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

                {/* Bank Details */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">BANK / PAYMENT DETAILS</Label>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountName">Account Name</Label>
                      <Input
                        id="bankAccountName"
                        value={formData.bankAccountName}
                        onChange={(e) => setFormData({ ...formData, bankAccountName: e.target.value })}
                        placeholder="Account holder name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bankName">Bank Name</Label>
                      <Input
                        id="bankName"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        placeholder="Bank name"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="bankAccountNumber">Account Number</Label>
                      <Input
                        id="bankAccountNumber"
                        value={formData.bankAccountNumber}
                        onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                        placeholder="Bank account number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payoutMethod">Preferred Payout Method</Label>
                      <Select
                        value={formData.payoutMethod}
                        onValueChange={(value) => setFormData({ ...formData, payoutMethod: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select payout method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                          <SelectItem value="mobile_money">Mobile Money</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Category-Specific Details */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">CATEGORY-SPECIFIC DETAILS</Label>
                  
                  {/* Real Estate Details */}
                  {formData.appliedCategories.includes('real_estate') && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2">
                        <Building className="w-4 h-4" /> Real Estate
                      </h4>
                      <div className="space-y-2">
                        <Label>Seller Type</Label>
                        <RadioGroup
                          value={formData.realEstateSellerType}
                          onValueChange={(value) => {
                            if (value !== formData.realEstateSellerType) {
                              setFormData(prev => ({ ...prev, realEstateSellerType: value }));
                            }
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="owner" id="owner" />
                            <Label htmlFor="owner">Owner</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="agent" id="agent" />
                            <Label htmlFor="agent">Agent</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="developer" id="developer" />
                            <Label htmlFor="developer">Developer</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Do you have legal authority to list properties?</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className={cn(
                            "cursor-pointer rounded-lg border p-4 flex items-center gap-3 transition",
                            formData.hasLegalAuthority === true ? "border-primary bg-primary/10" : "border-border bg-background"
                          )}>
                            <input
                              type="radio"
                              name="hasLegalAuthority"
                              value="yes"
                              checked={formData.hasLegalAuthority === true}
                              onChange={() => setFormData((prev) => ({ ...prev, hasLegalAuthority: true }))}
                              className="sr-only"
                            />
                            <span className={cn(
                              "h-4 w-4 rounded-full border flex items-center justify-center",
                              formData.hasLegalAuthority === true ? "border-primary bg-primary" : "border-border"
                            )}>
                              {formData.hasLegalAuthority === true && <span className="h-2 w-2 rounded-full bg-background" />}
                            </span>
                            <span>Yes</span>
                          </label>
                          <label className={cn(
                            "cursor-pointer rounded-lg border p-4 flex items-center gap-3 transition",
                            formData.hasLegalAuthority === false ? "border-primary bg-primary/10" : "border-border bg-background"
                          )}>
                            <input
                              type="radio"
                              name="hasLegalAuthority"
                              value="no"
                              checked={formData.hasLegalAuthority === false}
                              onChange={() => setFormData((prev) => ({ ...prev, hasLegalAuthority: false }))}
                              className="sr-only"
                            />
                            <span className={cn(
                              "h-4 w-4 rounded-full border flex items-center justify-center",
                              formData.hasLegalAuthority === false ? "border-primary bg-primary" : "border-border"
                            )}>
                              {formData.hasLegalAuthority === false && <span className="h-2 w-2 rounded-full bg-background" />}
                            </span>
                            <span>No</span>
                          </label>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Upload Authorization Documents
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
                            onChange={(e) => handleFileChange(Array.from(e.target.files || []), setAuthorizationDocuments)}
                            className="hidden"
                            id="authorization-documents"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('authorization-documents')?.click()}
                            className="mt-2"
                          >
                            Select Files
                          </Button>
                          {authorizationDocuments.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {authorizationDocuments.map((doc, index) => (
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
                  )}

                  {/* Automobile Details */}
                  {formData.appliedCategories.includes('automobile') && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2">
                        <Car className="w-4 h-4" /> Automobile
                      </h4>
                      <div className="space-y-2">
                        <Label>Seller Type</Label>
                        <RadioGroup
                          value={formData.automobileSellerType}
                          onValueChange={(value) => {
                            if (value !== formData.automobileSellerType) {
                              setFormData(prev => ({ ...prev, automobileSellerType: value }));
                            }
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="private" id="private" />
                            <Label htmlFor="private">Private Seller</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="dealer" id="dealer" />
                            <Label htmlFor="dealer">Dealer</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estimatedInventorySize">Estimated Inventory Size</Label>
                        <Input
                          id="estimatedInventorySize"
                          type="number"
                          value={formData.estimatedInventorySize}
                          onChange={(e) => setFormData({ ...formData, estimatedInventorySize: e.target.value })}
                          placeholder="Number of vehicles"
                        />
                      </div>
                      
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">
                          Dealer License (if available)
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
                            onChange={(e) => handleFileChange(Array.from(e.target.files || []), setDealerLicenseDocuments)}
                            className="hidden"
                            id="dealer-license-documents"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('dealer-license-documents')?.click()}
                            className="mt-2"
                          >
                            Select Files
                          </Button>
                          {dealerLicenseDocuments.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {dealerLicenseDocuments.map((doc, index) => (
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
                  )}

                  {/* Electronics Details */}
                  {formData.appliedCategories.includes('electronic') && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <h4 className="font-medium flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> Electronics
                      </h4>
                      <div className="space-y-2">
                        <Label>Product Type</Label>
                        <RadioGroup
                          value={formData.electronicsProductType}
                          onValueChange={(value) => {
                            if (value !== formData.electronicsProductType) {
                              setFormData(prev => ({ ...prev, electronicsProductType: value }));
                            }
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id="new" />
                            <Label htmlFor="new">New</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="refurbished" id="refurbished" />
                            <Label htmlFor="refurbished">Refurbished</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="used" id="used" />
                            <Label htmlFor="used">Used</Label>
                          </div>
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Do you offer warranty?</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className={cn(
                            "cursor-pointer rounded-lg border p-4 flex items-center gap-3 transition",
                            formData.offersWarranty === true ? "border-primary bg-primary/10" : "border-border bg-background"
                          )}>
                            <input
                              type="radio"
                              name="offersWarranty"
                              value="yes"
                              checked={formData.offersWarranty === true}
                              onChange={() => setFormData((prev) => ({ ...prev, offersWarranty: true }))}
                              className="sr-only"
                            />
                            <span className={cn(
                              "h-4 w-4 rounded-full border flex items-center justify-center",
                              formData.offersWarranty === true ? "border-primary bg-primary" : "border-border"
                            )}>
                              {formData.offersWarranty === true && <span className="h-2 w-2 rounded-full bg-background" />}
                            </span>
                            <span>Yes</span>
                          </label>
                          <label className={cn(
                            "cursor-pointer rounded-lg border p-4 flex items-center gap-3 transition",
                            formData.offersWarranty === false ? "border-primary bg-primary/10" : "border-border bg-background"
                          )}>
                            <input
                              type="radio"
                              name="offersWarranty"
                              value="no"
                              checked={formData.offersWarranty === false}
                              onChange={() => setFormData((prev) => ({ ...prev, offersWarranty: false }))}
                              className="sr-only"
                            />
                            <span className={cn(
                              "h-4 w-4 rounded-full border flex items-center justify-center",
                              formData.offersWarranty === false ? "border-primary bg-primary" : "border-border"
                            )}>
                              {formData.offersWarranty === false && <span className="h-2 w-2 rounded-full bg-background" />}
                            </span>
                            <span>No</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Security Section */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">SECURITY & DECLARATION</Label>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="password">Create Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="Create a secure password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        placeholder="Confirm your password"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="securityQuestion">Security Question (Optional)</Label>
                    <Select
                      value={formData.securityQuestion}
                      onValueChange={(value) => setFormData({ ...formData, securityQuestion: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select security question" />
                      </SelectTrigger>
                      <SelectContent>
                        {securityQuestions.map((question) => (
                          <SelectItem key={question} value={question}>
                            {question}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="securityAnswer">Answer</Label>
                    <Input
                      id="securityAnswer"
                      value={formData.securityAnswer}
                      onChange={(e) => setFormData({ ...formData, securityAnswer: e.target.value })}
                      placeholder="Your security answer"
                    />
                  </div>
                </div>

                <Separator />

                {/* Agreement Sections */}
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label className="text-base font-semibold">COMMITMENT AGREEMENT</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="commitmentAgreement"
                        checked={formData.commitmentAgreement}
                        onCheckedChange={(checked) => setFormData({ ...formData, commitmentAgreement: checked as boolean })}
                      />
                      <Label htmlFor="commitmentAgreement">
                        I agree to pay all required commitment/listing fees for Real Estate and Automobile listings before publishing.
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">ESCROW & PLATFORM POLICY AGREEMENT</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="escrowAgreement1"
                          checked={formData.escrowAgreement1}
                          onCheckedChange={(checked) => setFormData({ ...formData, escrowAgreement1: checked as boolean })}
                        />
                        <Label htmlFor="escrowAgreement1">
                          I understand and agree that all transactions must go through the platform escrow system
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="escrowAgreement2"
                          checked={formData.escrowAgreement2}
                          onCheckedChange={(checked) => setFormData({ ...formData, escrowAgreement2: checked as boolean })}
                        />
                        <Label htmlFor="escrowAgreement2">
                          I will not bypass the platform for direct payments
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="escrowAgreement3"
                          checked={formData.escrowAgreement3}
                          onCheckedChange={(checked) => setFormData({ ...formData, escrowAgreement3: checked as boolean })}
                        />
                        <Label htmlFor="escrowAgreement3">
                          The platform will deduct commission (8% or more)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="escrowAgreement4"
                          checked={formData.escrowAgreement4}
                          onCheckedChange={(checked) => setFormData({ ...formData, escrowAgreement4: checked as boolean })}
                        />
                        <Label htmlFor="escrowAgreement4">
                          Funds will only be released after buyer confirmation or dispute resolution
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">DISPUTE & LIABILITY AGREEMENT</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="disputeAgreement1"
                          checked={formData.disputeAgreement1}
                          onCheckedChange={(checked) => setFormData({ ...formData, disputeAgreement1: checked as boolean })}
                        />
                        <Label htmlFor="disputeAgreement1">
                          The platform has full authority to resolve disputes
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="disputeAgreement2"
                          checked={formData.disputeAgreement2}
                          onCheckedChange={(checked) => setFormData({ ...formData, disputeAgreement2: checked as boolean })}
                        />
                        <Label htmlFor="disputeAgreement2">
                          False listings or fraud will lead to account suspension or legal action
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="disputeAgreement3"
                          checked={formData.disputeAgreement3}
                          onCheckedChange={(checked) => setFormData({ ...formData, disputeAgreement3: checked as boolean })}
                        />
                        <Label htmlFor="disputeAgreement3">
                          I am responsible for accuracy of all listings
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-base font-semibold">TERMS & CONDITIONS</Label>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="termsAgreement"
                        checked={formData.termsAgreement}
                        onCheckedChange={(checked) => setFormData({ ...formData, termsAgreement: checked as boolean })}
                      />
                      <Label htmlFor="termsAgreement">
                        I agree to the{' '}
                        <a 
                          href="/terms" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Terms of Service
                        </a>
                        ,{' '}
                        <a 
                          href="/privacy" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Privacy Policy
                        </a>
                        , and{' '}
                        <a 
                          href="/marketplace-rules" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Marketplace Rules
                        </a>
                      </Label>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-base font-semibold">FINAL DECLARATION</Label>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      "I hereby confirm that all information provided is accurate and verifiable. I understand that any false information may result in rejection or permanent suspension."
                    </AlertDescription>
                  </Alert>
                  
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="finalDeclarationSignature">Full Name</Label>
                      <Input
                        id="finalDeclarationSignature"
                        value={formData.finalDeclarationSignature}
                        onChange={(e) => setFormData({ ...formData, finalDeclarationSignature: e.target.value })}
                        placeholder="Your full name as signature"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="finalDeclarationDate">Date</Label>
                      <Input
                        id="finalDeclarationDate"
                        type="date"
                        value={formData.finalDeclarationDate}
                        onChange={(e) => setFormData({ ...formData, finalDeclarationDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Submit Button */}
                <div className="flex flex-col gap-4 sm:flex-row">
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
                    {isSubmitting ? "Submitting..." : "🔴 SUBMIT APPLICATION"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SellerApplicationEnhanced;
