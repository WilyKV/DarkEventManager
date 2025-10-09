import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, IdCard, LogIn, LogOut, Eye, Users, Search, Edit } from "lucide-react";
import { ParticipantWithRelations, TimeSlot } from "@shared/schema";
import { SimpleCheckInModal } from "./simple-check-in-modal";
import { BatchCheckInModal } from "./batch-check-in-modal";
import { ParticipantBadgeModal } from "./participant-badge-modal";
import { EditParticipantDialog } from "./edit-participant-dialog";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ParticipantListByTimeslotProps {
  participants: ParticipantWithRelations[];
  timeSlots: TimeSlot[];
  type: "zombie" | "survivant" | "staff";
  onUpdate: () => void;
  timeSlotLabel?: string; // Optional custom label for timeslot, e.g., "Attribution"
  allowEdit?: boolean; // Allow editing participants (default: true)
}

export function ParticipantListByTimeslot({
  participants,
  timeSlots,
  type,
  onUpdate,
  timeSlotLabel = "Créneau", // Default value
  allowEdit = true // Default: allow edit
}: ParticipantListByTimeslotProps) {
  const { toast } = useToast();
  const [openTimeslots, setOpenTimeslots] = useState<Set<number>>(new Set());
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithRelations | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<number>>(new Set());
  const [showBatchCheckIn, setShowBatchCheckIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [badgeParticipant, setBadgeParticipant] = useState<ParticipantWithRelations | null>(null);
  const [editParticipant, setEditParticipant] = useState<ParticipantWithRelations | null>(null);

  const batchExitMutation = useMutation({
    mutationFn: async (participantIds: number[]) => {
      return Promise.all(
        participantIds.map(id =>
          apiRequest("PATCH", `/api/participants/${id}`, { returned: true, returnedAt: new Date() })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/participants" });
      toast({ title: "Sortie enregistrée", description: `${selectedForBatch.size} participant(s) marqué(s) comme sorti(s)` });
      setSelectedForBatch(new Set());
      onUpdate();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la sortie", variant: "destructive" });
    },
  });

  const exitMutation = useMutation({
    mutationFn: async (participantId: number) => {
      return apiRequest("PATCH", `/api/participants/${participantId}`, { returned: true, returnedAt: new Date() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/participants" });
      toast({ title: "Sortie enregistrée", description: "Participant marqué comme sorti" });
      onUpdate();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'enregistrer la sortie", variant: "destructive" });
    },
  });

  const undoExitMutation = useMutation({
    mutationFn: async (participantId: number) => {
      return apiRequest("PATCH", `/api/participants/${participantId}`, { returned: false, returnedAt: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/participants" });
      toast({ title: "Sortie annulée", description: "Participant remis en état 'Arrivé'" });
      onUpdate();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'annuler la sortie", variant: "destructive" });
    },
  });

  const toggleTimeslot = (id: number) => {
    const newOpen = new Set(openTimeslots);
    if (newOpen.has(id)) {
      newOpen.delete(id);
    } else {
      newOpen.add(id);
    }
    setOpenTimeslots(newOpen);
  };

  const toggleSelectParticipant = (id: number) => {
    const newSelected = new Set(selectedForBatch);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedForBatch(newSelected);
  };

  // Filter participants by search query
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants;
    const query = searchQuery.toLowerCase();
    return participants.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(query)
    );
  }, [participants, searchQuery]);

  // Grouper les participants par créneau (triés par ordre croissant de briefingTime)
  const participantsByTimeslot = timeSlots
    .slice()
    .sort((a, b) => {
      // Compare briefingTime strings (format "HH:MM")
      return a.briefingTime.localeCompare(b.briefingTime);
    })
    .map(slot => {
      const slotParticipants = filteredParticipants.filter(p => p.timeSlotId === slot.id);
      return {
        slot,
        participants: slotParticipants,
        arrivedCount: slotParticipants.filter(p => p.arrived).length,
        totalCount: slotParticipants.length
      };
    }).filter(group => group.totalCount > 0);

  // Participants sans créneau
  const participantsWithoutSlot = filteredParticipants.filter(p => !p.timeSlotId);

  const formatTime = (date: Date | string) => {
    // Si c'est déjà au format "HH:MM", le retourner directement
    if (typeof date === 'string' && /^\d{1,2}:\d{2}$/.test(date)) {
      return date;
    }
    
    // Sinon essayer de le parser comme Date
    const d = new Date(date);
    // Vérifier si la date est valide
    if (isNaN(d.getTime())) {
      return "--:--";
    }
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusColor = (participant: ParticipantWithRelations) => {
    if (participant.returned) return "bg-muted text-muted-foreground";
    if (participant.arrived) return "bg-chart-1/20 text-chart-1 border-chart-1/30";
    return "bg-secondary text-secondary-foreground";
  };

  const getStatusText = (participant: ParticipantWithRelations) => {
    if (participant.returned) return "Sorti";
    if (participant.arrived) return "Arrivé";
    return "En attente";
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="text"
          placeholder="Rechercher un participant par nom..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Actions groupées */}
      {selectedForBatch.size > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/30">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedForBatch.size} participant{selectedForBatch.size > 1 ? 's' : ''} sélectionné{selectedForBatch.size > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={() => setShowBatchCheckIn(true)}>
                <LogIn className="w-4 h-4 mr-2" />
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => batchExitMutation.mutate(Array.from(selectedForBatch))}
                disabled={batchExitMutation.isPending}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Marquer sortie
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedForBatch(new Set())}>
                Annuler
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Liste par créneau */}
      {participantsByTimeslot.map(({ slot, participants: slotParticipants, arrivedCount, totalCount }) => (
        <Collapsible
          key={slot.id}
          open={openTimeslots.has(slot.id)}
          onOpenChange={() => toggleTimeslot(slot.id)}
        >
          <Card className="overflow-hidden">
            <CollapsibleTrigger className="w-full">
              <div className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {openTimeslots.has(slot.id) ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">{slot.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Briefing: {slot.briefingTime} • Jeu: {slot.gameTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="font-mono">
                      {arrivedCount}/{totalCount}
                    </Badge>
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t">
                {slotParticipants.map((participant) => (
                  <div
                    key={participant.id}
                    className="p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Checkbox et info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedForBatch.has(participant.id)}
                          onChange={() => toggleSelectParticipant(participant.id)}
                          className="w-4 h-4 rounded border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {participant.firstName} {participant.lastName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant="outline"
                              className={getStatusColor(participant)}
                            >
                              {getStatusText(participant)}
                            </Badge>
                            {participant.squad && (
                              <Badge variant="outline" className="text-xs">
                                Squad {participant.squad.number}
                              </Badge>
                            )}
                            {/* Masquer le code secret dans la section Zombie */}
                            {participant.secretCode && type !== "zombie" && (
                              <Badge variant="outline" className="text-xs font-mono">
                                Code {participant.secretCode}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          title="Badge"
                          onClick={() => setBadgeParticipant(participant)}
                        >
                          <IdCard className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant={participant.arrived ? "outline" : "default"}
                          onClick={() => setSelectedParticipant(participant)}
                          title="Enregistrement"
                          disabled={participant.returned}
                        >
                          <LogIn className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant={participant.returned ? "default" : "outline"}
                          onClick={() => {
                            if (participant.returned) {
                              undoExitMutation.mutate(participant.id);
                            } else {
                              exitMutation.mutate(participant.id);
                            }
                          }}
                          title={participant.returned ? "Annuler sortie" : "Sortie"}
                          disabled={!participant.arrived}
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>

                        {/* Edit button - only in admin */}
                        {allowEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Modifier"
                            onClick={() => setEditParticipant(participant)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}

      {/* Participants sans créneau */}
      {participantsWithoutSlot.length > 0 && (
        <Collapsible
          open={openTimeslots.has(-1)}
          onOpenChange={() => toggleTimeslot(-1)}
        >
          <Card className="overflow-hidden border-dashed">
            <CollapsibleTrigger className="w-full">
              <div className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {openTimeslots.has(-1) ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="text-left">
                      <h3 className="font-semibold text-lg">Sans créneau</h3>
                      <p className="text-sm text-muted-foreground">
                        Participants non assignés
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">
                    {participantsWithoutSlot.length}
                  </Badge>
                </div>
              </div>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="border-t">
                {participantsWithoutSlot.map((participant) => (
                  <div
                    key={participant.id}
                    className="p-4 border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedForBatch.has(participant.id)}
                          onChange={() => toggleSelectParticipant(participant.id)}
                          className="w-4 h-4 rounded border-border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {participant.firstName} {participant.lastName}
                          </p>
                          <Badge
                            variant="outline"
                            className={getStatusColor(participant)}
                          >
                            {getStatusText(participant)}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          title="Badge"
                          onClick={() => setBadgeParticipant(participant)}
                        >
                          <IdCard className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant={participant.arrived ? "outline" : "default"}
                          onClick={() => setSelectedParticipant(participant)}
                          title="Enregistrement"
                        >
                          <LogIn className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          title="Sortie"
                          disabled={!participant.arrived}
                        >
                          <LogOut className="w-4 h-4" />
                        </Button>

                        {/* Edit button - only in admin */}
                        {allowEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Modifier"
                            onClick={() => setEditParticipant(participant)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Modal d'enregistrement */}
      {selectedParticipant && (
        <SimpleCheckInModal
          participant={selectedParticipant}
          onClose={() => setSelectedParticipant(null)}
          onSuccess={() => {
            setSelectedParticipant(null);
            onUpdate();
          }}
        />
      )}

      {/* Modal d'enregistrement groupé */}
      {showBatchCheckIn && selectedForBatch.size > 0 && (
        <BatchCheckInModal
          participants={participants.filter(p => selectedForBatch.has(p.id))}
          onClose={() => setShowBatchCheckIn(false)}
          onSuccess={() => {
            setShowBatchCheckIn(false);
            setSelectedForBatch(new Set());
            onUpdate();
          }}
        />
      )}

      {/* Badge Modal */}
      {badgeParticipant && (
        <ParticipantBadgeModal
          participant={badgeParticipant}
          onClose={() => setBadgeParticipant(null)}
        />
      )}

      {/* Edit Modal */}
      {editParticipant && (
        <EditParticipantDialog
          participant={editParticipant}
          onClose={() => setEditParticipant(null)}
          onSuccess={() => {
            setEditParticipant(null);
            onUpdate();
          }}
        />
      )}
    </div>
  );
}
