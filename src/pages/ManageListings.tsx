import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle, Package, ArrowLeft, Clock, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ManageListings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["my-listings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("marketplace_products")
        .select("*")
        .eq("created_by", user?.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-xl font-semibold">Manage Listings</h1>
              <p className="text-sm text-muted-foreground">
                View and manage your marketplace inventory.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold">Your Inventory</h2>
          <Link to="/seller/listings/create">
            <Button className="gap-2">
              <PlusCircle className="w-4 h-4" /> Create New Listing
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid gap-4">
            {listings.map((listing) => (
              <Card key={listing.id} className="overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  <div className="w-full sm:w-48 h-32 bg-secondary/50 flex-shrink-0 relative">
                    {listing.thumbnail_url ? (
                      <img src={listing.thumbnail_url} alt={listing.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <CardContent className="flex-1 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase text-primary tracking-wider">
                            {listing.category.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="font-bold text-lg mb-1">{listing.title}</h3>
                        <p className="font-semibold text-muted-foreground">${listing.price}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {listing.status === 'pending_verification' && !listing.listing_fee_paid ? (
                          <Badge variant="destructive" className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> Awaiting Fee Payment
                          </Badge>
                        ) : listing.status === 'pending_verification' ? (
                          <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                            <Clock className="w-3 h-3" /> Awaiting Admin Approval
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="capitalize">
                            {listing.status.replace('_', ' ')}
                          </Badge>
                        )}
                        
                        {!listing.listing_fee_paid && (listing.category === 'real_estate' || listing.category === 'automobile') && (
                          <Link to={`/seller/listing-fee/${listing.id}`}>
                            <Button size="sm" variant="outline" className="mt-2 text-xs">
                              Pay Listing Fee
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 mt-8 border border-border/50 rounded-xl bg-card/30 backdrop-blur-sm text-center">
            <div className="w-24 h-24 mb-6 rounded-2xl bg-secondary/50 flex items-center justify-center shadow-inner relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Package className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">You haven't listed any assets yet</h2>
            <p className="text-muted-foreground max-w-sm mb-6">
              Start by adding your first property, vehicle, or item to the marketplace to reach thousands of buyers.
            </p>
            <Link to="/seller/listings/create">
              <Button size="lg" className="gap-2">
                <PlusCircle className="w-5 h-5" /> Add a Product
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default ManageListings;
