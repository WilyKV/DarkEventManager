import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import { TimeSlot, SquadWithRelations } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddSquadDialogProps {
  type: "zombie" | "survivant";
}

export function AddSquadDialog({ type }: AddSquadDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    count: "1",
    maxMembers: "8",
    selectedTimeSlots: [] as number[],
    briefing: "",
  });

  const { data: timeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type }],
    queryFn: async () => {
      const res = await fetch(`/api/time-slots?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const { data: existingSquads = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type }],
    queryFn: async () => {
      const res = await fetch(`/api/squads/with-participants?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (squadsToCreate: any[]) => {
      // Check for duplicate squad numbers before creating
      for (const squad of squadsToCreate) {
        const exists = existingSquads.find(
          s => s.timeSlotId === squad.timeSlotId && s.number === squad.number
        );
        if (exists) {
          throw new Error(`La squad ${squad.number} existe déjà pour ce créneau`);
        }
      }

      return Promise.all(
        squadsToCreate.map((squad) => apiRequest("POST", "/api/squads", squad))
      );
    },
    onSuccess: (_, squadsToCreate) => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/squads" });
      toast({
        title: "Squads créées",
        description: `${squadsToCreate.length} squad(s) créée(s) avec succès`,
      });
      setOpen(false);
      setFormData({ count: "1", maxMembers: "8", selectedTimeSlots: [], briefing: "" });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer les squads",
        variant: "destructive",
      });
    },
  });

  const toggleTimeSlot = (timeSlotId: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedTimeSlots: prev.selectedTimeSlots.includes(timeSlotId)
        ? prev.selectedTimeSlots.filter((id) => id !== timeSlotId)
        : [...prev.selectedTimeSlots, timeSlotId],
    }));
  };

  const getNextSquadNumber = (timeSlotId: number): number => {
    const squadsInTimeslot = existingSquads.filter((s) => s.timeSlotId === timeSlotId);
    const usedNumbers = squadsInTimeslot.map((s) => s.number);

    // Find the smallest available number from 1 to 8
    for (let i = 1; i <= 8; i++) {
      if (!usedNumbers.includes(i)) {
        return i;
      }
    }
    return 1; // Fallback (should show error if all numbers are taken)
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.selectedTimeSlots.length === 0) {
      toast({
        title: "Erreur",
        description: "Sélectionnez au moins un créneau",
        variant: "destructive",
      });
      return;
    }

    const count = parseInt(formData.count);
    if (count < 1 || count > 8) {
      toast({
        title: "Erreur",
        description: "Le nombre de squads doit être entre 1 et 8",
        variant: "destructive",
      });
      return;
    }

    const squadsToCreate: any[] = [];

    // For each selected timeslot
    for (const timeSlotId of formData.selectedTimeSlots) {
      let startNumber = getNextSquadNumber(timeSlotId);

      // Create 'count' squads for this timeslot
      for (let i = 0; i < count; i++) {
        const squadNumber = startNumber + i;

        if (squadNumber > 8) {
          toast({
            title: "Attention",
            description: `Impossible de créer ${count} squads dans certains créneaux (limite de 8 atteinte)`,
            variant: "destructive",
          });
          return;
        }

        squadsToCreate.push({
          number: squadNumber,
          type,
          maxMembers: parseInt(formData.maxMembers) || 8,
          timeSlotId,
          briefing: formData.briefing || null,
        });
      }
    }

    createMutation.mutate(squadsToCreate);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter des squads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter des squads {type}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="count">Nombre de squads à créer par créneau *</Label>
            <Input
              id="count"
              type="number"
              min="1"
              max="8"
              placeholder="Ex: 3"
              value={formData.count}
              onChange={(e) => setFormData({ ...formData, count: e.target.value })}
              required
            />
            <p className="text-xs text-muted-foreground">
              Les numéros seront automatiquement incrémentés (1, 2, 3...)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Créneaux horaires * (sélectionnez-en au moins un)</Label>
            {timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun créneau disponible</p>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                {timeSlots.map((slot) => {
                  const squadsInSlot = existingSquads.filter((s) => s.timeSlotId === slot.id);
                  const nextNumber = getNextSquadNumber(slot.id);
                  const count = parseInt(formData.count) || 1;
                  const willExceedLimit = nextNumber + count - 1 > 8;

                  return (
                    <div key={slot.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`slot-${slot.id}`}
                        checked={formData.selectedTimeSlots.includes(slot.id)}
                        onCheckedChange={() => toggleTimeSlot(slot.id)}
                        disabled={willExceedLimit}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`slot-${slot.id}`}
                          className={`text-sm font-medium cursor-pointer ${willExceedLimit ? 'text-muted-foreground line-through' : ''}`}
                        >
                          {slot.name}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {squadsInSlot.length} squad(s) existante(s) • Prochains numéros: {nextNumber} à {nextNumber + count - 1}
                        </p>
                        {willExceedLimit && (
                          <p className="text-xs text-destructive">
                            Limite de 8 squads atteinte
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="maxMembers">Nombre maximum de membres par squad</Label>
            <Input
              id="maxMembers"
              type="number"
              min="1"
              value={formData.maxMembers}
              onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="briefing">Briefing (optionnel)</Label>
            <Textarea
              id="briefing"
              placeholder="Instructions communes pour ces squads..."
              value={formData.briefing}
              onChange={(e) => setFormData({ ...formData, briefing: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="flex-1">
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
