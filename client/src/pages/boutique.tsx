import { useQuery } from "@tanstack/react-query";
import { StockManagement } from "@/components/stock-management";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopItem } from "@shared/schema";
import { ManagementLayout } from "@/components/management-layout";

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
    <ManagementLayout
      title="Boutique"
      subtitle="Gestion des stocks de la boutique"
    >
      <div className="space-y-6">

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
    </ManagementLayout>
  );
}
