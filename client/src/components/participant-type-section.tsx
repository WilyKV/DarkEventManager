import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizePlayerName } from "@shared/zombie-offline";
import { formatEventDay } from "@shared/event-day";
import { liveQueryPrefixes, matchesQueryPrefix } from "@shared/live-updates";
import { useEventDay } from "@/hooks/use-event-day";
import { apiRequest } from "@/lib/queryClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCog, Pencil, Trash2 } from "lucide-react";
import { AddParticipantDialog } from "@/components/add-participant-dialog";
import { EditParticipantDialog } from "@/components/edit-participant-dialog";
import { ExcelImport } from "@/components/excel-import";
import { ExcelExport } from "@/components/excel-export";
import { ParticipantList } from "@/components/participant-list";
import { ParticipantListByTimeslot } from "@/components/participant-list-by-timeslot";
import { SquadList } from "@/components/squad-list";
import { AddTimeSlotDialog } from "@/components/add-timeslot-dialog";
import { EditTimeSlotDialog } from "@/components/edit-timeslot-dialog";
import { AddSquadDialog } from "@/components/add-squad-dialog";
import { EditSquadDialog } from "@/components/edit-squad-dialog";
import { ParticipantWithRelations, TimeSlot, Squad } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ParticipantTypeSectionProps {
  type: "zombie" | "survivant" | "staff";
  color: string;
  title: string;
  participants: ParticipantWithRelations[];
  timeSlots: TimeSlot[];
  squads: Squad[];
  onDeleteTimeSlot: (id: number) => void;
  onDeleteSquad: (id: number) => void;
}

