import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ParticipantWithRelations, SquadWithRelations } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft, CheckCircle, Users, Utensils, Paintbrush, MapPin, Loader2 } from "lucide-react";
import { SquadSelector } from "./squad-selector";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface BatchCheckInFlowModalProps {
  participants: ParticipantWithRelations[];
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function BatchCheckInFlowModal({ participants, onClose, onSuccess }: BatchCheckInFlowModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedSquad, setSelectedSquad] = useState("");

  const participantType = (participants[0]?.type || "zombie") as "zombie" | "survivant";

  const { data: squadsWithParticipants = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: participantType }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("type", participantType);
      const response = await fetch(`/api/squads/with-participants?${params}`);
      if (!response.ok) throw new Error("Failed to fetch squads");
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Array<{ id: number; data: any }>) => {
      await apiRequest("POST", "/api/participants/batch-update", { updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === "/api/participants"
      });
      toast({
        title: "Enregistrement terminé",
        description: `${participants.length} participant${participants.length > 1 ? 's ont été enregistrés' : ' a été enregistré'}`,
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
    const normalizedSquadId = selectedSquad && selectedSquad.trim() !== ""
      ? parseInt(selectedSquad)
      : null;

    const updates = participants.map(p => ({
      id: p.id,
      data: {
        arrived: true,
        arrivedAt: new Date(),
        squadId: normalizedSquadId,
        mealTicketGiven: true,
        waterBottleGiven: true,
        squadExplained: true,
        briefingExplained: true,
        makeupWaitExplained: true,
        mapGiven: true,
        checklistCompleted: true,
      },
    }));

    updateMutation.mutate(updates);
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
                <h3 className="text-2xl font-semibold text-foreground mb-2">Sélection de la squad</h3>
                <p className="text-muted-foreground">Tous les participants seront assignés à la même squad</p>
              </div>

              {/* Liste des participants */}
              <Card className="p-4 bg-muted/30">
                <h4 className="font-semibold mb-3 text-foreground">Participants sélectionnés :</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {participants.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">
                        {p.firstName} {p.lastName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {p.timeSlot?.name || "Pas de créneau"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <SquadSelector
                squads={squadsWithParticipants}
                selectedSquadId={selectedSquad}
                onSquadSelect={setSelectedSquad}
                participantType={participantType}
              />
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
                      <h4 className="text-xl font-bold text-primary">{selectedSquadData.name}</h4>
                      <Badge className="bg-primary">{selectedSquadData.type}</Badge>
                    </div>

                    {selectedSquadData.participants && selectedSquadData.participants.length > 0 && (
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-foreground mb-2">Membres actuels de la squad :</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSquadData.participants.map((p) => (
                            <Badge key={p.id} variant="outline" className="text-xs">
                              {p.firstName} {p.lastName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {participants[0]?.timeSlot && (
                      <div className="border-t border-primary/20 pt-4 mt-4">
                        <p className="text-sm font-semibold text-foreground mb-2">Créneau horaire :</p>
                        <p className="text-lg font-mono">
                          {format(new Date(participants[0].timeSlot.startTime), "HH:mm", { locale: fr })} -{" "}
                          {format(new Date(participants[0].timeSlot.endTime), "HH:mm", { locale: fr })}
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
                      <strong>Important :</strong> Les participants doivent connaître leur squad pour retrouver facilement leurs coéquipiers après le briefing.
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
                        Les participants doivent présenter leur <strong>badge numérique ou imprimé</strong> pour bénéficier de leur repas gratuit à la buvette.
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
                        <strong>Donnez une bouteille d'eau</strong> à chaque participant. Ils devront la remplir avant de partir en jeu aux jerricanes prévus à cet effet.
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
                        Les participants doivent présenter leur <strong>badge numérique ou imprimé</strong> au stand de maquillage pour se faire maquiller.
                      </p>
                    </div>

                    <div className="bg-background/80 p-4 rounded-md">
                      <p className="text-sm text-foreground mb-2">
                        <strong>Instructions :</strong>
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                        <li>Les participants doivent patienter leur tour pour le maquillage</li>
                        <li>Ils doivent être prêts pour le briefing à l'heure prévue</li>
                        <li>Une fois maquillés, ils peuvent rejoindre leur squad</li>
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
                          Si les participants souhaitent reconnaître le terrain avant le briefing, vous pouvez leur fournir une carte.
                        </p>
                        <div className="bg-background/80 p-3 rounded-md">
                          <p className="text-sm text-foreground">
                            <strong>Rappel important :</strong> Les participants doivent être présents pour le briefing à l'heure prévue.
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-border pt-4">
                        <h4 className="text-lg font-semibold text-foreground mb-3">Retour après la course</h4>
                        <p className="text-sm text-muted-foreground">
                          À la fin de la course, les participants doivent revenir au stand <strong>"Arrivée"</strong> pour confirmer leur retour.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Afficher les numéros de casier si disponibles */}
                {participants.some(p => p.lockerNumber) && (
                  <div className="p-6 rounded-lg bg-primary/10 border-2 border-primary/20">
                    <h4 className="text-lg font-semibold text-foreground mb-4">Numéros de casier</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {participants.filter(p => p.lockerNumber).map(p => (
                        <div key={p.id} className="text-center p-3 rounded-lg bg-background/50">
                          <p className="text-xs text-muted-foreground mb-1">{p.firstName} {p.lastName}</p>
                          <p className="text-2xl font-mono font-bold text-primary">{p.lockerNumber}</p>
                        </div>
                      ))}
                    </div>
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
              disabled={currentStep === 1 && !selectedSquad}
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
