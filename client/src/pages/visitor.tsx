import { RequireVisitor, useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ParticipantWithRelations, PurchaseWithRelations, MealPurchaseWithRelations } from "@shared/schema";
import { User, Clock, Users, MapPin, CheckCircle2, XCircle, LogOut, IdCard, ShoppingBag, Utensils, Download } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ParticipantBadge } from "@/components/participant-badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function VisitorPage() {
  const { visitor, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      // Le setLocation est déjà géré dans la fonction logout
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de se déconnecter",
        variant: "destructive",
      });
    }
  };

  const { data: participant, isLoading } = useQuery<ParticipantWithRelations>({
    queryKey: ["/api/participants", visitor?.participantId],
    queryFn: async () => {
      const res = await fetch(`/api/participants/${visitor?.participantId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!visitor?.participantId,
  });

  // Fetch purchases for this participant
  const { data: purchases = [] } = useQuery<PurchaseWithRelations[]>({
    queryKey: ["/api/purchases", visitor?.participantId],
    queryFn: async () => {
      const res = await fetch(`/api/purchases?participantId=${visitor?.participantId}`);
      if (!res.ok) throw new Error("Failed to fetch purchases");
      return res.json();
    },
    enabled: !!visitor?.participantId,
  });

  // Fetch meal purchases for this participant
  const { data: mealPurchases = [] } = useQuery<MealPurchaseWithRelations[]>({
    queryKey: ["/api/meal-purchases", visitor?.participantId],
    queryFn: async () => {
      const res = await fetch(`/api/meal-purchases?participantId=${visitor?.participantId}`);
      if (!res.ok) throw new Error("Failed to fetch meal purchases");
      return res.json();
    },
    enabled: !!visitor?.participantId,
  });

  if (!visitor) return null;

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/participants/${visitor.participantId}/pdf`, {
        credentials: 'include' // Important pour envoyer les cookies de session
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors du téléchargement du PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Recap_${visitor.firstName}_${visitor.lastName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF téléchargé",
        description: "Votre récapitulatif a été téléchargé avec succès",
      });
    } catch (error) {
      console.error('PDF download error:', error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le PDF",
        variant: "destructive",
      });
    }
  };

  return (
    <RequireVisitor>
      <div className="min-h-screen">
        {/* Background pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 text-center pt-12 pb-6">
          <h1 className="text-4xl font-bold text-white mb-2">
            Bienvenue {visitor.firstName} {visitor.lastName}
          </h1>
          <p className="text-slate-300 text-lg">Votre espace participant</p>
          
          {/* Buttons in header */}
          <div className="flex justify-center items-center gap-4 mt-6">
            <Button variant="outline" onClick={handleDownloadPDF} className="gap-2">
              <Download className="w-4 h-4" />
              Télécharger mon récapitulatif PDF
            </Button>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </Button>
          </div>
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 space-y-8">
          {isLoading ? (
            <div className="animate-pulse space-y-6">
              <div className="h-96 bg-muted rounded-lg" />
              <div className="h-48 bg-muted rounded-lg" />
            </div>
          ) : participant ? (
            <>
              {/* Badge Card - Most Important - Centered and Prominent */}
              <div className="flex justify-center">
                <Card className="shadow-2xl border-2 border-primary/20 max-w-lg w-full">
                  <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <IdCard className="w-6 h-6 text-primary" />
                      Votre Badge
                    </CardTitle>
                    <CardDescription>
                      Présentez ce badge lors de votre arrivée à l'événement
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-8 pb-6">
                    <div className="flex justify-center">
                      <ParticipantBadge participant={participant} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Info Grid - Better organized */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Time Slot */}
                {participant.timeSlot && (
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Clock className="w-5 h-5 text-blue-500" />
                      Votre créneau horaire
                    </CardTitle>
                    <CardDescription>Horaires de votre session</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-primary/5 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Créneau :</span>
                          <Badge variant="outline" className="text-base font-bold">
                            {participant.timeSlot.name}
                          </Badge>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground font-medium">🍽️ Repas :</span>
                          <span className="font-semibold">{participant.timeSlot.mealTime}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground font-medium">📋 Briefing :</span>
                          <span className="font-semibold">{participant.timeSlot.briefingTime}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b">
                          <span className="text-sm text-muted-foreground font-medium">🎮 Jeu :</span>
                          <span className="font-semibold">{participant.timeSlot.gameTime}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                          <span className="text-sm text-muted-foreground font-medium">🚪 Sortie :</span>
                          <span className="font-semibold">{participant.timeSlot.exitTime}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Squad */}
                {participant.squad && (
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Users className="w-5 h-5 text-green-500" />
                      Votre squad
                    </CardTitle>
                    <CardDescription>Informations de votre équipe</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-center py-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg">
                        <Badge variant="outline" className="text-2xl py-2 px-6 font-bold border-2">
                          Squad {participant.squad.number}
                        </Badge>
                      </div>
                      {participant.squad.briefing && (
                        <div className="space-y-2">
                          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Briefing :</span>
                          <p className="text-sm bg-muted/50 p-4 rounded-lg leading-relaxed border-l-4 border-primary">
                            {participant.squad.briefing}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
                )}

                {/* Personal Info */}
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <User className="w-5 h-5 text-purple-500" />
                      Informations personnelles
                    </CardTitle>
                    <CardDescription>Vos détails</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground font-medium">👤 Nom complet :</span>
                      <span className="font-semibold">{participant.firstName} {participant.lastName}</span>
                    </div>

                    {participant.email && (
                      <div className="flex items-center justify-between py-2 border-b">
                        <span className="text-sm text-muted-foreground font-medium">📧 Email :</span>
                        <span className="font-medium text-sm">{participant.email}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm text-muted-foreground font-medium">🎭 Type :</span>
                      <Badge
                        variant={participant.type === 'zombie' ? 'destructive' : participant.type === 'survivant' ? 'default' : 'secondary'}
                        className="uppercase font-bold"
                      >
                        {participant.type}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-muted-foreground font-medium">🔐 Code secret :</span>
                      <span className="font-mono font-bold text-lg bg-primary/10 px-3 py-1 rounded">{visitor.secretCode}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Check-in Status */}
                <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <MapPin className="w-5 h-5 text-orange-500" />
                    Statut d'arrivée
                  </CardTitle>
                  <CardDescription>Suivi de votre présence</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium">Arrivé :</span>
                    {participant.arrived ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm font-semibold text-green-600">
                          {participant.arrivedAt && format(new Date(participant.arrivedAt), "PPp", { locale: fr })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">En attente</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-3 px-4 bg-muted/30 rounded-lg">
                    <span className="text-sm font-medium">Retourné :</span>
                    {participant.returned ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                        <span className="text-sm font-semibold text-green-600">
                          {participant.returnedAt && format(new Date(participant.returnedAt), "PPp", { locale: fr })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <XCircle className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">En attente</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                </Card>
              </div>

              {/* Purchase History - Boutique */}
              {purchases.length > 0 && (
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <ShoppingBag className="w-5 h-5 text-indigo-500" />
                      Historique d'achats - Boutique
                    </CardTitle>
                    <CardDescription>Vos achats à la boutique</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {purchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-semibold">{purchase.shopItem?.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(purchase.purchasedAt), "PPp", { locale: fr })}
                              </span>
                              {purchase.discountApplied > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  -{purchase.discountApplied}%
                                </Badge>
                              )}
                              <Badge
                                variant={purchase.isPaid ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {purchase.isPaid ? "Payé" : "En attente"}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{purchase.totalPrice}€</p>
                            {purchase.discountApplied > 0 && (
                              <p className="text-sm text-muted-foreground line-through">
                                {purchase.originalPrice}€
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">Qté: {purchase.quantity}</p>
                          </div>
                        </div>
                      ))}

                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Total Boutique :</span>
                          <span className="text-2xl font-bold">
                            {purchases
                              .reduce((sum, p) => sum + parseFloat(p.totalPrice), 0)
                              .toFixed(2)}€
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Purchase History - Repas */}
              {mealPurchases.length > 0 && (
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Utensils className="w-5 h-5 text-orange-500" />
                      Historique d'achats - Repas
                    </CardTitle>
                    <CardDescription>Vos achats de repas</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {mealPurchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-semibold">{purchase.mealItem?.name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(purchase.purchasedAt), "PPp", { locale: fr })}
                              </span>
                              {purchase.discountApplied > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  -{purchase.discountApplied}%
                                </Badge>
                              )}
                              <Badge
                                variant={purchase.isPaid ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {purchase.isPaid ? "Payé" : "En attente"}
                              </Badge>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">{purchase.totalPrice}€</p>
                            {purchase.discountApplied > 0 && (
                              <p className="text-sm text-muted-foreground line-through">
                                {purchase.originalPrice}€
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">Qté: {purchase.quantity}</p>
                          </div>
                        </div>
                      ))}

                      <div className="border-t pt-4 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">Total Repas :</span>
                          <span className="text-2xl font-bold">
                            {mealPurchases
                              .reduce((sum, p) => sum + parseFloat(p.totalPrice), 0)
                              .toFixed(2)}€
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Total général */}
              {(purchases.length > 0 || mealPurchases.length > 0) && (
                <Card className="hover:shadow-lg transition-shadow border-2 border-primary/30">
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">Total général dépensé :</span>
                      <span className="text-3xl font-bold text-primary">
                        {(
                          purchases.reduce((sum, p) => sum + parseFloat(p.totalPrice), 0) +
                          mealPurchases.reduce((sum, p) => sum + parseFloat(p.totalPrice), 0)
                        ).toFixed(2)}€
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-center text-muted-foreground">
                  Impossible de charger vos informations
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </RequireVisitor>
  );
}
