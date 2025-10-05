import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Edit, Trash2, PackagePlus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface StockItem {
  id: number;
  name: string;
  stock: number;
  price?: string | null;
  category?: string | null;
}

interface StockManagementProps {
  items: StockItem[];
  type: "shop" | "meal";
  apiPath: string;
}

export function StockManagement({ items, type, apiPath }: StockManagementProps) {
  const { toast } = useToast();
  const [newItem, setNewItem] = useState({ name: "", stock: 0, price: "", category: "" });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, stock }: { id: number; stock: number }) => {
      return apiRequest("PATCH", `${apiPath}/${id}`, { stock });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === apiPath
      });
      toast({
        title: "Stock mis à jour",
        description: "Le stock a été modifié avec succès",
      });
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (data: typeof newItem) => {
      return apiRequest("POST", apiPath, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === apiPath
      });
      toast({
        title: "Article ajouté",
        description: "L'article a été ajouté avec succès",
      });
      setNewItem({ name: "", stock: 0, price: "", category: "" });
      setIsAddDialogOpen(false);
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `${apiPath}/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === apiPath
      });
      toast({
        title: "Article supprimé",
        description: "L'article a été supprimé avec succès",
      });
    },
  });

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Badge variant="destructive">Rupture</Badge>;
    if (stock < 10) return <Badge className="bg-chart-2 text-white">Stock faible</Badge>;
    return <Badge className="bg-chart-1 text-white">En stock</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Add Item Button */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2" data-testid="button-add-item">
            <PackagePlus className="w-4 h-4" />
            Ajouter un article
          </Button>
        </DialogTrigger>
        <DialogContent data-testid="dialog-add-item">
          <DialogHeader>
            <DialogTitle>Nouvel article</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'article</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                data-testid="input-item-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock initial</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={newItem.stock}
                  onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })}
                  data-testid="input-item-stock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Prix (optionnel)</Label>
                <Input
                  id="price"
                  value={newItem.price}
                  onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                  data-testid="input-item-price"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie (optionnel)</Label>
              <Input
                id="category"
                value={newItem.category}
                onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                data-testid="input-item-category"
              />
            </div>
            <Button
              onClick={() => addItemMutation.mutate(newItem)}
              disabled={!newItem.name || addItemMutation.isPending}
              className="w-full"
              data-testid="button-save-item"
            >
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Items List */}
      <div className="grid gap-4">
        {items.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Aucun article en stock</p>
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="p-6" data-testid={`card-item-${item.id}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-semibold">{item.name}</h3>
                    {getStockBadge(item.stock)}
                    {item.category && (
                      <Badge variant="outline">{item.category}</Badge>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span>
                      <strong className="text-foreground">Stock:</strong>{" "}
                      <span className="text-lg font-mono text-foreground">{item.stock}</span>
                    </span>
                    {item.price && (
                      <span>
                        <strong className="text-foreground">Prix:</strong> {item.price}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateStockMutation.mutate({ 
                      id: item.id, 
                      stock: Math.max(0, item.stock - 1) 
                    })}
                    disabled={item.stock === 0 || updateStockMutation.isPending}
                    data-testid={`button-decrease-${item.id}`}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => updateStockMutation.mutate({ 
                      id: item.id, 
                      stock: item.stock + 1 
                    })}
                    disabled={updateStockMutation.isPending}
                    data-testid={`button-increase-${item.id}`}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => deleteItemMutation.mutate(item.id)}
                    disabled={deleteItemMutation.isPending}
                    data-testid={`button-delete-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
