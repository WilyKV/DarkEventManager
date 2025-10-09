import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ParticipantWithRelations, SquadWithRelations, SquadAuditLogWithRelations } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, History } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SquadSelector } from "./squad-selector";

interface CheckInModalProps {
  participant: ParticipantWithRelations;
  onClose: () => void;
  onSuccess: () => void;
}

export function CheckInModal({ participant, onClose, onSuccess }: CheckInModalProps) {
  const { toast } = useToast();
  const [arrived, setArrived] = useState(participant.arrived);
  const [selectedSquad, setSelectedSquad] = useState(participant.squadId?.toString() || "");
  const [checklist, setChecklist] = useState({
    mealTicket: participant.mealTicketGiven,
    waterBottle: participant.waterBottleGiven,
    squad: participant.squadExplained,
    briefing: participant.briefingExplained,
    makeup: participant.makeupWaitExplained,
    map: participant.mapGiven,
  });

  const { data: squadHistory = [] } = useQuery<SquadAuditLogWithRelations[]>({
    queryKey: [`/api/participants/${participant.id}/squad-history`],
    queryFn: async () => {
      const response = await fetch(`/api/participants/${participant.id}/squad-history`);
      if (!response.ok) throw new Error("Failed to fetch squad history");
      return response.json();
    },
  });

  const { data: squadsWithParticipants = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: participant.type, timeSlotId: participant.timeSlotId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("type", participant.type);
      const response = await fetch(`/api/squads/with-participants?${params}`);
      if (!response.ok) throw new Error("Failed to fetch squads");
      return response.json();
    },
  });

  // Filtrer les squads pour n'afficher que celles associées au créneau du participant
  const filteredSquads = participant.timeSlotId 
    ? squadsWithParticipants.filter(squad => squad.timeSlotId === participant.timeSlotId)
    : squadsWithParticipants;

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/participants/${participant.id}`, data);
    },
    onSuccess: () => {
      // Invalidate all participant queries regardless of type using predicate
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === "/api/participants"
      });
      // Also invalidate squad history
      queryClient.invalidateQueries({ 
        queryKey: [`/api/participants/${participant.id}/squad-history`]
      });
      toast({
        title: "Succès",
        description: "Participant mis à jour avec succès",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le participant",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const allChecklistCompleted = Object.values(checklist).every(v => v);
    
    // Normalize squadId: convert empty string to null, otherwise parse to number
    const normalizedSquadId = selectedSquad && selectedSquad.trim() !== "" 
      ? parseInt(selectedSquad) 
      : null;
    
    const updateData: any = {
      arrived,
      squadId: normalizedSquadId,
      mealTicketGiven: checklist.mealTicket,
      waterBottleGiven: checklist.waterBottle,
      squadExplained: checklist.squad,
      briefingExplained: checklist.briefing,
      makeupWaitExplained: checklist.makeup,
      mapGiven: checklist.map,
      checklistCompleted: allChecklistCompleted,
    };

    // Set arrivedAt timestamp when marking as arrived
    if (arrived && !participant.arrived) {
      updateData.arrivedAt = new Date();
    }
    
    updateMutation.mutate(updateData);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-check-in">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display text-primary">
            Enregistrement - {participant.firstName} {participant.lastName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Arrival Status */}
          <div className="flex items-center gap-3 p-4 rounded-lg bg-card border">
            <Checkbox
              id="arrived"
              checked={!!arrived}
              onCheckedChange={(checked) => setArrived(checked as boolean)}
              data-testid="checkbox-arrived"
            />
            <Label htmlFor="arrived" className="text-lg font-semibold cursor-pointer">
              Participant arrivé
            </Label>
          </div>

          {/* Squad Assignment */}
          <SquadSelector
            squads={filteredSquads}
            selectedSquadId={selectedSquad}
            onSquadSelect={setSelectedSquad}
            participantType={participant.type as "zombie" | "survivant"}
          />

          {/* Locker Number Display */}
          {participant.secretCode && (
            <div className="p-6 rounded-lg bg-primary/10 border-2 border-primary/20 text-center">
              <p className="text-sm text-muted-foreground mb-2">Numéro de casier</p>
              <p className="text-4xl font-mono font-bold text-primary" data-testid="text-locker-number">
                {participant.secretCode}
              </p>
            </div>
          )}

          {/* Squad History */}
          {squadHistory.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <Label className="text-base font-semibold">Historique des changements de squad</Label>
              </div>
              <div className="rounded-lg border bg-card">
                <div className="max-h-32 overflow-y-auto">
                  {squadHistory.map((log) => (
                    <div 
                      key={log.id} 
                      className="px-4 py-2 border-b last:border-b-0 text-sm"
                      data-testid={`squad-history-${log.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <span className="text-muted-foreground">
                            {log.previousSquadId ? log.previousSquad?.name : "Aucune squad"}
                          </span>
                          <span className="mx-2">→</span>
                          <span className="font-semibold text-primary">
                            {log.newSquadId ? log.newSquad?.name : "Aucune squad"}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {log.changedAt && format(new Date(log.changedAt), "dd/MM HH:mm", { locale: fr })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Checklist pour bénévole</h3>
              {Object.values(checklist).every(v => v) && (
                <Badge className="bg-chart-1 text-white">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Complet
                </Badge>
              )}
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-card border">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="check-meal"
                  checked={!!checklist.mealTicket}
                  onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, mealTicket: checked as boolean }))}
                  data-testid="checkbox-meal-ticket"
                />
                <Label htmlFor="check-meal" className="cursor-pointer leading-relaxed">
                  <strong>Ticket repas:</strong> Donner un ticket repas à utiliser à la buvette (ouvre à 18h - allez-y dès que possible)
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="check-water"
                  checked={!!checklist.waterBottle}
                  onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, waterBottle: checked as boolean }))}
                  data-testid="checkbox-water-bottle"
                />
                <Label htmlFor="check-water" className="cursor-pointer leading-relaxed">
                  <strong>Bouteille d'eau:</strong> Donner une bouteille d'eau à remplir avant de partir en jeu aux jerricanes
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="check-squad"
                  checked={!!checklist.squad}
                  onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, squad: checked as boolean }))}
                  data-testid="checkbox-squad-explained"
                />
                <Label htmlFor="check-squad" className="cursor-pointer leading-relaxed">
                  <strong>Squad:</strong> Les ajouter à une squad pour qu'ils connaissent leurs potes. Ils doivent connaître leur squad pour les retrouver facilement après le briefing
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="check-briefing"
                  checked={!!checklist.briefing}
                  onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, briefing: checked as boolean }))}
                  data-testid="checkbox-briefing-explained"
                />
                <Label htmlFor="check-briefing" className="cursor-pointer leading-relaxed">
                  <strong>Briefing:</strong> Expliquer qu'ils doivent être prêts pour le briefing. Quand ils ont terminé la course, ils reviennent au stand "Arrivée" pour qu'on coche qu'ils sont bien rentrés
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="check-makeup"
                  checked={!!checklist.makeup}
                  onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, makeup: checked as boolean }))}
                  data-testid="checkbox-makeup-explained"
                />
                <Label htmlFor="check-makeup" className="cursor-pointer leading-relaxed">
                  <strong>Maquillage:</strong> Les laisser patienter en attendant leur tour de maquillage
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="check-map"
                  checked={!!checklist.map}
                  onCheckedChange={(checked) => setChecklist(prev => ({ ...prev, map: checked as boolean }))}
                  data-testid="checkbox-map-given"
                />
                <Label htmlFor="check-map" className="cursor-pointer leading-relaxed">
                  <strong>Carte (optionnel):</strong> Si certains veulent aller se promener, pas de souci, mais qu'ils soient bien présents pour le briefing. S'ils veulent aller reconnaître le terrain: leur donner une carte
                </Label>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={updateMutation.isPending}
              data-testid="button-cancel"
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 gap-2"
              disabled={updateMutation.isPending}
              data-testid="button-save-checkin"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
