import { useQuery } from "@tanstack/react-query";
import { StockManagement } from "@/components/stock-management";
import { Skeleton } from "@/components/ui/skeleton";
import { MealItem } from "@shared/schema";
import { ManagementLayout } from "@/components/management-layout";

export default function RepasPage() {
  const { data: items, isLoading } = useQuery<MealItem[]>({
    queryKey: ["/api/meal-items"],
    queryFn: async () => {
      const res = await fetch("/api/meal-items");
      if (!res.ok) throw new Error("Failed to fetch meal items");
      return res.json();
    },
  });

  return (
    <ManagementLayout
      title="Repas"
      subtitle="Gestion des stocks de repas"
    >
      <div className="space-y-6">

        {/* Info Banner */}
        <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-foreground">
            <strong>Note:</strong> Chaque zombie a droit à 1 repas offert. Les survivants paient leurs repas.
          </p>
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
          <StockManagement items={items || []} type="meal" apiPath="/api/meal-items" />
        )}
      </div>
    </ManagementLayout>
  );
}
