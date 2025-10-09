import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParticipantWithRelations, SquadWithRelations } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft, CheckCircle, Users, Utensils, Paintbrush, MapPin, Loader2 } from "lucide-react";
import { SquadSelector } from "./squad-selector";

interface BatchCheckInModalProps {
  participants: ParticipantWithRelations[];
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function BatchCheckInModal({ participants, onClose, onSuccess }: BatchCheckInModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedSquad, setSelectedSquad] = useState("");
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<number | null>(
    participants[0]?.timeSlotId ?? null
  );

  const participantType = participants[0]?.type || "zombie";

  const { data: timeSlots = [] } = useQuery({
    queryKey: ["/api/time-slots", { type: participantType }],
    queryFn: async () => {
      const response = await fetch(`/api/time-slots?type=${participantType}`);
      if (!response.ok) throw new Error("Failed to fetch time slots");
      return response.json();
    },
  });

  const { data: squadsWithParticipants = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: participantType, timeSlotId: selectedTimeSlotId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("type", participantType);
      if (selectedTimeSlotId) {
        params.append("timeSlotId", selectedTimeSlotId.toString());
      }
      const response = await fetch(`/api/squads/with-participants?${params}`);
      if (!response.ok) throw new Error("Failed to fetch squads");
      return response.json();
    },
    enabled: selectedTimeSlotId !== null,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const normalizedSquadId = selectedSquad && selectedSquad.trim() !== "" ? parseInt(selectedSquad) : null;

