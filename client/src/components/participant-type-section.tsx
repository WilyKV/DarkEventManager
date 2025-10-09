import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [editingParticipant, setEditingParticipant] = useState<ParticipantWithRelations | null>(null);
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
  const [deletingTimeSlotId, setDeletingTimeSlotId] = useState<number | null>(null);
  const [editingSquad, setEditingSquad] = useState<Squad | null>(null);
  const [deletingSquadId, setDeletingSquadId] = useState<number | null>(null);

  return (
    <>
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList className="bg-muted/30">
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="creneaux">Créneaux</TabsTrigger>
          <TabsTrigger value="squads">Squads</TabsTrigger>
          <TabsTrigger value="tout">Tout</TabsTrigger>
        </TabsList>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
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
              {participants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucun participant enregistré</p>
              ) : (
                <div className="space-y-2">
                  {participants.map((participant) => (
                    <Card key={participant.id} className={`border-${color}-500/20`}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm">{participant.firstName} {participant.lastName}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {participant.email && (
                              <p className="text-xs text-muted-foreground">{participant.email}</p>
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
                            className="h-8 w-8"
                            onClick={() => {
                              const url = `/badges?participantId=${participant.id}`;
                              window.open(url, '_blank');
                            }}
                            title="Voir le badge"
                          >
                            <UserCog className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingParticipant(participant)}
                          >
                            <Pencil className="w-4 h-4" />
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
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-semibold text-${color}-500`}>Créneaux {title}</h3>
              <p className="text-sm text-muted-foreground">{timeSlots.length} créneau(x)</p>
            </div>
            <AddTimeSlotDialog participantType={type} />
          </div>

          {/* Import/Export Excel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Import/Export Excel</CardTitle>
              <CardDescription>Importez ou exportez les créneaux via Excel</CardDescription>
            </CardHeader>
            <CardContent>
              <ExcelImport type={type} module="timeslots" />
            </CardContent>
            <CardContent>
              <ExcelExport type={type} module="timeslots" />
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
                          <div className="flex-1">
                            <p className="font-semibold text-sm">{slot.name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {slot.startTime} - {slot.endTime}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Capacité: {slot.maxCapacity}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditingTimeSlot(slot)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => setDeletingTimeSlotId(slot.id)}
                            >
                              <Trash2 className="w-3 h-3" />
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
            <AddSquadDialog participantType={type} />
          </div>

          <SquadList
            squads={squads}
            onEditSquad={setEditingSquad}
            onDeleteSquad={setDeletingSquadId}
          />
        </TabsContent>

        {/* Tout Tab */}
        <TabsContent value="tout" className="space-y-4 mt-4">
          <h3 className={`text-lg font-semibold text-${color}-500`}>Vue d'ensemble {title}</h3>

          <ParticipantList participants={participants} />
          <ParticipantListByTimeslot participants={participants} />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      {editingParticipant && (
        <EditParticipantDialog
          participant={editingParticipant}
          open={!!editingParticipant}
          onOpenChange={(open) => !open && setEditingParticipant(null)}
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
