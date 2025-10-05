import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { StockManagement } from "@/components/stock-management";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopItem } from "@shared/schema";

export default function BoutiquePage() {
  const { data: items, isLoading } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop-items"],
    queryFn: async () => {
      const res = await fetch("/api/shop-items");
      if (!res.ok) throw new Error("Failed to fetch shop items");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="outline" size="icon" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-4xl font-display text-chart-2">Boutique</h1>
            <p className="text-muted-foreground mt-1">Gestion des stocks de la boutique</p>
          </div>
        </div>

        {/* Stats */}
        {!isLoading && items && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-sm text-muted-foreground">Total articles</p>
              <p className="text-2xl font-bold text-foreground">{items.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-sm text-muted-foreground">En stock</p>
              <p className="text-2xl font-bold text-chart-1">
                {items.filter(item => item.stock > 0).length}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-sm text-muted-foreground">Rupture</p>
              <p className="text-2xl font-bold text-destructive">
                {items.filter(item => item.stock === 0).length}
              </p>
            </div>
          </div>
        )}

        {/* Stock Management */}
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-48" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <StockManagement items={items || []} type="shop" apiPath="/api/shop-items" />
        )}
      </div>
    </div>
  );
}
