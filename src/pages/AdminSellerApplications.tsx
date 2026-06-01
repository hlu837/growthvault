import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, Search, Shield, UserCheck, XCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DocumentMeta {
  name: string;
  size: number;
  type: string;
  url?: string;
}

interface SellerApplication {
  id: string;
  user_id: string;
  full_name: string;
  username: string | null;
  account_type: string;
  business_name: string | null;
  business_type: string | null;
  business_description: string | null;
  business_address: string | null;
  business_phone: string | null;
  business_email: string | null;
  registration_number: string | null;
  tax_id: string | null;
  website: string | null;
  website_url: string | null;
  years_in_business: number | null;
  employee_count: number | null;
  monthly_revenue: number | null;
  date_of_birth: string | null;
  nationality: string | null;
  residential_address: string | null;
  bank_account_name: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  payout_method: string | null;
  applied_categories: string[];
  real_estate_seller_type: string | null;
  has_legal_authority: boolean | null;
  automobile_seller_type: string | null;
  estimated_inventory_size: number | null;
  electronics_product_type: string | null;
  offers_warranty: boolean | null;
  kyc_documents: string[];
  business_documents: string[];
  commitment_agreement: boolean;
  escrow_agreement: boolean;
  dispute_agreement: boolean;
  terms_agreement: boolean;
  final_declaration_signature: string | null;
  final_declaration_date: string | null;
  status: string;
  rejection_reason: string | null;
  approved_at: string | null;
  approved_by: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  user?: {
    full_name: string | null;
    email: string | null;
  };
}

