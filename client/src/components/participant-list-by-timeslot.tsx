import { AdminSouvenirLink } from "./admin-souvenir-link";
import { useAuth } from "@/lib/auth";
import { ArrivalTime, ArrivalTimeOption } from "./arrival-time";
import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, IdCard, LogIn, LogOut, Search, Edit } from "lucide-react";
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
  const { hasAnyRole } = useAuth();
  const canPreviewSouvenir = hasAnyRole(["admin"]);
  const { toast } = useToast();
  const [openTimeslots, setOpenTimeslots] = useState<Set<number>>(new Set());
  const [selectedParticipant, setSelectedParticipant] = useState<ParticipantWithRelations | null>(null);
  const [selectedForBatch, setSelectedForBatch] = useState<Set<number>>(new Set());
  const [showBatchCheckIn, setShowBatchCheckIn] = useState(false);
  const [showArrivalTimes, setShowArrivalTimes] = useState(false);
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

  const isSearching = searchQuery.trim().length > 0;
  const filteredParticipants = useMemo(() => {
    const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
    const words = normalize(searchQuery).trim().split(/\s+/).filter(Boolean);
    if (!words.length) return participants;
    return participants.filter(({ firstName, lastName }) => {
      const name = normalize(`${firstName} ${lastName}`);
      return words.every(word => name.includes(word));
    });
  }, [participants, searchQuery]);

  const knownSlotIds = new Set(timeSlots.map(slot => slot.id));
  const groups = timeSlots.slice()
    .sort((a, b) => a.briefingTime.localeCompare(b.briefingTime))
    .map(slot => ({
      id: slot.id,
      name: slot.name,
      details: `Briefing ${slot.briefingTime} · Jeu ${slot.gameTime}`,
      members: filteredParticipants.filter(p => p.timeSlotId === slot.id),
    }));
  groups.push({
    id: -1,
    name: "Sans créneau",
    details: "",
    members: filteredParticipants.filter(p => p.timeSlotId == null || !knownSlotIds.has(p.timeSlotId)),
  });

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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          type="search"
          aria-label="Rechercher un participant"
          placeholder="Prénom ou nom"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="min-h-11 pl-10"
        />
      </div>

      <ArrivalTimeOption checked={showArrivalTimes} onChange={setShowArrivalTimes} />

      {/* Actions groupées */}
      {selectedForBatch.size > 0 && (
        <Card className="p-4 bg-primary/5 border-primary/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-medium">
              {selectedForBatch.size} participant{selectedForBatch.size > 1 ? 's' : ''} sélectionné{selectedForBatch.size > 1 ? 's' : ''}
            </span>
            <div className="flex flex-wrap gap-2">
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

      {filteredParticipants.length === 0 && (
        <p role="status" className="rounded-xl border border-border px-4 py-6 text-sm text-muted-foreground">
          {isSearching ? "Aucun participant ne correspond à cette recherche." : "Aucun participant inscrit."}
        </p>
      )}
      {groups.filter(group => group.members.length > 0).map(({ id, name, details, members }) => {
        const expanded = isSearching || openTimeslots.has(id);
        return (
          <Collapsible key={id} open={expanded} onOpenChange={() => toggleTimeslot(id)}>
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <CollapsibleTrigger disabled={isSearching} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 disabled:hover:bg-transparent">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{name}</span>
                  {details && <span className="block text-xs text-muted-foreground sm:text-sm">{details}</span>}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {members.filter(p => p.arrived).length}/{members.length} arrivés
                </span>
                {!isSearching && (
                  <ChevronDown className={`size-4 shrink-0 text-muted-foreground ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ul className="divide-y divide-border border-t border-border">
                  {members.map(participant => {
                    const fullName = `${participant.firstName} ${participant.lastName}`;
                    const checkInLabel = participant.arrived ? "Revoir l’accueil" : "Accueillir";
                    const exitLabel = participant.returned ? "Annuler la sortie" : "Marquer la sortie";
                    return (
                      <li key={participant.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4">
                        <label className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-44">
                          <span className="grid size-9 shrink-0 place-items-center">
                            <input
                              type="checkbox"
                              aria-label={`Sélectionner ${fullName}`}
                              checked={selectedForBatch.has(participant.id)}
                              onChange={() => toggleSelectParticipant(participant.id)}
                              className="size-4 rounded border-border accent-primary"
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block break-words text-sm font-semibold sm:text-base">{fullName}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={getStatusColor(participant)}>{getStatusText(participant)}</Badge>
                              {showArrivalTimes && (participant.arrived || participant.arrivedAt) && <ArrivalTime value={participant.arrivedAt} />}
                              {participant.squad && <span className="text-xs text-muted-foreground">Équipe {participant.squad.number}</span>}
                              {participant.secretCode && type !== "zombie" && (
                                <Badge variant="outline" className="font-mono text-xs">Code {participant.secretCode}</Badge>
                              )}
                            </span>
                          </span>
                        </label>
                        <div className="ml-11 flex flex-wrap items-center gap-1.5 sm:ml-0">
                          <Button size="sm" className="min-h-11" variant={participant.arrived ? "outline" : "default"}
                            onClick={() => setSelectedParticipant(participant)} disabled={participant.returned ?? false}
                            aria-label={`${checkInLabel} — ${fullName}`}>
                            <LogIn aria-hidden="true" /> {checkInLabel}
                          </Button>
                          <Button size="icon" variant="ghost" title="Voir le badge" aria-label={`Voir le badge — ${fullName}`}
                            onClick={() => setBadgeParticipant(participant)}>
                            <IdCard aria-hidden="true" />
                          </Button>
                          <Button size="icon" variant="ghost" title={exitLabel} aria-label={`${exitLabel} — ${fullName}`}
                            disabled={!participant.arrived || exitMutation.isPending || undoExitMutation.isPending}
                            onClick={() => (participant.returned ? undoExitMutation : exitMutation).mutate(participant.id)}>
                            <LogOut aria-hidden="true" />
                          </Button>
                          {canPreviewSouvenir && <AdminSouvenirLink id={participant.id} name={fullName} />}
                          {allowEdit && (
                            <Button size="icon" variant="ghost" title="Modifier" aria-label={`Modifier — ${fullName}`}
                              onClick={() => setEditParticipant(participant)}>
                              <Edit aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      })}

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
