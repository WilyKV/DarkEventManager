import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Percent, Users, Shield, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Squad, Participant } from "@shared/schema";

export function DiscountManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch global discounts
  const { data: globalDiscounts, isLoading: isLoadingGlobal } = useQuery({
    queryKey: ["/api/discounts/global"],
    queryFn: async () => {
      const res = await fetch("/api/discounts/global");
      if (!res.ok) throw new Error("Failed to fetch global discounts");
      return res.json();
    },
  });

  // Fetch squads for squad discounts
  const { data: squads } = useQuery<Squad[]>({
    queryKey: ["/api/squads"],
    queryFn: async () => {
      const res = await fetch("/api/squads");
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  // Fetch participants for individual discounts
  const { data: participants } = useQuery<Participant[]>({
    queryKey: ["/api/participants"],
    queryFn: async () => {
      const res = await fetch("/api/participants");
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const [zombieDiscount, setZombieDiscount] = useState(0);
  const [survivantDiscount, setSurvivantDiscount] = useState(0);
  const [staffDiscount, setStaffDiscount] = useState(0);

  // Update global discounts
  const updateGlobalMutation = useMutation({
    mutationFn: async (data: { zombieDiscount: number; survivantDiscount: number; staffDiscount: number }) => {
      const res = await fetch("/api/discounts/global", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update global discounts");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/discounts/global"] });
      toast({
        title: "Réductions mises à jour",
        description: "Les réductions par type ont été mises à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les réductions",
        variant: "destructive",
      });
    },
  });

  // Update squad discount
  const updateSquadMutation = useMutation({
    mutationFn: async ({ squadId, discount }: { squadId: number; discount: number }) => {
      const res = await fetch(`/api/discounts/squad/${squadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount }),
      });
      if (!res.ok) throw new Error("Failed to update squad discount");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Réduction squad mise à jour",
        description: "La réduction pour ce squad a été mise à jour",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la réduction du squad",
        variant: "destructive",
      });
    },
  });

  // Update participant discount
  const updateParticipantMutation = useMutation({
    mutationFn: async ({ participantId, discount }: { participantId: number; discount: number | null }) => {
      const res = await fetch(`/api/discounts/participant/${participantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount }),
      });
      if (!res.ok) throw new Error("Failed to update participant discount");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Réduction participant mise à jour",
        description: "La réduction individuelle a été mise à jour",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour la réduction du participant",
        variant: "destructive",
      });
    },
  });

  const handleUpdateGlobal = () => {
    updateGlobalMutation.mutate({
      zombieDiscount,
      survivantDiscount,
      staffDiscount,
    });
  };

  // Initialize form with existing data
  useEffect(() => {
    if (globalDiscounts) {
      setZombieDiscount(globalDiscounts.zombieDiscount || 0);
      setSurvivantDiscount(globalDiscounts.survivantDiscount || 0);
      setStaffDiscount(globalDiscounts.staffDiscount || 0);
    }
  }, [globalDiscounts]);

  if (isLoadingGlobal) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="global" className="space-y-6">
      <TabsList className="bg-muted/50 border border-border/50">
        <TabsTrigger value="global" className="gap-2">
          <Percent className="w-4 h-4" />
          Par Type
        </TabsTrigger>
        <TabsTrigger value="squad" className="gap-2">
          <Users className="w-4 h-4" />
          Par Squad
        </TabsTrigger>
        <TabsTrigger value="participant" className="gap-2">
          <Shield className="w-4 h-4" />
          Par Participant
        </TabsTrigger>
      </TabsList>

      {/* Global Type-based Discounts */}
      <TabsContent value="global">
        <Card>
          <CardHeader>
            <CardTitle>Réductions par Type de Joueur</CardTitle>
            <CardDescription>
              Définissez des réductions en pourcentage pour chaque type de joueur
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zombie">Zombie (%)</Label>
              <Input
                id="zombie"
                type="number"
                min="0"
                max="100"
                value={zombieDiscount}
                onChange={(e) => setZombieDiscount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="survivant">Survivant (%)</Label>
              <Input
                id="survivant"
                type="number"
                min="0"
                max="100"
                value={survivantDiscount}
                onChange={(e) => setSurvivantDiscount(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff">Staff (%)</Label>
              <Input
                id="staff"
                type="number"
                min="0"
                max="100"
                value={staffDiscount}
                onChange={(e) => setStaffDiscount(parseInt(e.target.value) || 0)}
              />
            </div>
            <Button
              onClick={handleUpdateGlobal}
              disabled={updateGlobalMutation.isPending}
              className="w-full"
            >
              {updateGlobalMutation.isPending ? "Enregistrement..." : "Enregistrer les réductions"}
            </Button>
            <div className="p-4 bg-muted/50 rounded-lg text-sm">
              <p className="font-semibold mb-2">Règles de priorité :</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Réduction individuelle du participant (priorité absolue)</li>
                <li>La plus haute entre réduction de type et réduction de squad</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Squad-based Discounts */}
      <TabsContent value="squad">
        <Card>
          <CardHeader>
            <CardTitle>Réductions par Squad</CardTitle>
            <CardDescription>
              Définissez des réductions spécifiques pour chaque squad
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {squads && squads.length > 0 ? (
              squads.map((squad) => (
                <SquadDiscountRow
                  key={squad.id}
                  squad={squad}
                  onUpdate={(discount) =>
                    updateSquadMutation.mutate({ squadId: squad.id, discount })
                  }
                />
              ))
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucun squad disponible
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Participant-based Discounts */}
      <TabsContent value="participant">
        <Card>
          <CardHeader>
            <CardTitle>Réductions par Participant</CardTitle>
            <CardDescription>
              Définissez des réductions individuelles (priorité absolue)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
              <p className="font-semibold mb-2">💡 Comment ça marche :</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><strong>Aucune valeur</strong> : Utilise automatiquement la réduction de type ou squad</li>
                <li><strong>Valeur 0</strong> : Force aucune réduction (annule type/squad)</li>
                <li><strong>Valeur &gt; 0</strong> : Applique cette réduction spécifique</li>
              </ul>
            </div>
            {participants && participants.length > 0 ? (
              <div className="max-h-[400px] overflow-y-auto space-y-2">
                {participants.slice(0, 50).map((participant) => (
                  <ParticipantDiscountRow
                    key={participant.id}
                    participant={participant}
                    onUpdate={(discount) =>
                      updateParticipantMutation.mutate({ participantId: participant.id, discount })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Aucun participant disponible
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function SquadDiscountRow({
  squad,
  onUpdate,
}: {
  squad: Squad;
  onUpdate: (discount: number) => void;
}) {
  const [discount, setDiscount] = useState(0);

  const { data: squadDiscount } = useQuery({
    queryKey: [`/api/discounts/squad/${squad.id}`],
    queryFn: async () => {
      const res = await fetch(`/api/discounts/squad/${squad.id}`);
      if (!res.ok) throw new Error("Failed to fetch squad discount");
      const data = await res.json();
      setDiscount(data.discount || 0);
      return data;
    },
  });

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
      <div className="flex-1">
        <p className="font-medium">Squad {squad.number}</p>
        <p className="text-sm text-muted-foreground capitalize">{squad.type}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          max="100"
          value={discount}
          onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
          className="w-20"
        />
        <span className="text-muted-foreground">%</span>
        <Button size="sm" onClick={() => onUpdate(discount)}>
          Appliquer
        </Button>
      </div>
    </div>
  );
}

function ParticipantDiscountRow({
  participant,
  onUpdate,
}: {
  participant: Participant;
  onUpdate: (discount: number | null) => void;
}) {
  const [discount, setDiscount] = useState<string>("");

  const { data: participantDiscount } = useQuery({
    queryKey: [`/api/discounts/participant/${participant.id}`],
    queryFn: async () => {
      const res = await fetch(`/api/discounts/participant/${participant.id}`);
      if (!res.ok) throw new Error("Failed to fetch participant discount");
      const data = await res.json();
      setDiscount(data.discount !== null && data.discount !== undefined ? String(data.discount) : "");
      return data;
    },
  });

  const handleUpdate = () => {
    if (discount === "") {
      onUpdate(null);
    } else {
      onUpdate(parseInt(discount) || 0);
    }
  };

  const handleReset = () => {
    setDiscount("");
    onUpdate(null);
  };

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg border bg-card">
      <div className="flex-1">
        <p className="font-medium">{participant.firstName} {participant.lastName}</p>
        <p className="text-sm text-muted-foreground capitalize">{participant.type}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min="0"
          max="100"
          placeholder="Auto"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          className="w-20"
        />
        <span className="text-muted-foreground">%</span>
        <Button size="sm" onClick={handleUpdate}>
          Appliquer
        </Button>
        {discount !== "" && (
          <Button size="sm" variant="ghost" onClick={handleReset} title="Réinitialiser (utiliser type/squad)">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