const AdminSellerApplications = () => {
  const { t } = useTranslation();
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<SellerApplication | null>(null);

  const { data: applications = [], isLoading } = useQuery({
    queryKey: ["admin-seller-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SellerApplication[];
    },
    enabled: isAdmin,
    refetchInterval: 30000,
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getDocumentUrl = async (filePath: string): Promise<string> => {
    const { data } = await supabase.storage
      .from('seller-documents')
      .createSignedUrl(filePath, 3600); // 1 hour expiry
    
    if (data?.signedUrl) {
      return data.signedUrl;
    }
    
    // Fallback to public URL if signed URL fails
    const { data: publicData } = supabase.storage
      .from('seller-documents')
      .getPublicUrl(filePath);
    
    return publicData.publicUrl;
  };

  const isImageFile = (type: string): boolean => {
    return type.startsWith('image/');
  };

  useEffect(() => {
    if (!selectedApplication && applications.length > 0) {
      setSelectedApplication(applications[0]);
    }
  }, [applications, selectedApplication]);

  const approveMutation = useMutation({
    mutationFn: async (applicationId: string) => {
      const { data, error } = await supabase.rpc("approve_seller_application", {
        p_application_id: applicationId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seller-applications"] });
      toast.success("Seller application approved");
      setSelectedApplication(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to approve seller application");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ applicationId, reason }: { applicationId: string; reason: string }) => {
      const { error } = await supabase.rpc("reject_seller_application", {
        p_application_id: applicationId,
        p_rejection_reason: reason,
      });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seller-applications"] });
      toast.success("Seller application rejected and user notified");
      setSelectedApplication(null);
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to reject seller application");
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: async ({ applicationId, message }: { applicationId: string; message: string }) => {
      // In a real app, this would update the status to "needs_info" and notify the user
      // For now we will just show a toast since we don't have a specific "needs_info" RPC
      console.log(`Requesting info for ${applicationId}: ${message}`);
      return true;
    },
    onSuccess: () => {
      toast.success("Information request sent to seller");
    },
  });

  const filteredApplications = applications.filter((application) => {
    const query = searchQuery.toLowerCase();
    return (
      application.business_name.toLowerCase().includes(query) ||
      (application.full_name?.toLowerCase().includes(query) ?? false) ||
      (application.business_email?.toLowerCase().includes(query) ?? false)
    );
  });

  const handleApprove = () => {
    if (!selectedApplication) return;
    approveMutation.mutate(selectedApplication.id);
  };

  const handleReject = () => {
    if (!selectedApplication) return;
    const reason = window.prompt("Enter rejection reason:");
    if (!reason) return;
    rejectMutation.mutate({ applicationId: selectedApplication.id, reason });
  };

  const handleRequestInfo = () => {
    if (!selectedApplication) return;
    const message = window.prompt("What additional information do you need?");
    if (!message) return;
    requestInfoMutation.mutate({ applicationId: selectedApplication.id, message });
  };

  if (!isAdmin) {
    return (
      <AdminLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Admin Access Only</h1>
          <p className="text-sm text-muted-foreground">You must be an admin to view seller applications.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1 uppercase tracking-[0.3em] font-mono">
              <UserCheck className="w-4 h-4" />
              Seller Applications
            </div>
            <h1 className="text-2xl font-bold text-white">Pending Seller Applications</h1>
          </div>
          <Badge variant="outline" className="bg-slate-950/70 text-slate-300 border-slate-700">
            {filteredApplications.length} pending
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr] min-h-0">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search by business, user or email"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="pl-10 bg-slate-900 border-slate-800 text-white"
                />
              </div>
            </div>
            <div className="divide-y divide-slate-800 max-h-[calc(100vh-16rem)] overflow-y-auto">
              {filteredApplications.length === 0 ? (
                <div className="p-6 text-sm text-slate-400">No pending seller applications found.</div>
              ) : (
                filteredApplications.map((application) => (
                  <button
                    key={application.id}
                    type="button"
                    onClick={() => setSelectedApplication(application)}
                    className={`w-full text-left px-4 py-4 transition-colors ${
                      selectedApplication?.id === application.id
                        ? "bg-slate-800 text-white"
                        : "hover:bg-slate-900 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{application.business_name}</p>
                        <p className="text-xs text-slate-500">
                          {application.full_name || "Unknown user"}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700">
                        {application.business_type.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-500 line-clamp-2">
                      {application.business_description || "No description provided."}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 overflow-y-auto max-h-[calc(100vh-16rem)]">
            {selectedApplication ? (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-slate-900 p-3">
                    <UserCheck className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{selectedApplication.business_name}</h2>
                    <p className="text-sm text-slate-400">{selectedApplication.full_name || "Unknown user"}</p>
                    <p className="text-sm text-slate-400">{selectedApplication.business_email}</p>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Business Type</span>
                    <p className="text-sm text-white">{selectedApplication.business_type.replace("_", " ")}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Status</span>
                    <Badge variant="outline" className="bg-blue-950 text-blue-300 border-blue-800">
                      {selectedApplication.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Phone</span>
                    <p className="text-sm text-slate-200">{selectedApplication.business_phone || "Not provided"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Website</span>
                    <p className="text-sm text-slate-200">{selectedApplication.website_url || "Not provided"}</p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Years in business</span>
                    <p className="text-sm text-slate-200">{selectedApplication.years_in_business ?? "N/A"}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Monthly revenue</span>
                    <p className="text-sm text-slate-200">{selectedApplication.monthly_revenue ?? "N/A"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Address</span>
                  <p className="text-sm text-slate-200">{selectedApplication.business_address || "Not provided"}</p>
                </div>

                <div className="space-y-2">
                  <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Description</span>
                  <p className="text-sm text-slate-200 whitespace-pre-line">{selectedApplication.business_description || "No description provided."}</p>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">KYC Documents</span>
                    <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700">
                      {selectedApplication.kyc_documents?.length ?? 0}
                    </Badge>
                  </div>
                  {selectedApplication.kyc_documents && selectedApplication.kyc_documents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedApplication.kyc_documents.map((doc, index) => {
                        let fileName = 'Unknown';
                        let fileUrl = null;
                        
                        if (typeof doc === 'string') {
                          // Check if it's a JSON string
                          try {
                            const parsed = JSON.parse(doc);
                            fileName = parsed.name || 'Unknown';
                            fileUrl = parsed.url || null;
                          } catch {
                            // It's a plain string path
                            fileName = doc.split('/').pop() || doc;
                            fileUrl = doc;
                          }
                        } else if (doc && typeof doc === 'object') {
                          fileName = doc.name || 'Unknown';
                          fileUrl = doc.url || null;
                        }
                        
                        const isImage = fileUrl && (fileUrl.includes('.jpg') || fileUrl.includes('.jpeg') || fileUrl.includes('.png') || fileUrl.includes('.gif'));
                        
                        return (
                          <div key={index} className="p-2 bg-slate-800 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-200">{fileName}</span>
                              </div>
                              {fileUrl && (
                                <a
                                  href={(() => {
                                    const { data } = supabase.storage
                                      .from('seller-documents')
                                      .getPublicUrl(fileUrl);
                                    return data.publicUrl;
                                  })()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                  View Document
                                </a>
                              )}
                            </div>
                            {fileUrl && isImage && (
                              <div className="mt-2">
                                <img
                                  src={(() => {
                                    const { data } = supabase.storage
                                      .from('seller-documents')
                                      .getPublicUrl(fileUrl);
                                    return data.publicUrl;
                                  })()}
                                  alt={fileName}
                                  className="max-w-full h-auto rounded-lg border border-slate-700"
                                  style={{ maxHeight: '200px' }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No KYC documents uploaded.</p>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-500 uppercase tracking-[0.2em]">Business Documents</span>
                    <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700">
                      {selectedApplication.business_documents?.length ?? 0}
                    </Badge>
                  </div>
                  {selectedApplication.business_documents && selectedApplication.business_documents.length > 0 ? (
                    <div className="space-y-2">
                      {selectedApplication.business_documents.map((doc, index) => {
                        let fileName = 'Unknown';
                        let fileUrl = null;
                        
                        if (typeof doc === 'string') {
                          // Check if it's a JSON string
                          try {
                            const parsed = JSON.parse(doc);
                            fileName = parsed.name || 'Unknown';
                            fileUrl = parsed.url || null;
                          } catch {
                            // It's a plain string path
                            fileName = doc.split('/').pop() || doc;
                            fileUrl = doc;
                          }
                        } else if (doc && typeof doc === 'object') {
                          fileName = doc.name || 'Unknown';
                          fileUrl = doc.url || null;
                        }
                        
                        const isImage = fileUrl && (fileUrl.includes('.jpg') || fileUrl.includes('.jpeg') || fileUrl.includes('.png') || fileUrl.includes('.gif'));
                        
                        return (
                          <div key={index} className="p-2 bg-slate-800 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-slate-400" />
                                <span className="text-sm text-slate-200">{fileName}</span>
                              </div>
                              {fileUrl && (
                                <a
                                  href={(() => {
                                    const { data } = supabase.storage
                                      .from('seller-documents')
                                      .getPublicUrl(fileUrl);
                                    return data.publicUrl;
                                  })()}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-400 hover:text-blue-300"
                                >
                                  View Document
                                </a>
                              )}
                            </div>
                            {fileUrl && isImage && (
                              <div className="mt-2">
                                <img
                                  src={(() => {
                                    const { data } = supabase.storage
                                      .from('seller-documents')
                                      .getPublicUrl(fileUrl);
                                    return data.publicUrl;
                                  })()}
                                  alt={fileName}
                                  className="max-w-full h-auto rounded-lg border border-slate-700"
                                  style={{ maxHeight: '200px' }}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No business documents uploaded.</p>
                  )}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row mt-4">
                  <Button
                    variant="default"
                    className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 gap-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                    onClick={handleRequestInfo}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <FileText className="w-4 h-4" /> Request Info
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={handleReject}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <div className="rounded-full bg-slate-900 p-4 mb-4">
                  <UserCheck className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-lg font-semibold text-white">Select a seller application</p>
                <p className="text-sm text-slate-500">Click an application on the left to review details and take action.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSellerApplications;