      return Promise.all(
        participants.map(participant =>
          apiRequest("PATCH", `/api/participants/${participant.id}`, {
            arrived: true,
            arrivedAt: new Date(),
            timeSlotId: selectedTimeSlotId,
            squadId: normalizedSquadId,
            mealTicketGiven: true,
            waterBottleGiven: true,
            squadExplained: true,
            briefingExplained: true,
            makeupWaitExplained: true,
            mapGiven: true,
            checklistCompleted: true,
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "/api/participants"
      });
      toast({
        title: "Enregistrement terminé",
        description: `${participants.length} participant(s) enregistré(s) avec succès`,
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les participants",
        variant: "destructive",
      });
    },
  });

  const handleComplete = () => {
    updateMutation.mutate();
  };

  const selectedSquadData = squadsWithParticipants.find(s => s.id.toString() === selectedSquad);

  const steps = [
    { num: 1, title: "Squad", icon: Users },
    { num: 2, title: "Informations", icon: CheckCircle },
    { num: 3, title: "Repas", icon: Utensils },
    { num: 4, title: "Maquillage", icon: Paintbrush },
    { num: 5, title: "Infos pratiques", icon: MapPin },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-3xl font-bold text-primary">
            Enregistrement groupé - {participants.length} participant{participants.length > 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {/* Participants List */}
        <div className="mb-4">
          <p className="text-sm font-semibold mb-2">Participants sélectionnés :</p>
          <div className="flex flex-wrap gap-2">
            {participants.map((p) => (
              <Badge key={p.id} variant="secondary">
                {p.firstName} {p.lastName}
              </Badge>
            ))}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 mt-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.num;
            const isCompleted = currentStep > step.num;

            return (
              <div key={step.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isCompleted
                        ? "bg-primary text-primary-foreground"
                        : isActive
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <StepIcon className="w-6 h-6" />
                    )}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                    {step.title}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-2 transition-colors duration-300 ${
                      currentStep > step.num ? "bg-primary" : "bg-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="space-y-6">
          {/* Step 1: Squad Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Sélection du créneau et de la squad</h3>
                <p className="text-muted-foreground">Tous les participants seront assignés au même créneau et à la même squad</p>
              </div>

              {/* Time Slot Selection */}
              {!participants[0]?.timeSlotId && (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/20">
                  <h4 className="font-semibold text-sm">1. Sélectionner un créneau horaire</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {timeSlots.map((slot: any) => (
                      <Button
                        key={slot.id}
                        variant={selectedTimeSlotId === slot.id ? "default" : "outline"}
                        className="w-full justify-start"
                        onClick={() => {
                          setSelectedTimeSlotId(slot.id);
                          setSelectedSquad(""); // Reset squad selection when changing time slot
                        }}
                      >
                        <div className="text-left">
                          <div className="font-semibold">{slot.name}</div>
                          <div className="text-xs opacity-80">
                            Briefing: {slot.briefingTime} • Jeu: {slot.gameTime}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Squad Selection */}
              {selectedTimeSlotId && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">{!participants[0]?.timeSlotId ? "2. " : ""}Sélectionner une squad</h4>
                  <SquadSelector
                    squads={squadsWithParticipants}
                    selectedSquadId={selectedSquad}
                    onSquadSelect={setSelectedSquad}
                    participantType={participantType as "zombie" | "survivant"}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Squad Information */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Informations de la squad</h3>
                <p className="text-muted-foreground">Détails du créneau et briefing</p>
              </div>

              {selectedSquadData ? (
                <div className="space-y-4">
                  <div className="p-6 rounded-lg bg-primary/5 border-2 border-primary/20">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-bold text-primary">Squad {selectedSquadData.number}</h4>
                      <Badge className="bg-primary">{selectedSquadData.type}</Badge>
                    </div>

                    {/* Timeslot hours */}
                    {selectedSquadData.timeSlot && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground mb-2">Créneau horaire :</p>
                        <p className="text-sm text-muted-foreground">
                          Briefing: {selectedSquadData.timeSlot.briefingTime} • Jeu: {selectedSquadData.timeSlot.gameTime} • Sortie: {selectedSquadData.timeSlot.exitTime}
                        </p>
                      </div>
                    )}

                    {/* Squad members */}
                    {selectedSquadData.participants && selectedSquadData.participants.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground mb-2">
                          Membres de la squad ({selectedSquadData.participants.length}) :
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {selectedSquadData.participants.map((p) => (
                            <div key={p.id} className="text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded">
                              {p.firstName} {p.lastName}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Briefing */}
                    {selectedSquadData.briefing && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-foreground mb-2">Briefing :</p>
                        <p className="text-sm text-muted-foreground">{selectedSquadData.briefing}</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <p>Aucune squad sélectionnée</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Meal */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Informations repas</h3>
              </div>
              <div className="p-6 rounded-lg bg-chart-5/10 border-2 border-chart-5/30">
                <h4 className="text-lg font-semibold text-foreground mb-3">Repas gratuit + Bouteille d'eau</h4>
                <p className="text-sm text-muted-foreground">
                  Badge requis pour le repas. Donner une bouteille d'eau à remplir aux jerricanes.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Makeup */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Maquillage</h3>
              </div>
              <div className="p-6 rounded-lg bg-chart-4/10 border-2 border-chart-4/30">
                <h4 className="text-lg font-semibold text-foreground mb-3">Badge requis</h4>
                <p className="text-sm text-muted-foreground">
                  Présenter le badge au stand maquillage. Patienter son tour.
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Practical Info */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Informations pratiques</h3>
              </div>
              <div className="p-6 rounded-lg bg-muted/30 border-2 border-border">
                <h4 className="text-lg font-semibold text-foreground mb-3">Dépôt des sacs</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Espace disponible. Pas de surveillance constante.
                </p>
                <h4 className="text-lg font-semibold text-foreground mb-3">Carte du terrain (optionnel)</h4>
                <p className="text-sm text-muted-foreground">
                  Disponible pour reconnaître le terrain avant le briefing.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep((currentStep - 1) as Step) : onClose()}
            disabled={updateMutation.isPending}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {currentStep > 1 ? "Précédent" : "Annuler"}
          </Button>

          <div className="flex-1" />

          {currentStep < 5 ? (
            <Button
              onClick={() => setCurrentStep((currentStep + 1) as Step)}
              disabled={updateMutation.isPending || (currentStep === 1 && (!selectedTimeSlotId || !selectedSquad))}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={updateMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Terminer
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
