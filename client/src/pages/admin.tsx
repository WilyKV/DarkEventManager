import { useState } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Users, Clock, UserCog, Shield, Pencil, Trash2, Database, Settings, ShoppingBag, Utensils, History } from "lucide-react";
import { AddParticipantDialog } from "@/components/add-participant-dialog";
import { AddTimeSlotDialog } from "@/components/add-timeslot-dialog";
import { EditTimeSlotDialog } from "@/components/edit-timeslot-dialog";
import { AddSquadDialog } from "@/components/add-squad-dialog";
import { SquadList } from "@/components/squad-list";
import { ExcelImport } from "@/components/excel-import";
import { ExcelExport } from "@/components/excel-export.tsx";
import { ResetDataSection } from "@/components/reset-data-section";
import { EndEventButton } from "@/components/end-event-button";
import { DiscountManagement } from "@/components/discount-management";
import { MealDiscountManagement } from "@/components/meal-discount-management";
import { ProductManagement } from "@/components/product-management";
import { MealProductManagement } from "@/components/meal-product-management";
import { TestDataGenerator } from "@/components/test-data-generator";
import { SyncModeManager } from "@/components/sync-mode-manager";
import { SyncPushPullButtons } from "@/components/sync-push-pull-buttons";
import { UserManagement } from "@/components/user-management";
import { AuditLogViewer } from "@/components/audit-log-viewer";
import { ParticipantTypeSection } from "@/components/participant-type-section";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ParticipantWithRelations, TimeSlot, Squad, SquadWithRelations } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("zombie");
  const [activeSubTab, setActiveSubTab] = useState<Record<string, string>>({
    zombie: "participants",
    survivant: "participants",
    staff: "participants",
    boutique: "items",
    repas: "items",
    config: "sync",
    users: "list"
  });
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showAddTimeslot, setShowAddTimeslot] = useState(false);
  const [showAddSquad, setShowAddSquad] = useState(false);
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
  const [deletingTimeSlotId, setDeletingTimeSlotId] = useState<number | null>(null);

  const { data: zombieParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: zombieTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: zombieSquads = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/squads/with-participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantSquads = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/squads/with-participants?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: staffParticipants = [] } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=staff");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: staffTimeSlots = [] } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=staff");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: staffSquads = [] } = useQuery<SquadWithRelations[]>({
    queryKey: ["/api/squads/with-participants", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/squads/with-participants?type=staff");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const deleteTimeSlotMutation = useMutation({
    mutationFn: async (timeSlotId: number) => {
      return await apiRequest("DELETE", `/api/time-slots/${timeSlotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/time-slots");
        }
      });
      toast({
        title: "Créneau supprimé",
        description: "Le créneau horaire a été supprimé avec succès.",
      });
      setDeletingTimeSlotId(null);
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce créneau. Il est peut-être utilisé par des participants.",
        variant: "destructive",
      });
      console.error("Error deleting time slot:", error);
    },
  });

  const deleteSquadMutation = useMutation({
    mutationFn: async (squadId: number) => {
      return await apiRequest("DELETE", `/api/squads/${squadId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.startsWith("/api/squads");
        }
      });
      toast({
        title: "Squad supprimé",
        description: "Le squad a été supprimé avec succès.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce squad.",
        variant: "destructive",
      });
      console.error("Error deleting squad:", error);
    },
  });

  const handleExport = async (type: string, module: string) => {
    try {
      const url = `/api/data/export/${module}?type=${type}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = response.headers.get("content-disposition")?.split("filename=")[1]?.replace(/"/g, "") || `${module}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      toast({ title: "Export réussi", description: `Les données ont été exportées.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'exporter les données.", variant: "destructive" });
    }
  };

  // Composant pour afficher les créneaux horaires
  const TimeSlotsDisplay = ({ slots, type, colorClass }: { slots: TimeSlot[], type: string, colorClass: string }) => (
    <>
      {slots && slots.length > 0 && (
        <Card>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map((slot) => (
                <Card key={slot.id} className={`border-${type === 'zombie' ? 'red' : type === 'survivant' ? 'blue' : 'green'}-500/20`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{slot.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Briefing: {slot.briefingTime}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Jeu: {slot.gameTime}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setEditingTimeSlot(slot)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeletingTimeSlotId(slot.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );

  return (
    <ManagementLayout
      title="Administration"
      subtitle="Gestion complète de l'événement"
      showScanButton={true}
      scanLink="/scan"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* Menu principal */}
        <TabsList className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-1 bg-muted/50 border border-border/50 p-1">
          <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-purple-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/20">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Config</span>
          </TabsTrigger>
          <TabsTrigger value="zombie" className="gap-2 data-[state=active]:bg-red-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/20">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Zombies</span>
          </TabsTrigger>
          <TabsTrigger value="survivant" className="gap-2 data-[state=active]:bg-blue-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Survivants</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2 data-[state=active]:bg-green-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20">
            <UserCog className="w-4 h-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="boutique" className="gap-2 data-[state=active]:bg-indigo-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-500/20">
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">Boutique</span>
          </TabsTrigger>
          <TabsTrigger value="repas" className="gap-2 data-[state=active]:bg-orange-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/20">
            <Utensils className="w-4 h-4" />
            <span className="hidden sm:inline">Repas</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 data-[state=active]:bg-pink-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-pink-500/20">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Utilisateurs</span>
          </TabsTrigger>
          <TabsTrigger value="historique" className="gap-2 data-[state=active]:bg-yellow-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-yellow-500/20">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historique</span>
          </TabsTrigger>
        </TabsList>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <h3 className="text-lg font-semibold text-purple-500">Configuration de l'événement</h3>

          {/* Sync Push/Pull Buttons */}
          <SyncPushPullButtons />

          {/* Sync Mode Manager */}
          <SyncModeManager />

          {/* End Event Button */}
          <EndEventButton />

          {/* Reset All Data Section */}
          <ResetDataSection
            title="Réinitialisation globale"
            description="Réinitialiser toutes les données de l'événement (ATTENTION : irréversible)"
            options={[
              { label: "Reset TOUTES les données", module: "all", description: "Supprime absolument tout" },
            ]}
          />
        </TabsContent>

        {/* Zombie Tab */}
        <TabsContent value="zombie" className="space-y-4">
          <h3 className="text-lg font-semibold text-red-500">Gestion Zombies</h3>
          <ParticipantTypeSection
            type="zombie"
            color="red"
            title="Participants Zombies"
            participants={zombieParticipants}
            timeSlots={zombieTimeSlots}
            squads={zombieSquads}
            onDeleteTimeSlot={(id) => deleteTimeSlotMutation.mutate(id)}
            onDeleteSquad={(id) => deleteSquadMutation.mutate(id)}
          />
        </TabsContent>

        {/* Survivant Tab */}
        <TabsContent value="survivant" className="space-y-4">
          <h3 className="text-lg font-semibold text-blue-500">Gestion Survivants</h3>
          <ParticipantTypeSection
            type="survivant"
            color="blue"
            title="Participants Survivants"
            participants={survivantParticipants}
            timeSlots={survivantTimeSlots}
            squads={survivantSquads}
            onDeleteTimeSlot={(id) => deleteTimeSlotMutation.mutate(id)}
            onDeleteSquad={(id) => deleteSquadMutation.mutate(id)}
          />
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          <h3 className="text-lg font-semibold text-green-500">Gestion Staff</h3>
          <ParticipantTypeSection
            type="staff"
            color="green"
            title="Participants Staff"
            participants={staffParticipants}
            timeSlots={staffTimeSlots}
            squads={staffSquads}
            onDeleteTimeSlot={(id) => deleteTimeSlotMutation.mutate(id)}
            onDeleteSquad={(id) => deleteSquadMutation.mutate(id)}
          />
        </TabsContent>

        {/* Boutique Tab */}
        <TabsContent value="boutique" className="space-y-4">
          <h3 className="text-lg font-semibold text-indigo-500">Gestion Boutique</h3>

          {/* Sous-menu Boutique */}
          <Tabs value={activeSubTab.boutique} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, boutique: value })}>
            <TabsList className="bg-muted/30">
              <TabsTrigger value="items">Produits</TabsTrigger>
              <TabsTrigger value="discounts">Réductions</TabsTrigger>
            </TabsList>

            {/* Produits */}
            <TabsContent value="items" className="space-y-4 mt-4">
              {/* Manual Product Management */}
              <ProductManagement />
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-500">Participants Zombies</h3>
                  <p className="text-sm text-muted-foreground">{zombieParticipants.length} participant(s)</p>
                </div>
                <div className="flex gap-2">
                  <AddParticipantDialog
                    participantType="zombie"
                  />
                </div>
              </div>

              {/* Import/Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="zombie" module="participants"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="zombie" module="participants"  />
                </CardContent>
              </Card>

              {/* Liste des participants */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Liste des participants</CardTitle>
                  <CardDescription>{zombieParticipants.length} participant(s) enregistré(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  {zombieParticipants.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucun participant enregistré</p>
                  ) : (
                    <div className="space-y-2">
                      {zombieParticipants.map((participant) => (
                        <Card key={participant.id} className="border-red-500/20">
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
                                  <span className="text-xs text-red-500">• Squad {participant.squad.number}</span>
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
                                onClick={() => {
                                  // TODO: Implement edit participant
                                  toast({
                                    title: "Fonctionnalité à venir",
                                    description: "L'édition de participant sera bientôt disponible",
                                  });
                                }}
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Êtes-vous sûr de vouloir supprimer ${participant.firstName} ${participant.lastName} ?`)) {
                                    apiRequest("DELETE", `/api/participants/${participant.id}`)
                                      .then(() => {
                                        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/participants" });
                                        toast({
                                          title: "Participant supprimé",
                                          description: "Le participant a été supprimé avec succès",
                                        });
                                      })
                                      .catch(() => {
                                        toast({
                                          title: "Erreur",
                                          description: "Impossible de supprimer le participant",
                                          variant: "destructive",
                                        });
                                      });
                                  }
                                }}
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Créneaux Zombies */}
            <TabsContent value="creneaux" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-500">Créneaux Horaires Zombies</h3>
                  <p className="text-sm text-muted-foreground">{zombieTimeSlots.length} créneau(x)</p>
                </div>
                <div className="flex gap-2">
                  <AddTimeSlotDialog type="zombie" />
                </div>
              </div>

              {/* Import/Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="zombie" module="time-slots"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="zombie" module="time-slots"  />
                </CardContent>
              </Card>

              {/* Liste des créneaux */}
              <TimeSlotsDisplay slots={zombieTimeSlots} type="zombie" colorClass="text-red-500" />
            </TabsContent>

            {/* Squads Zombies */}
            <TabsContent value="squads" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-red-500">Squads Zombies</h3>
                  <p className="text-sm text-muted-foreground">{zombieSquads.length} squad(s)</p>
                </div>
                <div className="flex gap-2">
                  <AddSquadDialog type="zombie" />
                </div>
              </div>

              {/* Import/Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="zombie" module="squads"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="zombie" module="squads"  />
                </CardContent>
              </Card>

              {/* Liste des squads */}
              <SquadList type="zombie" showActions={true} />
            </TabsContent>

            {/* Tout (Vue d'ensemble Zombies) */}
            <TabsContent value="tout" className="space-y-4 mt-4">
              <h3 className="text-lg font-semibold text-red-500">Vue d'ensemble Zombies</h3>

              {/* Statistiques */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-red-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
                    <div className="text-2xl font-bold text-red-500">{zombieParticipants.length}</div>
                  </CardHeader>
                </Card>
                <Card className="border-red-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Créneaux</CardTitle>
                    <div className="text-2xl font-bold text-red-500">{zombieTimeSlots.length}</div>
                  </CardHeader>
                </Card>
                <Card className="border-red-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Squads</CardTitle>
                    <div className="text-2xl font-bold text-red-500">{zombieSquads.length}</div>
                  </CardHeader>
                </Card>
              </div>

              {/* Import Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="zombie" module="all"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="zombie" module="all"  />
                </CardContent>
              </Card>

              {/* Reset Section */}
              <ResetDataSection
                title="Réinitialisation Zombies"
                description="Supprimer les données des zombies"
                options={[
                  { label: "Reset Participants Zombies", module: "participants", type: "zombie" },
                  { label: "Reset Créneaux Zombies", module: "timeslots", type: "zombie" },
                  { label: "Reset Squads Zombies", module: "squads", type: "zombie" },
                  { label: "Reset TOUT (Zombies)", module: "all", type: "zombie" },
                ]}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Survivant Tab */}
        <TabsContent value="survivant" className="space-y-4">
          {/* Sous-menu Survivant */}
          <Tabs value={activeSubTab.survivant} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, survivant: value })}>
            <TabsList className="bg-muted/30">
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="creneaux">Créneaux</TabsTrigger>
              <TabsTrigger value="squads">Squads</TabsTrigger>
              <TabsTrigger value="tout">Tout</TabsTrigger>
            </TabsList>

            {/* Participants Survivants */}
            <TabsContent value="participants" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-500">Participants Survivants</h3>
                  <p className="text-sm text-muted-foreground">{survivantParticipants.length} participant(s)</p>
                </div>
                <div className="flex gap-2">
                  <AddParticipantDialog participantType="survivant" />
                </div>
              </div>

              {/* Import/Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="survivant" module="participants"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="survivant" module="participants"  />
                </CardContent>
              </Card>

              {/* Liste des participants */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Liste des participants</CardTitle>
                  <CardDescription>{survivantParticipants.length} participant(s) enregistré(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  {survivantParticipants.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucun participant enregistré</p>
                  ) : (
                    <div className="space-y-2">
                      {survivantParticipants.map((participant) => (
                        <Card key={participant.id} className="border-blue-500/20">
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
                                  <span className="text-xs text-blue-500">• Squad {participant.squad.number}</span>
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
                                onClick={() => {
                                  toast({
                                    title: "Fonctionnalité à venir",
                                    description: "L'édition de participant sera bientôt disponible",
                                  });
                                }}
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Êtes-vous sûr de vouloir supprimer ${participant.firstName} ${participant.lastName} ?`)) {
                                    apiRequest("DELETE", `/api/participants/${participant.id}`)
                                      .then(() => {
                                        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/participants" });
                                        toast({
                                          title: "Participant supprimé",
                                          description: "Le participant a été supprimé avec succès",
                                        });
                                      })
                                      .catch(() => {
                                        toast({
                                          title: "Erreur",
                                          description: "Impossible de supprimer le participant",
                                          variant: "destructive",
                                        });
                                      });
                                  }
                                }}
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Créneaux Survivants */}
            <TabsContent value="creneaux" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-500">Créneaux Horaires Survivants</h3>
                  <p className="text-sm text-muted-foreground">{survivantTimeSlots.length} créneau(x)</p>
                </div>
                <div className="flex gap-2">
                  <AddTimeSlotDialog type="survivant" />
                </div>
              </div>

              {/* Import/Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="survivant" module="time-slots"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="survivant" module="time-slots"  />
                </CardContent>
              </Card>

              {/* Liste des créneaux */}
              <TimeSlotsDisplay slots={survivantTimeSlots} type="survivant" colorClass="text-blue-500" />
            </TabsContent>

            {/* Squads Survivants */}
            <TabsContent value="squads" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-blue-500">Squads Survivants</h3>
                  <p className="text-sm text-muted-foreground">{survivantSquads.length} squad(s)</p>
                </div>
                <div className="flex gap-2">
                  <AddSquadDialog type="survivant" />
                </div>
              </div>

              {/* Import/Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="survivant" module="squads"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="survivant" module="squads"  />
                </CardContent>
              </Card>

              {/* Liste des squads */}
              <SquadList type="survivant" showActions={true} />
            </TabsContent>

            {/* Tout (Vue d'ensemble Survivants) */}
            <TabsContent value="tout" className="space-y-4 mt-4">
              <h3 className="text-lg font-semibold text-blue-500">Vue d'ensemble Survivants</h3>

              {/* Statistiques */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-blue-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Participants</CardTitle>
                    <div className="text-2xl font-bold text-blue-500">{survivantParticipants.length}</div>
                  </CardHeader>
                </Card>
                <Card className="border-blue-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Créneaux</CardTitle>
                    <div className="text-2xl font-bold text-blue-500">{survivantTimeSlots.length}</div>
                  </CardHeader>
                </Card>
                <Card className="border-blue-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Squads</CardTitle>
                    <div className="text-2xl font-bold text-blue-500">{survivantSquads.length}</div>
                  </CardHeader>
                </Card>
              </div>

              {/* Import Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="survivant" module="all"  />
                </CardContent>
                <CardContent>
                  <ExcelExport type="survivant" module="all"  />
                </CardContent>
              </Card>

              {/* Reset Section */}
              <ResetDataSection
                title="Réinitialisation Survivants"
                description="Supprimer les données des survivants"
                options={[
                  { label: "Reset Participants Survivants", module: "participants", type: "survivant" },
                  { label: "Reset Créneaux Survivants", module: "timeslots", type: "survivant" },
                  { label: "Reset Squads Survivants", module: "squads", type: "survivant" },
                  { label: "Reset TOUT (Survivants)", module: "all", type: "survivant" },
                ]}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-4">
          {/* Sous-menu Staff */}
          <Tabs value={activeSubTab.staff} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, staff: value })}>
            <TabsList className="bg-muted/30">
              <TabsTrigger value="participants">Participants</TabsTrigger>
              <TabsTrigger value="creneaux">Créneaux</TabsTrigger>
              <TabsTrigger value="tout">Tout</TabsTrigger>
            </TabsList>

            {/* Participants Staff */}
            <TabsContent value="participants" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-500">Membres du Staff</h3>
                  <p className="text-sm text-muted-foreground">{staffParticipants.length} membre(s)</p>
                </div>
                <div className="flex gap-2">
                  <AddParticipantDialog
                    participantType="staff"
                  />
                </div>
              </div>

              {/* Import/Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import/Export Excel</CardTitle>
                  <CardDescription>Importez ou exportez les participants via Excel</CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="staff" />
                </CardContent>
              </Card>

              {/* Liste des participants */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Liste des membres</CardTitle>
                  <CardDescription>{staffParticipants.length} membre(s) enregistré(s)</CardDescription>
                </CardHeader>
                <CardContent>
                  {staffParticipants.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Aucun membre enregistré</p>
                  ) : (
                    <div className="space-y-2">
                      {staffParticipants.map((participant) => (
                        <Card key={participant.id} className="border-green-500/20">
                          <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{participant.firstName} {participant.lastName}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {participant.email && (
                                  <p className="text-xs text-muted-foreground">{participant.email}</p>
                                )}
                                {participant.timeSlot && (
                                  <span className="text-xs text-muted-foreground">• Attribution: {participant.timeSlot.name}</span>
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
                                onClick={() => {
                                  toast({
                                    title: "Fonctionnalité à venir",
                                    description: "L'édition de participant sera bientôt disponible",
                                  });
                                }}
                                title="Modifier"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (confirm(`Êtes-vous sûr de vouloir supprimer ${participant.firstName} ${participant.lastName} ?`)) {
                                    apiRequest("DELETE", `/api/participants/${participant.id}`)
                                      .then(() => {
                                        queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/participants" });
                                        toast({
                                          title: "Participant supprimé",
                                          description: "Le participant a été supprimé avec succès",
                                        });
                                      })
                                      .catch(() => {
                                        toast({
                                          title: "Erreur",
                                          description: "Impossible de supprimer le participant",
                                          variant: "destructive",
                                        });
                                      });
                                  }
                                }}
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
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

            {/* Créneaux Staff */}
            <TabsContent value="creneaux" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-500">Attributions Staff</h3>
                  <p className="text-sm text-muted-foreground">{staffTimeSlots.length} attribution(s)</p>
                </div>
                <div className="flex gap-2">
                  <AddTimeSlotDialog type="staff" />
                </div>
              </div>

              {/* Export Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Export Excel</CardTitle>
                  <CardDescription>Exportez uniquement les créneaux via Excel</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center py-8">
                  <Button variant="outline" onClick={() => handleExport("staff", "time-slots")} className="gap-2">
                    <Download className="w-4 h-4" />
                    Télécharger Excel - Créneaux
                  </Button>
                </CardContent>
              </Card>

              {/* Liste des créneaux */}
              <TimeSlotsDisplay slots={staffTimeSlots} type="staff" colorClass="text-green-500" />
            </TabsContent>

            {/* Tout (Vue d'ensemble Staff) */}
            <TabsContent value="tout" className="space-y-4 mt-4">
              <h3 className="text-lg font-semibold text-green-500">Vue d'ensemble Staff</h3>

              {/* Import Excel */}
              <ExcelImport type="staff" />

              {/* Statistiques */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-green-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Membres</CardTitle>
                    <div className="text-2xl font-bold text-green-500">{staffParticipants.length}</div>
                  </CardHeader>
                </Card>
                <Card className="border-green-500/20">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Attributions</CardTitle>
                    <div className="text-2xl font-bold text-green-500">{staffTimeSlots.length}</div>
                  </CardHeader>
                </Card>
              </div>

              {/* Reset Section */}
              <ResetDataSection
                title="Réinitialisation Staff"
                description="Supprimer les données du staff"
                options={[
                  { label: "Reset Membres Staff", module: "participants", type: "staff" },
                  { label: "Reset Attributions Staff", module: "timeslots", type: "staff" },
                  { label: "Reset TOUT (Staff)", module: "all", type: "staff" },
                ]}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Boutique Tab */}
        <TabsContent value="boutique" className="space-y-4">
          <h3 className="text-lg font-semibold text-indigo-500">Gestion Boutique</h3>

          {/* Sous-menu Boutique */}
          <Tabs value={activeSubTab.boutique} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, boutique: value })}>
            <TabsList className="bg-muted/30">
              <TabsTrigger value="items">Produits</TabsTrigger>
              <TabsTrigger value="discounts">Réductions</TabsTrigger>
            </TabsList>

            {/* Produits */}
            <TabsContent value="items" className="space-y-4 mt-4">
              {/* Manual Product Management */}
              <ProductManagement />

              {/* Import/Export Excel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                {/* Import */}
                <ExcelImport type="boutique" module="items" />

                {/* Export */}
                <ExcelExport type="boutique" module="items" />
              </div>

              {/* Reset Section for Shop */}
              <ResetDataSection
                title="Réinitialisation Boutique"
                description="Supprimer les données de la boutique"
                options={[
                  { label: "Reset Produits Boutique", module: "shop", description: "Supprime tous les produits de la boutique" },
                  { label: "Reset Achats Boutique", module: "purchases", description: "Supprime tout l'historique des achats" },
                ]}
              />
            </TabsContent>

            {/* Réductions */}
            <TabsContent value="discounts" className="space-y-4 mt-4">
              <DiscountManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Repas Tab */}
        <TabsContent value="repas" className="space-y-4">
          <h3 className="text-lg font-semibold text-orange-500">Gestion Repas</h3>

          {/* Sous-menu Repas */}
          <Tabs value={activeSubTab.repas} onValueChange={(value) => setActiveSubTab({ ...activeSubTab, repas: value })}>
            <TabsList className="bg-muted/30">
              <TabsTrigger value="items">Produits</TabsTrigger>
              <TabsTrigger value="discounts">Réductions</TabsTrigger>
            </TabsList>

            {/* Produits */}
            <TabsContent value="items" className="space-y-4 mt-4">
              {/* Manual Product Management */}
              <MealProductManagement />

              {/* Import/Export Excel */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                {/* Import */}
                <ExcelImport type="repas" module="items" />

                {/* Export */}
                <ExcelExport type="repas" module="items" />
              </div>

              {/* Reset Section for Meals */}
              <ResetDataSection
                title="Réinitialisation Repas"
                description="Supprimer les données des repas"
                options={[
                  { label: "Reset Produits Repas", module: "meals", description: "Supprime tous les produits de repas" },
                  { label: "Reset Achats Repas", module: "meal-purchases", description: "Supprime tout l'historique des achats de repas" },
                ]}
              />
            </TabsContent>

            {/* Réductions */}
            <TabsContent value="discounts" className="space-y-4 mt-4">
              <MealDiscountManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Users Tab - Gestion des utilisateurs */}
        <TabsContent value="users" className="space-y-4">
          <h3 className="text-lg font-semibold text-pink-500">Gestion des Utilisateurs</h3>
          <UserManagement />
        </TabsContent>

        {/* Historique Tab - Logs d'audit */}
        <TabsContent value="historique" className="space-y-4">
          <h3 className="text-lg font-semibold text-yellow-500">Historique des Actions</h3>
          <AuditLogViewer />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}

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
              onClick={() => deletingTimeSlotId && deleteTimeSlotMutation.mutate(deletingTimeSlotId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ManagementLayout>
  );
}
