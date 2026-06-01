import { useState, useMemo } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Store,
  Clock,
  ShieldAlert,
  CreditCard,
  Paperclip,
  FileText,
  CheckCircle2,
  PackageSearch,
  Eye,
  Sparkles,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Category = "Real Estate" | "Auto" | "Electronics" | "Luxury";
type Status = "pending" | "approved" | "rejected";

interface Listing {
  id: string;
  title: string;
  thumbnail_url: string | null;
  category: string;
  created_by: string;
  created_at: string;
  listing_fee_paid: boolean;
  images: string[];
  status: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  location: string | null;
}

const categoryStyle: Record<string, string> = {
  "real_estate": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  "automobile": "bg-slate-300/10 text-slate-300 border-slate-400/30",
  "electronic": "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const AdminMarketplace = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [selected, setSelected] = useState<Listing | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newListing, setNewListing] = useState({
    title: "",
    description: "",
    category: "",
    price: "",
    stock_quantity: "",
    location: "",
    images: [] as string[],
    thumbnail_url: ""
  });

  // Fetch marketplace products
  const { data: listings, isLoading: listingsLoading } = useQuery({
    queryKey: ["admin-marketplace-listings", tab],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (tab === "pending") {
        query = query.in('status', ['pending', 'pending_verification']);
      } else {
        query = query.eq('status', 'active');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const total = listings?.length || 0;
    const pending = listings?.filter((l) => ['pending', 'pending_verification'].includes(l.status)).length || 0;
    const flagged = listings?.filter((l) => l.status === 'rejected').length || 0;
    return { total, pending, flagged };
  }, [listings]);

  const visible = useMemo(
    () =>
      tab === "pending"
        ? listings?.filter((l) => ['pending', 'pending_verification'].includes(l.status)) || []
        : listings || [],
    [listings, tab]
  );

  const openReview = (listing: Listing) => {
    setSelected(listing);
    setDrawerOpen(true);
  };

  // Approve listing mutation
  const approveListing = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from('marketplace_products')
        .update({ status: 'active' })
        .eq('id', listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing approved and is now publicly visible");
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-listings"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to approve listing");
    },
  });

  // Reject listing mutation
  const rejectListing = useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from('marketplace_products')
        .update({ status: 'rejected' })
        .eq('id', listingId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-listings"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to reject listing");
    },
  });

  // Create listing mutation
  const createListing = useMutation({
    mutationFn: async (listingData: typeof newListing) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from('marketplace_products')
        .insert({
          title: listingData.title,
          description: listingData.description,
          category: listingData.category,
          price: parseFloat(listingData.price),
          stock_quantity: parseInt(listingData.stock_quantity),
          location: listingData.location,
          images: listingData.images,
          thumbnail_url: listingData.thumbnail_url || listingData.images[0] || null,
          status: 'active', // Admin posts go live immediately
          created_by: user.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Listing created successfully");
      setCreateDialogOpen(false);
      setNewListing({
        title: "",
        description: "",
        category: "",
        price: "",
        stock_quantity: "",
        location: "",
        images: [],
        thumbnail_url: ""
      });
      queryClient.invalidateQueries({ queryKey: ["admin-marketplace-listings"] });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create listing");
    },
  });

  // Handle image upload
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const imageUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = `${Date.now()}-${file.name}`;
      
      const { data, error } = await supabase.storage
        .from('marketplace-images')
        .upload(fileName, file);
        
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }
      
      const { data: { publicUrl } } = supabase.storage
        .from('marketplace-images')
        .getPublicUrl(fileName);
        
      imageUrls.push(publicUrl);
    }
    
    setNewListing(prev => ({
      ...prev,
      images: [...prev.images, ...imageUrls],
      thumbnail_url: prev.thumbnail_url || imageUrls[0] || ""
    }));
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Access Denied</h2>
          <p className="text-muted-foreground">You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span className="text-amber-500">//</span>
              <span>MARKETPLACE</span>
              <span className="text-slate-700">/</span>
              <span className="text-amber-400">MANAGEMENT</span>
            </div>
            <h1
              className="text-3xl font-semibold text-white tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Marketplace Management
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage listings and post new items to the marketplace.
            </p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold shadow-[0_8px_30px_-8px_rgba(212,168,71,0.6)]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Listing
          </Button>
        </div>

        {/* Stats Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            icon={<Store className="w-5 h-5" />}
            label="Total Listings"
            value={stats.total}
            tone="neutral"
            subtitle="All-time submissions"
          />
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Pending Audit"
            value={stats.pending}
            tone="gold"
            subtitle="Awaiting review"
          />
          <StatCard
            icon={<ShieldAlert className="w-5 h-5" />}
            label="Rejected / Flagged"
            value={stats.flagged}
            tone="danger"
            subtitle="Requires attention"
          />
        </div>

        {/* Tabs + Table */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 overflow-hidden">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "all")}>
            <div className="px-4 pt-4 border-b border-slate-800/80">
              <TabsList className="bg-slate-900/60 border border-slate-800 p-1">
                <TabsTrigger
                  value="pending"
                  className="relative data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-300 text-slate-400 px-4"
                >
                  Pending Approval
                  {stats.pending > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-black text-[10px] font-bold">
                      {stats.pending}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="all"
                  className="data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400 px-4"
                >
                  All Listings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="pending" className="m-0">
              <ListingsTable listings={visible} onReview={openReview} />
            </TabsContent>
            <TabsContent value="all" className="m-0">
              <ListingsTable listings={visible} onReview={openReview} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Review Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl bg-slate-950 border-l border-amber-500/20 text-white overflow-y-auto"
        >
          {selected && (
            <div className="space-y-6">
              <SheetHeader>
                <div className="flex items-center gap-2 text-[10px] text-amber-400 tracking-widest">
                  <span>REVIEW</span>
                  <span className="text-slate-700">/</span>
                  <span className="text-slate-500">{selected.id}</span>
                </div>
                <SheetTitle
                  className="text-2xl text-white"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {selected.title}
                </SheetTitle>
                <SheetDescription className="text-slate-400">
                  Created by{" "}
                  <span className="text-slate-200">{selected.created_by}</span> on{" "}
                  {new Date(selected.created_at).toLocaleDateString()}
                </SheetDescription>
              </SheetHeader>

              {/* Asset Preview */}
              <div className="rounded-lg overflow-hidden border border-slate-800">
                <img
                  src={selected.thumbnail_url || '/placeholder-image.png'}
                  alt={selected.title}
                  className="w-full h-56 object-cover"
                />
              </div>

              {/* Product Details */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Product Details
                </h3>
                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Price:</span>
                    <span className="text-sm text-white">${selected.price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Stock:</span>
                    <span className="text-sm text-white">{selected.stock_quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Category:</span>
                    <span className="text-sm text-white">{selected.category?.replace('_', ' ') || 'General'}</span>
                  </div>
                  {selected.location && (
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-400">Location:</span>
                      <span className="text-sm text-white">{selected.location}</span>
                    </div>
                  )}
                  {selected.description && (
                    <div className="mt-3">
                      <span className="text-sm text-slate-400">Description:</span>
                      <p className="text-sm text-white mt-1">{selected.description}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Images */}
              {selected.images && selected.images.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                    Product Images
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.images.map((image, index) => (
                      <div
                        key={index}
                        className="rounded-lg overflow-hidden border border-slate-800 bg-slate-900/40"
                      >
                        <img
                          src={image}
                          alt={`Product image ${index + 1}`}
                          className="w-full h-24 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Status */}
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
                  Listing Status
                </h3>
                <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Status:</span>
                    <span className={`text-sm font-medium ${
                      selected.status === 'active' ? 'text-green-400' :
                      selected.status === 'pending' || selected.status === 'pending_verification' ? 'text-yellow-400' :
                      selected.status === 'rejected' ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                      {selected.status?.replace('_', ' ') || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-400">Listing Fee:</span>
                    <span className={`text-sm font-medium ${
                      selected.listing_fee_paid ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {selected.listing_fee_paid ? 'Paid' : 'Not Paid'}
                    </span>
                  </div>
                </div>
              </section>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  className="flex-1 h-12 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold shadow-[0_8px_30px_-8px_rgba(212,168,71,0.6)]"
                  onClick={() => approveListing.mutate(selected.id)}
                  disabled={approveListing.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve Listing
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12 border-amber-500/40 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
                  onClick={() => toast.success("Listing featured successfully!")}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Feature Listing
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 h-12 border-red-500/40 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                  onClick={() => rejectListing.mutate(selected.id)}
                  disabled={rejectListing.isPending}
                >
                  Reject / Remove
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Listing Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-slate-950 border-slate-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">Create New Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="images" className="text-slate-300">Images</Label>
              <Input
                id="images"
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="bg-slate-900 border-slate-700 text-white"
              />
              {newListing.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {newListing.images.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Upload ${index + 1}`}
                      className="w-16 h-16 object-cover rounded border border-slate-700"
                    />
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="title" className="text-slate-300">Title</Label>
              <Input
                id="title"
                value={newListing.title}
                onChange={(e) => setNewListing({...newListing, title: e.target.value})}
                className="bg-slate-900 border-slate-700 text-white"
                placeholder="Enter listing title"
              />
            </div>
            <div>
              <Label htmlFor="description" className="text-slate-300">Description</Label>
              <Textarea
                id="description"
                value={newListing.description}
                onChange={(e) => setNewListing({...newListing, description: e.target.value})}
                className="bg-slate-900 border-slate-700 text-white"
                placeholder="Enter listing description"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="category" className="text-slate-300">Category</Label>
              <Select value={newListing.category} onValueChange={(value) => setNewListing({...newListing, category: value})}>
                <SelectTrigger className="bg-slate-900 border-slate-700 text-white">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  <SelectItem value="real_estate">Real Estate</SelectItem>
                  <SelectItem value="automobile">Automobile</SelectItem>
                  <SelectItem value="electronic">Electronic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price" className="text-slate-300">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  value={newListing.price}
                  onChange={(e) => setNewListing({...newListing, price: e.target.value})}
                  className="bg-slate-900 border-slate-700 text-white"
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="stock" className="text-slate-300">Stock Quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  value={newListing.stock_quantity}
                  onChange={(e) => setNewListing({...newListing, stock_quantity: e.target.value})}
                  className="bg-slate-900 border-slate-700 text-white"
                  placeholder="1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="location" className="text-slate-300">Location</Label>
              <Input
                id="location"
                value={newListing.location}
                onChange={(e) => setNewListing({...newListing, location: e.target.value})}
                className="bg-slate-900 border-slate-700 text-white"
                placeholder="Enter location"
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => createListing.mutate(newListing)}
              disabled={createListing.isLoading}
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black font-semibold"
            >
              {createListing.isLoading ? "Creating..." : "Create Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

/* ---------- subcomponents ---------- */

const StatCard = ({
  icon,
  label,
  value,
  subtitle,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  subtitle: string;
  tone: "neutral" | "gold" | "danger";
}) => {
  const styles = {
    neutral:
      "border-slate-800 bg-slate-950/60 hover:border-slate-700",
    gold:
      "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent shadow-[0_0_40px_-12px_rgba(212,168,71,0.4)]",
    danger:
      "border-red-500/30 bg-red-500/5",
  }[tone];

  const iconStyles = {
    neutral: "bg-slate-800/60 text-slate-300",
    gold: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    danger: "bg-red-500/10 text-red-400 border border-red-500/30",
  }[tone];

  return (
    <div className={cn("rounded-xl border p-5 transition-all", styles)}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconStyles)}>
          {icon}
        </div>
        {tone === "gold" && (
          <span className="text-[10px] font-bold text-amber-400 tracking-widest">
            PRIORITY
          </span>
        )}
      </div>
      <div className="text-3xl font-semibold text-white mb-1 tabular-nums">
        {value.toLocaleString()}
      </div>
      <div className="text-sm text-slate-300">{label}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
};

const ListingsTable = ({
  listings,
  onReview,
}: {
  listings: Listing[];
  onReview: (l: Listing) => void;
}) => {
  if (!listings || listings.length === 0) {
    return <EmptyState />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-slate-800 hover:bg-transparent">
          <TableHead className="text-slate-500 text-xs uppercase tracking-wider">
            Asset
          </TableHead>
          <TableHead className="text-slate-500 text-xs uppercase tracking-wider">
            Category
          </TableHead>
          <TableHead className="text-slate-500 text-xs uppercase tracking-wider">
            Seller
          </TableHead>
          <TableHead className="text-slate-500 text-xs uppercase tracking-wider">
            Price
          </TableHead>
          <TableHead className="text-slate-500 text-xs uppercase tracking-wider">
            Verification
          </TableHead>
          <TableHead className="text-slate-500 text-xs uppercase tracking-wider">
            Status
          </TableHead>
          <TableHead className="text-slate-500 text-xs uppercase tracking-wider text-right">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {listings.map((l) => (
          <TableRow
            key={l.id}
            className="border-slate-800/70 hover:bg-amber-500/[0.03]"
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md overflow-hidden border border-slate-800 bg-slate-900 flex-shrink-0">
                  <img
                    src={l.thumbnail_url || '/placeholder-image.png'}
                    alt={l.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="text-sm text-white truncate max-w-[260px]">
                    {l.title}
                  </div>
                  <div className="text-[11px] text-slate-500">{l.id}</div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                  categoryStyle[l.category] || "bg-gray-500/10 text-gray-400 border-gray-500/30"
                )}
              >
                {l.category?.replace('_', ' ') || 'General'}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="text-sm text-slate-200">{l.created_by}</div>
              <div className="text-[11px] text-slate-500">{new Date(l.created_at).toLocaleDateString()}</div>
            </TableCell>
            <TableCell>
              <div className="text-sm font-medium text-white">${l.price}</div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <VerifyIcon
                  ok={l.listing_fee_paid}
                  icon={<CreditCard className="w-3.5 h-3.5" />}
                  label="Fee Paid"
                />
                <VerifyIcon
                  ok={l.images && l.images.length > 0}
                  icon={<Paperclip className="w-3.5 h-3.5" />}
                  label="Images"
                />
              </div>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
                l.status === 'active' ? "bg-green-500/10 text-green-400 border-green-500/30" :
                l.status === 'rejected' ? "bg-red-500/10 text-red-400 border-red-500/30" :
                "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
              )}>
                {l.status.replace('_', ' ')}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Button
                size="sm"
                onClick={() => onReview(l)}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/50"
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Review
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

const VerifyIcon = ({
  ok,
  icon,
  label,
}: {
  ok: boolean;
  icon: React.ReactNode;
  label: string;
}) => (
  <div
    title={`${label}: ${ok ? "Yes" : "Missing"}`}
    className={cn(
      "w-7 h-7 rounded-md flex items-center justify-center border",
      ok
        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
        : "bg-slate-800/60 text-slate-600 border-slate-800"
    )}
  >
    {icon}
  </div>
);

const ChecklistRow = ({
  checked,
  label,
}: {
  checked: boolean;
  label: string;
}) => (
  <div className="flex items-center gap-3">
    <Checkbox checked={checked} disabled />
    <span
      className={cn(
        "text-sm",
        checked ? "text-slate-200" : "text-slate-500"
      )}
    >
      {label}
    </span>
  </div>
);

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    <div className="relative mb-6">
      <div className="absolute inset-0 bg-amber-500/20 blur-2xl rounded-full" />
      <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/30 flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(212,168,71,0.4)]">
        <PackageSearch className="w-10 h-10 text-amber-400" />
      </div>
    </div>
    <h3
      className="text-xl text-white mb-2"
      style={{ fontFamily: "'Playfair Display', serif" }}
    >
      All caught up!
    </h3>
    <p className="text-sm text-slate-500 max-w-sm">
      No pending listings require your attention. New submissions will appear
      here for review.
    </p>
  </div>
);

export default AdminMarketplace;
