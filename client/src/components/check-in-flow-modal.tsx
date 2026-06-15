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
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface CheckInFlowModalProps {
  participant: ParticipantWithRelations;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function CheckInFlowModal({ participant, onClose, onSuccess }: CheckInFlowModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedSquad, setSelectedSquad] = useState(participant.squadId?.toString() || "");
  const [selectedTimeSlotId, setSelectedTimeSlotId] = useState<number | null>(participant.timeSlotId ?? null);

  const { data: timeSlots = [] } = useQuery({
    queryKey: ["/api/time-slots", { type: participant.type }],
    queryFn: async () => {
      const response = await fetch(`/api/time-slots?type=${participant.type}`);
      if (!response.ok) throw new Error("Failed to fetch time slots");
      return response.json();
    },
  });

  const { data: squadsWithParticipants = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: participant.type, timeSlotId: selectedTimeSlotId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("type", participant.type);
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
    mutationFn: async (data: any) => {
      return apiRequest("PATCH", `/api/participants/${participant.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "/api/participants"
      });
      toast({
        title: "Enregistrement terminé",
        description: "Le participant a été enregistré avec succès",
      });
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le participant",
        variant: "destructive",
      });
    },
  });

  const handleComplete = () => {
    const normalizedSquadId = selectedSquad && selectedSquad.trim() !== ""
      ? parseInt(selectedSquad)
      : null;

    const updateData: any = {
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
    };

    updateMutation.mutate(updateData);
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
            Enregistrement - {participant.firstName} {participant.lastName}
          </DialogTitle>
        </DialogHeader>

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
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Sélection du créneau et de la squad</h3>
                <p className="text-muted-foreground">Choisissez d'abord un créneau, puis la squad pour ce participant</p>
              </div>

              {/* Time Slot Selection */}
              {!participant.timeSlotId && (
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
                  <h4 className="font-semibold text-sm">{!participant.timeSlotId ? "2. " : ""}Sélectionner une squad</h4>
                  <SquadSelector
                    squads={squadsWithParticipants}
                    selectedSquadId={selectedSquad}
                    onSquadSelect={setSelectedSquad}
                    participantType={participant.type as "zombie" | "survivant"}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Squad Information */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
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

                    {selectedSquadData.participants && selectedSquadData.participants.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground mb-2">Membres de la squad :</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSquadData.participants.map((p) => (
                            <Badge key={p.id} variant="outline" className="text-xs">
                              {p.firstName} {p.lastName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedSquadData?.timeSlot && (
                      <div className="border-t border-primary/20 pt-4 mt-4">
                        <p className="text-sm font-semibold text-foreground mb-2">Créneau horaire :</p>
                        <p className="text-lg">
                          <span className="font-semibold">Briefing:</span> {selectedSquadData.timeSlot.briefingTime} •{" "}
                          <span className="font-semibold">Jeu:</span> {selectedSquadData.timeSlot.gameTime}
                        </p>
                      </div>
                    )}

                    {selectedSquadData.briefing && (
                      <div className="border-t border-primary/20 pt-4 mt-4">
                        <p className="text-sm font-semibold text-foreground mb-2">Briefing :</p>
                        <p className="text-sm text-muted-foreground">{selectedSquadData.briefing}</p>
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <p className="text-sm text-muted-foreground">
                      <strong>Important :</strong> Le participant doit connaître sa squad pour retrouver facilement ses coéquipiers après le briefing.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-muted-foreground">
                  <p>Aucune squad sélectionnée</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Meal Information */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Informations repas</h3>
                <p className="text-muted-foreground">Badge et bouteille d'eau</p>
              </div>

              <div className="space-y-4">
                <div className="p-6 rounded-lg bg-chart-5/10 border-2 border-chart-5/30">
                  <div className="flex items-start gap-4">
                    <Utensils className="w-8 h-8 text-chart-5 flex-shrink-0 mt-1" />
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-foreground mb-3">Repas gratuit</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Le participant doit présenter son <strong>badge numérique ou imprimé</strong> pour bénéficier de son repas gratuit à la buvette.
                      </p>
                      <div className="bg-background/80 p-3 rounded-md">
                        <p className="text-sm">
                          <strong>Horaires disponibles :</strong> À partir de 18h00 - <em>Allez-y dès que possible pour éviter l'affluence</em>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 rounded-lg bg-chart-3/10 border-2 border-chart-3/30">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 flex items-center justify-center text-chart-3 flex-shrink-0 mt-1">
                      <svg className="w-full h-full" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C10.9 2 10 2.9 10 4V11H4V13C4 16.87 7.13 20 11 20H13C16.87 20 20 16.87 20 13V11H14V4C14 2.9 13.1 2 12 2M8 13H4.07C4.24 15.7 6.3 17.76 9 17.93V13M20 13C20 15.76 17.76 18 15 18V13H20Z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-foreground mb-3">Bouteille d'eau</h4>
                      <p className="text-sm text-muted-foreground">
                        <strong>Donnez une bouteille d'eau</strong> au participant. Il devra la remplir avant de partir en jeu aux jerricanes prévus à cet effet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Makeup Information */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Maquillage</h3>
                <p className="text-muted-foreground">Instructions pour le maquillage</p>
              </div>

              <div className="p-6 rounded-lg bg-chart-4/10 border-2 border-chart-4/30">
                <div className="flex items-start gap-4">
                  <Paintbrush className="w-8 h-8 text-chart-4 flex-shrink-0 mt-1" />
                  <div className="flex-1 space-y-4">
                    <div>
                      <h4 className="text-lg font-semibold text-foreground mb-3">Badge requis</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Le participant doit présenter son <strong>badge numérique ou imprimé</strong> au stand de maquillage pour se faire maquiller.
                      </p>
                    </div>

                    <div className="bg-background/80 p-4 rounded-md">
                      <p className="text-sm text-foreground mb-2">
                        <strong>Instructions :</strong>
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                        <li>Le participant doit patienter son tour pour le maquillage</li>
                        <li>Il doit être prêt pour le briefing à l'heure prévue</li>
                        <li>Une fois maquillé, il peut rejoindre sa squad</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Practical Information */}
          {currentStep === 5 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-semibold text-foreground mb-2">Informations pratiques</h3>
                <p className="text-muted-foreground">Dernières instructions</p>
              </div>

              <div className="space-y-4">
                <div className="p-6 rounded-lg bg-muted/30 border-2 border-border">
                  <div className="flex items-start gap-4">
                    <MapPin className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                    <div className="flex-1 space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-foreground mb-3">Dépôt des sacs</h4>
                        <p className="text-sm text-muted-foreground">
                          Un espace est prévu pour déposer les sacs personnels. <strong className="text-foreground">Attention : nous n'assurons pas une surveillance constante.</strong> Nous recommandons de ne pas laisser d'objets de valeur.
                        </p>
                      </div>

                      <div className="border-t border-border pt-4">
                        <h4 className="text-lg font-semibold text-foreground mb-3">Carte du terrain (optionnel)</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          Si le participant souhaite reconnaître le terrain avant le briefing, vous pouvez lui fournir une carte.
                        </p>
                        <div className="bg-background/80 p-3 rounded-md">
                          <p className="text-sm text-foreground">
                            <strong>Rappel important :</strong> Le participant doit être présent pour le briefing à l'heure prévue.
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <h4 className="text-lg font-semibold text-foreground mb-3">Retour après la course</h4>
                        <p className="text-sm text-muted-foreground">
                          À la fin de la course, le participant doit revenir au stand <strong>"Arrivée"</strong> pour confirmer son retour.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {participant.secretCode && (
                  <div className="p-6 rounded-lg bg-primary/10 border-2 border-primary/20 text-center">
                    <p className="text-sm text-muted-foreground mb-2">Numéro de casier</p>
                    <p className="text-5xl font-mono font-bold text-primary">
                      {participant.secretCode}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex gap-3 pt-6 border-t">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep((currentStep - 1) as Step) : onClose()}
            className="flex-1"
            disabled={updateMutation.isPending}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            {currentStep > 1 ? "Précédent" : "Annuler"}
          </Button>

          {currentStep < 5 ? (
            <Button
              onClick={() => setCurrentStep((currentStep + 1) as Step)}
              className="flex-1"
              disabled={currentStep === 1 && (!selectedTimeSlotId || !selectedSquad)}
            >
              Suivant
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              className="flex-1 gap-2"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Terminer l'enregistrement
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
