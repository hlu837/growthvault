import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
  ShoppingCart,
  Star,
  MapPin,
  Filter,
  Home,
  Car,
  Smartphone,
  ArrowRight,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useMarketplaceProducts,
  useFeaturedProducts,
  useCart,
  useMarketplaceSettings,
  sanitizeMarketplaceText,
  categoryLabels,
  MarketplaceCategory,
  MarketplaceProduct,
} from "@/hooks/useMarketplace";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const categoryConfig: {
  key: MarketplaceCategory;
  label: string;
  icon: React.ComponentType<any>;
  gradient: string;
  description: string;
}[] = [
  {
    key: "real_estate",
    label: "Real Estate",
    icon: Home,
    gradient: "from-emerald-600/20 to-emerald-900/20",
    description: "Properties, lands & housing",
  },
  {
    key: "automobile",
    label: "Automobile",
    icon: Car,
    gradient: "from-blue-600/20 to-blue-900/20",
    description: "Vehicles, parts & accessories",
  },
  {
    key: "electronic",
    label: "Electronic",
    icon: Smartphone,
    gradient: "from-purple-600/20 to-purple-900/20",
    description: "Gadgets, devices & tech",
  },
];

const ProductCard = ({ product, onCommit }: { product: MarketplaceProduct; onCommit: () => void }) => {
  const { formatAmount } = useCurrency();

  return (
    <div className="group rounded-xl border border-border bg-card overflow-hidden hover:border-accent/30 transition-all duration-300 hover:shadow-lg hover:shadow-accent/5">
      <Link to={`/marketplace/${product.id}`}>
        <div className="aspect-[4/3] bg-secondary/50 overflow-hidden relative">
          {product.thumbnail_url ? (
            <img
              src={product.thumbnail_url}
              alt={product.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {product.category === "real_estate" ? "🏠" : product.category === "automobile" ? "🚗" : "📱"}
            </div>
          )}
          {product.featured && (
            <Badge className="absolute top-3 left-3 bg-accent text-accent-foreground font-mono text-[10px]">
              <Star className="w-3 h-3 mr-1" /> FEATURED
            </Badge>
          )}
          <Badge
            variant="outline"
            className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm text-xs font-mono border-border"
          >
            {categoryLabels[product.category]}
          </Badge>
        </div>
      </Link>

      <div className="p-4 space-y-3">
        <Link to={`/marketplace/${product.id}`}>
          <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-1">
            {product.title}
          </h3>
        </Link>
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {sanitizeMarketplaceText(product.description)}
          </p>
        )}
        {product.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {product.location}
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-lg font-bold font-mono text-accent">
            {formatAmount(product.price)}
          </span>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={onCommit}>
            <ShoppingCart className="w-3 h-3" />
            {product.category === 'electronic' ? 'Buy Now' : 'Commit to Purchase'}
          </Button>
        </div>
      </div>
    </div>
  );
};

