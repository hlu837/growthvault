import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface MarketplaceProduct {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number;
  currency: string;
  images: string[];
  thumbnail_url: string | null;
  status: string;
  stock_quantity: number;
  location: string | null;
  featured: boolean;
  created_at: string;
}

const AdminMarketplace = () => {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTab, setSelectedTab] = useState<"all" | "pending">("all");

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-marketplace-products", searchTerm, selectedCategory, selectedTab],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedCategory !== "all") {
        query = query.eq('category', selectedCategory);
      }

      if (selectedTab === "pending") {
        query = query.in('status', ['pending', 'pending_verification']);
      }

      if (searchTerm) {
        query = query.or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-foreground">
            Marketplace Management
          </h1>
          <p className="text-muted-foreground">Manage products and orders</p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="real_estate">Real Estate</SelectItem>
              <SelectItem value="automobile">Automobile</SelectItem>
              <SelectItem value="electronic">Electronic</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2">
          <Button
            variant={selectedTab === "all" ? "default" : "outline"}
            onClick={() => setSelectedTab("all")}
          >
            All Listings
          </Button>
          <Button
            variant={selectedTab === "pending" ? "default" : "outline"}
            onClick={() => setSelectedTab("pending")}
          >
            Pending Approval
          </Button>
        </div>

        {/* Products Grid */}
        {productsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-40 bg-muted rounded-md" />
              </div>
            ))}
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="group hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{product.title}</CardTitle>
                      <div className="flex gap-2 mb-2">
                        <Badge variant="outline">
                          {product.category.replace('_', ' ')}
                        </Badge>
                        <Badge variant={product.status === 'active' ? 'default' : 'secondary'}>
                          {product.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {product.description?.substring(0, 100)}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      Stock: {product.stock_quantity} | ${product.price}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(product.created_at), 'MMM dd, yyyy')}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMarketplace;