export function ParticipantTypeSection({
  type,
  color,
  title,
  participants,
  timeSlots,
  squads,
  onDeleteTimeSlot,
  onDeleteSquad,
}: ParticipantTypeSectionProps) {
  const [activeSubTab, setActiveSubTab] = useState("participants");
  const [participantSearch, setParticipantSearch] = useState("");
  const [deletingParticipant, setDeletingParticipant] = useState<ParticipantWithRelations | null>(null);
  const { data: event } = useEventDay();
  const queryClient = useQueryClient();
  const deleteParticipant = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/participants/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => typeof key === "string" &&
          liveQueryPrefixes.roster.some(prefix => matchesQueryPrefix(key, prefix)),
      });
      setDeletingParticipant(null);
    },
  });
  const searchWords = normalizePlayerName(participantSearch).trim().split(/\s+/).filter(Boolean);
  const visibleParticipants = participants.filter(player => {
    const name = normalizePlayerName(`${player.firstName} ${player.lastName}`);
    return searchWords.every(word => name.includes(word));
  }).sort((a, b) => a.firstName.localeCompare(b.firstName, "fr") || a.lastName.localeCompare(b.lastName, "fr"));
  const [editingParticipant, setEditingParticipant] = useState<ParticipantWithRelations | null>(null);
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
  const [deletingTimeSlotId, setDeletingTimeSlotId] = useState<number | null>(null);
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
  const [deletingSquadId, setDeletingSquadId] = useState<number | null>(null);

  return (
    <>
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="grid h-auto w-full grid-cols-4 bg-muted/30 sm:inline-flex sm:w-auto">
          <TabsTrigger value="participants" className="min-h-11 px-1 text-xs sm:px-3 sm:text-sm">Participants</TabsTrigger>
          <TabsTrigger value="creneaux" className="min-h-11 px-1 text-xs sm:px-3 sm:text-sm">Créneaux</TabsTrigger>
          <TabsTrigger value="squads" className="min-h-11 px-1 text-xs sm:px-3 sm:text-sm">Squads</TabsTrigger>
          <TabsTrigger value="tout" className="min-h-11 px-1 text-xs sm:px-3 sm:text-sm">Tout</TabsTrigger>
        </TabsList>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className={`text-lg font-semibold text-${color}-500`}>{title}</h3>
              <p className="text-sm text-muted-foreground">{participants.length} participant(s)</p>
            </div>
            <div className="flex gap-2">
              <AddParticipantDialog participantType={type} />
            </div>
          </div>

          {/* Import/Export Excel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Import/Export Excel</CardTitle>
              <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
            </CardHeader>
            <CardContent>
              <ExcelImport type={type} module="participants" />
            </CardContent>
            <CardContent>
              <ExcelExport type={type} module="participants" />
            </CardContent>
          </Card>

          {/* Liste des participants */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Liste des participants</CardTitle>
              <CardDescription>{participants.length} participant(s) enregistré(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {participants.length > 0 && <Input type="search" aria-label="Rechercher un participant" placeholder="Prénom ou nom"
                value={participantSearch} onChange={event => setParticipantSearch(event.target.value)} className="mb-3 min-h-11" />}
              {visibleParticipants.length === 0 ? (
                <p role="status" className="text-sm text-muted-foreground text-center py-8">
                  {participants.length ? "Aucun résultat." : "Aucun participant enregistré."}
                </p>
              ) : (
                <div className="space-y-2">
                  {visibleParticipants.map((participant) => (
                    <Card key={participant.id} className={`border-${color}-500/20`}>
                      <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2 sm:p-4">
                        <div className="min-w-0 flex-1 basis-full sm:basis-36">
                          <p className="break-words font-semibold text-sm">{participant.firstName} {participant.lastName}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {participant.email && (
                              <p className="break-all text-xs text-muted-foreground">{participant.email}</p>
                            )}
                            {participant.timeSlot && (
                              <span className="text-xs text-muted-foreground">• Créneau: {participant.timeSlot.name}</span>
                            )}
                            {participant.squad && (
                              <span className={`text-xs text-${color}-500`}>• Squad {participant.squad.number}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const url = `/badges?participantId=${participant.id}`;
                              window.open(url, '_blank');
                            }}
                            aria-label={`Voir le badge de ${participant.firstName} ${participant.lastName}`}
                          >
                            <UserCog className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Modifier ${participant.firstName} ${participant.lastName}`}
                            onClick={() => setEditingParticipant(participant)}
                          >
                            <Pencil className="w-4 h-4" aria-hidden />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive"
                            aria-label={`Supprimer ${participant.firstName} ${participant.lastName}`}
                            onClick={() => { deleteParticipant.reset(); setDeletingParticipant(participant); }}>
                            <Trash2 aria-hidden />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Créneaux Tab */}
        <TabsContent value="creneaux" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className={`text-lg font-semibold text-${color}-500`}>Créneaux {title}</h3>
              <p className="text-sm text-muted-foreground">
                {event?.eventDay ? <time dateTime={event.eventDay} className="capitalize">{formatEventDay(event.eventDay)}</time>
                  : "Date à définir dans Configuration"}
              </p>
            </div>
            <AddTimeSlotDialog type={type} />
          </div>

          {/* Import/Export Excel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Import/Export Excel</CardTitle>
              <CardDescription>Importez ou exportez les créneaux via Excel</CardDescription>
            </CardHeader>
            <CardContent>
              <ExcelImport type={type} module="time-slots" />
            </CardContent>
            <CardContent>
              <ExcelExport type={type} module="time-slots" />
            </CardContent>
          </Card>

          {/* Liste des créneaux */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Liste des créneaux</CardTitle>
              <CardDescription>{timeSlots.length} créneau(x) configuré(s)</CardDescription>
            </CardHeader>
            <CardContent>
              {timeSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun créneau configuré</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {timeSlots.map((slot) => (
                    <Card key={slot.id} className={`border-${color}-500/20`}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="break-words font-semibold text-sm">{slot.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Jeu: {slot.gameTime} — Sortie: {slot.exitTime}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Repas: {slot.mealTime}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Modifier le créneau ${slot.name}`}
                              onClick={() => setEditingTimeSlot(slot)}
                            >
                              <Pencil className="size-4" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                              aria-label={`Supprimer le créneau ${slot.name}`}
                              onClick={() => setDeletingTimeSlotId(slot.id)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Squads Tab */}
        <TabsContent value="squads" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-semibold text-${color}-500`}>Squads {title}</h3>
              <p className="text-sm text-muted-foreground">{squads.length} squad(s)</p>
            </div>
            {type !== "staff" && <AddSquadDialog type={type} />}
          </div>

          {type !== "staff" && <SquadList type={type} showActions />}
        </TabsContent>

        {/* Tout Tab */}
        <TabsContent value="tout" className="space-y-4 mt-4">
          <h3 className={`text-lg font-semibold text-${color}-500`}>Vue d'ensemble {title}</h3>

          {type !== "staff" && (
            <ParticipantList
              participants={participants}
              timeSlots={timeSlots}
              squads={squads}
              type={type}
              onUpdate={() => undefined}
            />
          )}
          <ParticipantListByTimeslot
            participants={participants}
            timeSlots={timeSlots}
            type={type}
            onUpdate={() => undefined}
          />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AlertDialog open={deletingParticipant !== null} onOpenChange={open => {
        if (!open && !deleteParticipant.isPending) setDeletingParticipant(null);
      }}>
        <AlertDialogContent className="w-[calc(100%-1.25rem)] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {deletingParticipant?.firstName} {deletingParticipant?.lastName} ?</AlertDialogTitle>
            <AlertDialogDescription>La fiche sera retirée des listes d’accueil. L’historique des achats sera conservé.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteParticipant.isError && <p role="alert" className="text-sm text-destructive">Impossible de supprimer cette fiche. Réessayez.</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteParticipant.isPending}>Annuler</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deleteParticipant.isPending}
              onClick={() => { if (deletingParticipant) deleteParticipant.mutate(deletingParticipant.id); }}>
              {deleteParticipant.isPending ? "Suppression…" : "Supprimer le participant"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editingParticipant && (
        <EditParticipantDialog
          participant={editingParticipant}
          onClose={() => setEditingParticipant(null)}
          onSuccess={() => setEditingParticipant(null)}
        />
      )}

      {editingTimeSlot && (
        <EditTimeSlotDialog
          timeSlot={editingTimeSlot}
          open={!!editingTimeSlot}
          onOpenChange={(open) => !open && setEditingTimeSlot(null)}
        />
      )}

      <AlertDialog open={deletingTimeSlotId !== null} onOpenChange={(open) => !open && setDeletingTimeSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce créneau ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingTimeSlotId) {
                  onDeleteTimeSlot(deletingTimeSlotId);
                  setDeletingTimeSlotId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingSquad && (
        <EditSquadDialog
          squad={editingSquad}
          open={!!editingSquad}
          onOpenChange={(open) => !open && setEditingSquad(null)}
        />
      )}

      <AlertDialog open={deletingSquadId !== null} onOpenChange={(open) => !open && setDeletingSquadId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce squad ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingSquadId) {
                  onDeleteSquad(deletingSquadId);
                  setDeletingSquadId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