const Marketplace = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const settingsQuery = useMarketplaceSettings();
  const { data: settings } = settingsQuery;
  const { data: products, isLoading } = useMarketplaceProducts(
    selectedCategory,
    settings?.riskBlockThreshold ?? 61
  );
  const { data: featuredProducts } = useFeaturedProducts();
  const { data: cartItems } = useCart();
  const { user, isSeller } = useAuth();
  const { formatAmount } = useCurrency();

  const {
    data: sellerApplication,
    isLoading: isSellerApplicationLoading,
  } = useQuery({
    queryKey: ["seller-application-status", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_applications")
        .select("status")
        .eq("user_id", user?.id)
        .in("status", ["pending", "under_review"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error fetching seller application status:", error);
        return null;
      }
      return data as { status: string } | null;
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  });

  const hasPendingSellerApplication = !!sellerApplication?.status;

  const filteredProducts = products?.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleCommit = (productId: string) => {
    navigate(`/marketplace/${productId}`);
  };

  const cartCount = cartItems?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to="/admin">
                <Button variant="ghost" size="sm" className="gap-1">
                  <ArrowLeft className="w-4 h-4" /> Back to Dashboard
                </Button>
              </Link>
              <img src="/logo.png" alt="Golden Wealth Achievers logo" className="w-10 h-10 rounded-md shadow-md" />
              <span className="text-xl font-bold text-accent font-mono">Marketplace</span>
            </div>

            <div className="flex-1 max-w-md mx-8 hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link to="/marketplace/cart">
                <Button variant="outline" size="sm" className="relative gap-2">
                  <ShoppingCart className="w-4 h-4" />
                  Cart
                  {cartCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-bold">
                      {cartCount}
                    </span>
                  )}
                </Button>
              </Link>
              {user ? (
                <Link to="/dashboard">
                  <Button size="sm" variant="ghost">Dashboard</Button>
                </Link>
              ) : (
                <Link to="/auth">
                  <Button size="sm">Sign In</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search */}
      <div className="md:hidden p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-secondary/50"
          />
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Hero / Category Cards */}
        {!selectedCategory && !searchQuery && (
          <section className="space-y-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Explore the <span className="text-accent">Marketplace</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                Browse curated listings across three categories
              </p>
              <div className="mt-6">
                {user ? (
                  hasPendingSellerApplication ? (
                    <Button size="sm" className="rounded-full" disabled>
                      Seller Application Pending
                    </Button>
                  ) : (
                    <Link to={isSeller ? "/seller/dashboard" : "/seller/application"}>
                      <Button size="sm" className="rounded-full">
                        {isSeller ? "Go to Seller Dashboard" : "Apply to Become a Seller"}
                      </Button>
                    </Link>
                  )
                ) : (
                  <Link to="/auth">
                    <Button size="sm" className="rounded-full">
                      Sign in to apply as a seller
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              {categoryConfig.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={cn(
                      "relative p-6 rounded-xl border border-border text-left transition-all duration-300",
                      "hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5",
                      "bg-gradient-to-br",
                      cat.gradient
                    )}
                  >
                    <div className="w-12 h-12 rounded-xl bg-background/50 flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-accent" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">{cat.label}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{cat.description}</p>
                    <ChevronRight className="absolute top-6 right-6 w-5 h-5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Category Filter Tabs */}
        <section>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={!selectedCategory ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(undefined)}
              className="font-mono text-xs"
            >
              All
            </Button>
            {categoryConfig.map((cat) => (
              <Button
                key={cat.key}
                variant={selectedCategory === cat.key ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat.key)}
                className="font-mono text-xs gap-1"
              >
                <cat.icon className="w-3 h-3" />
                {cat.label}
              </Button>
            ))}
          </div>
        </section>

        {/* Featured Products */}
        {!selectedCategory && !searchQuery && featuredProducts && featuredProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                <Star className="w-5 h-5 inline mr-2 text-accent" />
                Featured Listings
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredProducts.slice(0, 3).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onCommit={() => handleCommit(product.id)}
                />
              ))}
            </div>
          </section>
        )}

        {/* All Products Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {selectedCategory ? categoryLabels[selectedCategory] : "All Products"}
              <span className="text-sm text-muted-foreground font-normal ml-2">
                ({filteredProducts.length} items)
              </span>
            </h2>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="aspect-[4/3] bg-secondary/50 animate-pulse" />
                  <div className="p-4 space-y-3">
                    <div className="h-5 w-3/4 bg-secondary animate-pulse rounded" />
                    <div className="h-4 w-1/2 bg-secondary animate-pulse rounded" />
                    <div className="h-6 w-1/3 bg-secondary animate-pulse rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onCommit={() => handleCommit(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
              <ShoppingCart className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground">No products found</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {searchQuery ? "Try a different search term" : "Check back soon for new listings"}
              </p>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="space-y-1">
            <span>© {new Date().getFullYear()} Golden Wealth Achievers. All rights reserved.</span>
            <span>Powered by Bisolkay Int'l Company, duly registered in Nigeria.</span>
          </div>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/support" className="hover:text-foreground transition-colors">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Marketplace;
