import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2 } from "lucide-react";
import type { CreateSquadBatch, TimeSlot, SquadWithRelations } from "@shared/schema";
import { liveQueryPrefixes, matchesQueryPrefix } from "@shared/live-updates";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AddSquadDialogProps {
  type: "zombie" | "survivant";
}

const initialForm = { count: "1", maxMembers: "8", selectedTimeSlots: [] as number[], briefing: "" };

export function AddSquadDialog({ type }: AddSquadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState(initialForm);

  const timeSlotQuery = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type }],
    queryFn: async () => {
      const res = await fetch(`/api/time-slots?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const squadQuery = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type }],
    queryFn: async () => {
      const res = await fetch(`/api/squads/with-participants?type=${type}`);
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  const timeSlots = timeSlotQuery.data ?? [];
  const squadTotals = new Map<number, { count: number; lastNumber: number }>();
  for (const squad of squadQuery.data ?? []) {
    const previous = squadTotals.get(squad.timeSlotId);
    squadTotals.set(squad.timeSlotId, {
      count: (previous?.count ?? 0) + 1,
      lastNumber: Math.max(previous?.lastNumber ?? 0, squad.number),
    });
  }
  const count = Number(formData.count);
  const validCount = Number.isSafeInteger(count) && count > 0;
  const ready = timeSlotQuery.isSuccess && squadQuery.isSuccess;

  const refreshRoster = () => queryClient.invalidateQueries({
    predicate: ({ queryKey: [key] }) => typeof key === "string" &&
      liveQueryPrefixes.roster.some(prefix => matchesQueryPrefix(key, prefix)),
  });
  const createMutation = useMutation({
    mutationFn: async (batch: CreateSquadBatch) => {
      const response = await apiRequest("POST", "/api/squads/batch", batch);
      return await response.json() as { created: number };
    },
    onSuccess: async ({ created }) => {
      await refreshRoster();
      toast({
        title: "Squads créées",
        description: `${created} ${created === 1 ? "squad créée" : "squads créées"}.`,
      });
      setOpen(false);
      setFormData(initialForm);
    },
    onError: async (error: Error) => {
      await refreshRoster();
      toast({
        title: "Erreur",
        description: error.message.startsWith("409:")
          ? "La liste a changé. Vérifiez les prochains numéros avant de réessayer."
          : "Impossible de confirmer la création. Vérifiez la liste avant de réessayer.",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !validCount || createMutation.isPending || formData.selectedTimeSlots.length === 0) return;
    createMutation.mutate({
      type, count, maxMembers: Number(formData.maxMembers || initialForm.maxMembers),
      briefing: formData.briefing || null,
      slots: formData.selectedTimeSlots.map(id => ({ id, lastNumber: squadTotals.get(id)?.lastNumber ?? 0 })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={next => { if (!createMutation.isPending) setOpen(next); }}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Ajouter des squads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter des squads {type}</DialogTitle>
          <DialogDescription>La numérotation reprend après le dernier numéro de chaque créneau.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="count">Nombre de squads à créer par créneau *</Label>
            <Input
              id="count"
              type="number"
              min="1"
              disabled={createMutation.isPending}
              placeholder="Ex: 3"
              value={formData.count}
              onChange={(e) => setFormData({ ...formData, count: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Créneaux horaires * (sélectionnez-en au moins un)</Label>
            {timeSlotQuery.isError || squadQuery.isError ? (
              <Button type="button" variant="outline" onClick={() => { void refreshRoster(); }}>Recharger les créneaux et les squads</Button>
            ) : !ready ? (
              <p role="status" className="text-sm text-muted-foreground">Chargement des créneaux et des squads…</p>
            ) : timeSlots.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun créneau disponible</p>
            ) : (
              <div className="space-y-2 border rounded-lg p-3">
                {timeSlots.map((slot) => {
                  const total = squadTotals.get(slot.id) ?? { count: 0, lastNumber: 0 };
                  const next = total.lastNumber + 1;

                  return (
                    <div key={slot.id} className="flex items-start gap-2">
                      <Checkbox
                        id={`slot-${slot.id}`}
                        checked={formData.selectedTimeSlots.includes(slot.id)}
                        onCheckedChange={() => toggleTimeSlot(slot.id)}
                        disabled={createMutation.isPending}
                      />
                      <div className="flex-1">
                        <label
                          htmlFor={`slot-${slot.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {slot.name}
                        </label>
                        <p className="text-xs text-muted-foreground">
                          {total.count} {total.count === 1 ? "squad existante" : "squads existantes"}
                          {validCount && (count === 1 ? ` · Prochain numéro ${next}` : ` · Prochains numéros ${next} à ${total.lastNumber + count}`)}
                        </p>
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
              disabled={createMutation.isPending}
              value={formData.maxMembers}
              onChange={(e) => setFormData({ ...formData, maxMembers: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="briefing">Briefing (optionnel)</Label>
            <Textarea
              id="briefing"
              disabled={createMutation.isPending}
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
              disabled={createMutation.isPending}
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending || !ready || !validCount || formData.selectedTimeSlots.length === 0} className="flex-1">
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
