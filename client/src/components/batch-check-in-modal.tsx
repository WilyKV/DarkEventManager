import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { UserCheck, Save } from "lucide-react";
import { ParticipantWithRelations, SquadWithRelations } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SquadSelector } from "./squad-selector";

interface BatchCheckInModalProps {
  participants: ParticipantWithRelations[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BatchCheckInModal({ participants, onClose, onSuccess }: BatchCheckInModalProps) {
  const { toast } = useToast();
  const [selectedSquad, setSelectedSquad] = useState<string>("");
  const [checklist, setChecklist] = useState({
    mealTicket: false,
    waterBottle: false,
    squad: false,
    briefing: false,
    makeup: false,
    map: false,
  });

  const participantType = (participants[0]?.type || "zombie") as "zombie" | "survivant";

  // Fetch squads with participants
  const { data: squadsData } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants"],
    queryFn: async () => {
      const response = await fetch(`/api/squads/with-participants?type=${participantType}`);
      if (!response.ok) throw new Error("Failed to fetch squads");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; data: any }>) => {
      // Update all participants
      const promises = updates.map(({ id, data }) =>
        apiRequest("PATCH", `/api/participants/${id}`, data)
      );
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/participants' });
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === '/api/squads' });
      toast({
        title: "Succès",
        description: `${participants.length} participant${participants.length > 1 ? 's ont été enregistrés' : ' a été enregistré'}`,
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour les participants",
        variant: "destructive",
      });
    },
  });

  const handleToggleChecklist = (key: keyof typeof checklist) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = () => {
    const normalizedSquadId = selectedSquad && selectedSquad.trim() !== "" 
      ? parseInt(selectedSquad) 
      : null;

    const allChecklistCompleted = Object.values(checklist).every(v => v);

    const updates = participants.map(p => ({
      id: p.id,
      data: {
        arrived: true,
        arrivedAt: new Date(),
        squadId: normalizedSquadId,
        mealTicketGiven: checklist.mealTicket,
        waterBottleGiven: checklist.waterBottle,
        squadExplained: checklist.squad,
        briefingExplained: checklist.briefing,
        makeupWaitExplained: checklist.makeup,
        mapGiven: checklist.map,
        checklistCompleted: allChecklistCompleted,
      },
    }));

    updateMutation.mutate(updates);
  };

  const allChecklistCompleted = Object.values(checklist).every(v => v);
  const checklistCount = Object.values(checklist).filter(v => v).length;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <UserCheck className="w-6 h-6 text-primary" />
            Check-in en lot
          </DialogTitle>
          <DialogDescription>
            Enregistrez l'arrivée de {participants.length} participant{participants.length > 1 ? 's' : ''} en même temps
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Liste des participants */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-foreground">Participants sélectionnés</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {participants.map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="text-muted-foreground">
                    {p.timeSlot?.name || "Pas de créneau"}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Sélection de squad */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Assignation de squad</h3>
            <p className="text-sm text-muted-foreground">
              Tous les participants seront assignés à la même squad
            </p>
            {squadsData && (
              <SquadSelector
                squads={squadsData}
                selectedSquadId={selectedSquad}
                onSquadSelect={setSelectedSquad}
                participantType={participantType}
              />
            )}
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">Checklist bénévole</h3>
              <Badge 
                variant={allChecklistCompleted ? "default" : "secondary"}
                data-testid="badge-checklist-status"
              >
                {checklistCount}/6 complété{checklistCount > 1 ? 's' : ''}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Cochez les étapes complétées pour tous les participants
            </p>
            <Card className="p-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md transition-all">
                  <Checkbox
                    checked={checklist.mealTicket}
                    onCheckedChange={() => handleToggleChecklist("mealTicket")}
                    data-testid="checkbox-meal-ticket"
                  />
                  <span className="text-sm text-foreground">Billet de repas remis</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md transition-all">
                  <Checkbox
                    checked={checklist.waterBottle}
                    onCheckedChange={() => handleToggleChecklist("waterBottle")}
                    data-testid="checkbox-water-bottle"
                  />
                  <span className="text-sm text-foreground">Bouteille d'eau remise</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md transition-all">
                  <Checkbox
                    checked={checklist.squad}
                    onCheckedChange={() => handleToggleChecklist("squad")}
                    data-testid="checkbox-squad"
                  />
                  <span className="text-sm text-foreground">Squad expliquée</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md transition-all">
                  <Checkbox
                    checked={checklist.briefing}
                    onCheckedChange={() => handleToggleChecklist("briefing")}
                    data-testid="checkbox-briefing"
                  />
                  <span className="text-sm text-foreground">Briefing expliqué</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md transition-all">
                  <Checkbox
                    checked={checklist.makeup}
                    onCheckedChange={() => handleToggleChecklist("makeup")}
                    data-testid="checkbox-makeup"
                  />
                  <span className="text-sm text-foreground">Attente maquillage expliquée</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer hover-elevate p-2 rounded-md transition-all">
                  <Checkbox
                    checked={checklist.map}
                    onCheckedChange={() => handleToggleChecklist("map")}
                    data-testid="checkbox-map"
                  />
                  <span className="text-sm text-foreground">Carte remise</span>
                </label>
              </div>
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={updateMutation.isPending}
              data-testid="button-cancel"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
              className="gap-2"
              data-testid="button-save-batch"
            >
              <Save className="w-4 h-4" />
              {updateMutation.isPending 
                ? "Enregistrement..." 
                : `Enregistrer ${participants.length} participant${participants.length > 1 ? 's' : ''}`
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
