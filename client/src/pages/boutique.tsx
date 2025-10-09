import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ManagementLayout } from "@/components/management-layout";
import {
  ShoppingCart, Scan, X, Check, User,
  Beer, Coffee, Sandwich, Shirt, Backpack, Gift,
  Package, Utensils, ShoppingBag
} from "lucide-react";
import type { ShopItem, Participant } from "@shared/schema";
import { QrScanner } from "@/components/qr-scanner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// Icon mapping
const ICON_MAP: Record<string, any> = {
  Beer,
  Coffee,
  Sandwich,
  Shirt,
  Backpack,
  Gift,
  Package,
  Utensils,
  ShoppingBag,
};

interface CartItem extends ShopItem {
  quantity: number;
}

export default function BoutiquePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedParticipant, setScannedParticipant] = useState<Participant | null>(null);
  const [discount, setDiscount] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Fetch shop items
  const { data: shopItems = [], isLoading } = useQuery<ShopItem[]>({
    queryKey: ["/api/shop-items"],
    queryFn: async () => {
      const res = await fetch("/api/shop-items");
      if (!res.ok) throw new Error("Failed to fetch shop items");
      return res.json();
    },
  });

  // Scan participant and get discount
  const handleScan = async (qrData: string) => {
    try {
      // Scan QR code
      const scanRes = await fetch("/api/qr/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrData }),
      });

      if (!scanRes.ok) {
        throw new Error("Invalid QR code");
      }

      const { participant } = await scanRes.json();
      setScannedParticipant(participant);

      // Get discount for participant
      const discountRes = await fetch(`/api/discounts/calculate/${participant.id}`);
      if (discountRes.ok) {
        const { discount: calculatedDiscount } = await discountRes.json();
        setDiscount(calculatedDiscount);

        toast({
          title: "Participant scanné",
          description: `${participant.firstName} ${participant.lastName}${calculatedDiscount > 0 ? ` - Réduction: ${calculatedDiscount}%` : ''}`,
        });
      }

      setScannerOpen(false);
    } catch (error) {
      toast({
        title: "Erreur de scan",
        description: error instanceof Error ? error.message : "QR code invalide",
        variant: "destructive",
      });
    }
  };

  // Add to cart
  const addToCart = (item: ShopItem) => {
    if (item.stock <= 0) {
      toast({
        title: "Stock épuisé",
        description: "Cet article n'est plus disponible",
        variant: "destructive",
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        if (existing.quantity >= item.stock) {
          toast({
            title: "Stock insuffisant",
            description: `Stock disponible: ${item.stock}`,
            variant: "destructive",
          });
          return prev;
        }
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  // Remove from cart
  const removeFromCart = (itemId: number) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((i) =>
          i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
        );
      }
      return prev.filter((i) => i.id !== itemId);
    });
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setScannedParticipant(null);
    setDiscount(0);
  };

  // Calculate totals
  const calculateTotals = () => {
    let originalTotal = 0;
    let subtotal = 0;
    cart.forEach((item) => {
      const itemPrice = parseFloat(item.price);
      originalTotal += itemPrice * item.quantity;
      const discountedPrice = itemPrice * (1 - discount / 100);
      subtotal += discountedPrice * item.quantity;
    });
    const discountAmount = originalTotal - subtotal;
    return { originalTotal, subtotal, discountAmount };
  };

  const { originalTotal, subtotal, discountAmount } = calculateTotals();

  // Create purchases mutation
  const createPurchasesMutation = useMutation({
    mutationFn: async () => {
      if (!scannedParticipant) throw new Error("No participant scanned");

      const purchases = cart.map((item) => {
        const originalPrice = parseFloat(item.price);
        const discountedPrice = originalPrice * (1 - discount / 100);
        const totalPrice = discountedPrice * item.quantity;

        return {
          participantId: scannedParticipant.id,
          shopItemId: item.id,
          quantity: item.quantity,
          unitPrice: discountedPrice.toFixed(2),
          originalPrice: originalPrice.toFixed(2),
          discountApplied: discount,
          totalPrice: totalPrice.toFixed(2),
          isPaid: false, // Always false, payment is external
        };
      });

      // Create all purchases and update stock
      const promises = purchases.map(async (purchase) => {
        // Create purchase
        const purchaseRes = await fetch("/api/purchases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(purchase),
        });

        if (!purchaseRes.ok) throw new Error("Failed to create purchase");

        // Update stock (decrement)
        const item = cart.find(i => i.id === purchase.shopItemId);
        if (item) {
          const stockRes = await fetch(`/api/shop-items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stock: item.stock - purchase.quantity }),
          });

          if (!stockRes.ok) throw new Error("Failed to update stock");
        }
      });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/purchases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shop-items"] });
      toast({
        title: "Achat enregistré",
        description: "L'achat a été enregistré avec succès",
      });
      setCheckoutOpen(false);
      clearCart();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer l'achat",
        variant: "destructive",
      });
    },
  });

  const handleValidateOrder = () => {
    if (!scannedParticipant) {
      toast({
        title: "Scannez un participant",
        description: "Vous devez scanner le badge d'un participant avant de valider",
        variant: "destructive",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des articles au panier avant de valider",
        variant: "destructive",
      });
      return;
    }

    setCheckoutOpen(true);
  };

  return (
    <ManagementLayout
      title="Boutique"
      subtitle="Point de vente"
      showHomeButton
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Products */}
        <div className="lg:col-span-2 space-y-6">
          {/* Participant Scanner */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Participant
                  </CardTitle>
                  {scannedParticipant && (
                    <CardDescription>
                      {scannedParticipant.firstName} {scannedParticipant.lastName}
                      {" - "}
                      <span className="capitalize">{scannedParticipant.type}</span>
                    </CardDescription>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setScannerOpen(true)}
                    variant={scannedParticipant ? "outline" : "default"}
                  >
                    <Scan className="w-4 h-4 mr-2" />
                    {scannedParticipant ? "Changer" : "Scanner"}
                  </Button>
                  {scannedParticipant && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={clearCart}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            {scannedParticipant && discount > 0 && (
              <CardContent>
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-600 dark:text-green-400 font-semibold text-center">
                    Réduction de {discount}% appliquée !
                  </p>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Products Grid */}
          {isLoading ? (
            <div className="text-center py-12">Chargement des produits...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {shopItems.map((item) => (
                <ProductCard
                  key={item.id}
                  item={item}
                  onAdd={addToCart}
                  discount={discount}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right column: Cart */}
        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Panier ({cart.reduce((sum, item) => sum + item.quantity, 0)})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Panier vide
                </p>
              ) : (
                <>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {cart.map((item) => (
                      <CartItemRow
                        key={item.id}
                        item={item}
                        onRemove={removeFromCart}
                        discount={discount}
                      />
                    ))}
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Total initial</span>
                        <span>{originalTotal.toFixed(2)}€</span>
                      </div>
                    )}
                    {discount > 0 && (
                      <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                        <span>Réduction ({discount}%)</span>
                        <span>-{discountAmount.toFixed(2)}€</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-lg border-t pt-2">
                      <span>Total</span>
                      <span>{subtotal.toFixed(2)}€</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleValidateOrder}
                      disabled={!scannedParticipant}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Valider l'achat
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={clearCart}
                    >
                      Vider le panier
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <QrScanner
          onScan={handleScan}
          onClose={() => setScannerOpen(false)}
          title="Scanner le badge du participant"
        />
      )}

      {/* Checkout Confirmation Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmer l'achat</DialogTitle>
            <DialogDescription>
              Récapitulatif de l'achat pour {scannedParticipant?.firstName} {scannedParticipant?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {cart.map((item) => {
              const originalPrice = parseFloat(item.price);
              const discountedPrice = originalPrice * (1 - discount / 100);
              const lineTotal = discountedPrice * item.quantity;

              return (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">
                      {discountedPrice.toFixed(2)}€ x {item.quantity}
                    </p>
                  </div>
                  <p className="font-semibold">{lineTotal.toFixed(2)}€</p>
                </div>
              );
            })}

            <div className="border-t pt-4 space-y-2">
              {discount > 0 && (
                <>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Total initial</span>
                    <span>{originalTotal.toFixed(2)}€</span>
                  </div>
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Réduction ({discount}%)</span>
                    <span>-{discountAmount.toFixed(2)}€</span>
                  </div>
                </>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total à régler</span>
                <span>{subtotal.toFixed(2)}€</span>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              Le paiement sera effectué séparément. Cette action enregistre uniquement l'achat.
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setCheckoutOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => createPurchasesMutation.mutate()}
              disabled={createPurchasesMutation.isPending}
            >
              {createPurchasesMutation.isPending ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ManagementLayout>
  );
}

function ProductCard({
  item,
  onAdd,
  discount,
}: {
  item: ShopItem;
  onAdd: (item: ShopItem) => void;
  discount: number;
}) {
  const IconComponent = item.icon ? ICON_MAP[item.icon] || Package : Package;
  const originalPrice = parseFloat(item.price);
  const discountedPrice = originalPrice * (1 - discount / 100);

  return (
    <Card
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onAdd(item)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <IconComponent className="w-8 h-8 text-primary" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-semibold">{item.name}</p>
        </div>
        <div className="text-center">
          {discount > 0 ? (
            <div className="space-y-1">
              <p className="text-sm line-through text-muted-foreground">
                {originalPrice.toFixed(2)}€
              </p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                {discountedPrice.toFixed(2)}€
              </p>
            </div>
          ) : (
            <p className="text-lg font-bold">{originalPrice.toFixed(2)}€</p>
          )}
        </div>
        <Badge
          variant={item.stock > 0 ? "default" : "destructive"}
          className="w-full justify-center"
        >
          Stock: {item.stock}
        </Badge>
      </CardContent>
    </Card>
  );
}

function CartItemRow({
  item,
  onRemove,
  discount,
}: {
  item: CartItem;
  onRemove: (id: number) => void;
  discount: number;
}) {
  const originalPrice = parseFloat(item.price);
  const discountedPrice = originalPrice * (1 - discount / 100);
  const lineTotal = discountedPrice * item.quantity;

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.name}</p>
        <p className="text-sm text-muted-foreground">
          {discountedPrice.toFixed(2)}€ x {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="font-semibold">{lineTotal.toFixed(2)}€</p>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onRemove(item.id)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
