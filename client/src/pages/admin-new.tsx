import { useState } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Users, Clock, UserCog, Shield, Pencil, Trash2, Database } from "lucide-react";
import { AddParticipantDialog } from "@/components/add-participant-dialog";
import { AddTimeSlotDialog } from "@/components/add-timeslot-dialog";
import { EditTimeSlotDialog } from "@/components/edit-timeslot-dialog";
import { AddSquadDialog } from "@/components/add-squad-dialog";
import { SquadList } from "@/components/squad-list";
import { ExcelImport } from "@/components/excel-import";
import { DataManagement } from "@/components/data-management";
import { DataSyncQR } from "@/components/data-sync-qr";
import { TestDataGenerator } from "@/components/test-data-generator";
import { ParticipantListByTimeslot } from "@/components/participant-list-by-timeslot";
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
  });
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null);
  const [deletingTimeSlotId, setDeletingTimeSlotId] = useState<number | null>(null);

  // Queries pour les données
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

  const deleteTimeSlotMutation = useMutation({
    mutationFn: async (timeSlotId: number) => {
      return await apiRequest("DELETE", `/api/time-slots/${timeSlotId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query: any) => {
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
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer ce créneau. Il est peut-être utilisé par des participants.",
        variant: "destructive",
      });
      console.error("Error deleting time slot:", error);
    },
  });

  const handleExport = async (type: string, module?: string) => {
    try {
      let endpoint = `/api/export/participants?type=${type}`;
      let filename = `${type}`;
      
      if (module === 'time-slots') {
        endpoint = `/api/export/time-slots?type=${type}`;
        filename = `${type}_creneaux`;
      } else if (module === 'squads') {
        endpoint = `/api/export/squads?type=${type}`;
        filename = `${type}_squads`;
      } else if (module === 'all') {
        endpoint = `/api/export/all-data?type=${type}`;
        filename = `${type}_complet`;
      } else {
        filename = `${type}_participants`;
      }

      const response = await fetch(endpoint);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: `Export réussi pour ${module === 'all' ? 'toutes les données' : module || 'les participants'}`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    }
  };

  const handleSubTabChange = (mainTab: string, subTab: string) => {
    setActiveSubTab(prev => ({ ...prev, [mainTab]: subTab }));
  };

  // Component pour afficher les créneaux
  const TimeSlotsDisplay = ({ slots, type, colorClass }: { slots: TimeSlot[], type: string, colorClass: string }) => (
    <>
      {slots && slots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${colorClass}`} />
              Créneaux horaires
            </CardTitle>
            <CardDescription>
              {slots.length} créneau{slots.length > 1 ? 'x' : ''} créé{slots.length > 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map((slot) => (
                <Card key={slot.id} className={`border-${colorClass}/20`}>
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
      subtitle="Gestion complète de l'événement : participants, créneaux, squads et données"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="zombie" className="gap-2 data-[state=active]:bg-red-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/20">
            <Users className="w-4 h-4" />
            Zombies
          </TabsTrigger>
          <TabsTrigger value="survivant" className="gap-2 data-[state=active]:bg-blue-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/20">
            <Users className="w-4 h-4" />
            Survivants
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-2 data-[state=active]:bg-green-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20">
            <UserCog className="w-4 h-4" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2 data-[state=active]:bg-emerald-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-500/20">
            <Database className="w-4 h-4" />
            Gestion données
          </TabsTrigger>
        </TabsList>

        {/* ZOMBIES - Avec sous-menus */}
        <TabsContent value="zombie" className="space-y-6">
          {/* Vue d'ensemble */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-red-500/5 border-red-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <UserCog className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Participants</p>
                    <p className="text-3xl font-bold">{zombieParticipants?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-red-500/5 border-red-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Créneaux</p>
                    <p className="text-3xl font-bold">{zombieTimeSlots?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-red-500/5 border-red-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Squads</p>
                    <p className="text-3xl font-bold">{zombieSquads?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sous-menus Zombies */}
          <Tabs value={activeSubTab.zombie} onValueChange={(v) => handleSubTabChange("zombie", v)} className="space-y-4">
            <TabsList className="w-full grid grid-cols-4 bg-red-500/10">
              <TabsTrigger value="participants" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <UserCog className="w-4 h-4 mr-2" />
                Participants
              </TabsTrigger>
              <TabsTrigger value="creneaux" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <Clock className="w-4 h-4 mr-2" />
                Créneaux
              </TabsTrigger>
              <TabsTrigger value="squads" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Squads
              </TabsTrigger>
              <TabsTrigger value="tout" className="data-[state=active]:bg-red-500 data-[state=active]:text-white">
                <Database className="w-4 h-4 mr-2" />
                Tout
              </TabsTrigger>
            </TabsList>

            {/* Sous-onglet Participants */}
            <TabsContent value="participants" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des participants zombies</CardTitle>
                  <CardDescription>Ajouter, modifier et importer des participants</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddParticipantDialog participantType="zombie" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export / Import</h3>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => handleExport("zombie")}
                      >
                        <Download className="w-4 h-4" />
                        Exporter les participants
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Liste des participants par créneau */}
              <ParticipantListByTimeslot type="zombie" />

              {/* Import Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Import Excel
                  </CardTitle>
                  <CardDescription>
                    Importer des participants depuis un fichier Excel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="zombie" />
                </CardContent>
              </Card>

              {/* Test Data Generator - DEV ONLY */}
              {process.env.NODE_ENV === 'development' && (
                <TestDataGenerator type="zombie" />
              )}
            </TabsContent>

            {/* Sous-onglet Créneaux */}
            <TabsContent value="creneaux" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des créneaux horaires</CardTitle>
                  <CardDescription>Créer et gérer les créneaux de jeu zombies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddTimeSlotDialog type="zombie" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export</h3>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleExport("zombie", "time-slots")}
                    >
                      <Download className="w-4 h-4" />
                      Exporter les créneaux
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <TimeSlotsDisplay slots={zombieTimeSlots || []} type="zombie" colorClass="text-red-500" />
            </TabsContent>

            {/* Sous-onglet Squads */}
            <TabsContent value="squads" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des squads zombies</CardTitle>
                  <CardDescription>Créer et gérer les équipes de zombies</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddSquadDialog type="zombie" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export</h3>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleExport("zombie", "squads")}
                    >
                      <Download className="w-4 h-4" />
                      Exporter les squads
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {zombieSquads && zombieSquads.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-red-500" />
                      Squads zombies
                    </CardTitle>
                    <CardDescription>
                      {zombieSquads.length} squad{zombieSquads.length > 1 ? 's' : ''} créée{zombieSquads.length > 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SquadList type="zombie" showActions={true} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Sous-onglet Tout */}
            <TabsContent value="tout" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Export complet - Section Zombies</CardTitle>
                  <CardDescription>Exporter toutes les données de la section zombies en un seul fichier</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full gap-2 bg-red-500 hover:bg-red-600"
                    onClick={() => handleExport("zombie", "all")}
                  >
                    <Database className="w-4 h-4" />
                    Tout exporter (Participants + Créneaux + Squads)
                  </Button>
                </CardContent>
              </Card>

              {/* QR Code Sync - Tout en un */}
              <Card className="bg-red-500/5 border-red-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-red-500" />
                    Synchronisation QR Code - Section Zombies
                  </CardTitle>
                  <CardDescription>
                    Exporter ou importer TOUTES les données de la section Zombies via QR Code
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataSyncQR
                    module="all"
                    type="zombie"
                    title="Données complètes Zombies"
                    description="Participants, créneaux et squads zombies"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* SURVIVANTS - Avec sous-menus */}
        <TabsContent value="survivant" className="space-y-6">
          {/* Vue d'ensemble */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <UserCog className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Participants</p>
                    <p className="text-3xl font-bold">{survivantParticipants?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Créneaux</p>
                    <p className="text-3xl font-bold">{survivantTimeSlots?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Squads</p>
                    <p className="text-3xl font-bold">{survivantSquads?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sous-menus Survivants */}
          <Tabs value={activeSubTab.survivant} onValueChange={(v) => handleSubTabChange("survivant", v)} className="space-y-4">
            <TabsList className="w-full grid grid-cols-4 bg-blue-500/10">
              <TabsTrigger value="participants" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <UserCog className="w-4 h-4 mr-2" />
                Participants
              </TabsTrigger>
              <TabsTrigger value="creneaux" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <Clock className="w-4 h-4 mr-2" />
                Créneaux
              </TabsTrigger>
              <TabsTrigger value="squads" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <Shield className="w-4 h-4 mr-2" />
                Squads
              </TabsTrigger>
              <TabsTrigger value="tout" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                <Database className="w-4 h-4 mr-2" />
                Tout
              </TabsTrigger>
            </TabsList>

            {/* Sous-onglet Participants */}
            <TabsContent value="participants" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des participants survivants</CardTitle>
                  <CardDescription>Ajouter, modifier et importer des participants</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddParticipantDialog participantType="survivant" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export / Import</h3>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => handleExport("survivant")}
                      >
                        <Download className="w-4 h-4" />
                        Exporter les participants
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Liste des participants par créneau */}
              <ParticipantListByTimeslot type="survivant" />

              {/* Import Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Import Excel
                  </CardTitle>
                  <CardDescription>
                    Importer des participants depuis un fichier Excel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="survivant" />
                </CardContent>
              </Card>

              {/* Test Data Generator - DEV ONLY */}
              {process.env.NODE_ENV === 'development' && (
                <TestDataGenerator type="survivant" />
              )}
            </TabsContent>

            {/* Sous-onglet Créneaux */}
            <TabsContent value="creneaux" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des créneaux horaires</CardTitle>
                  <CardDescription>Créer et gérer les créneaux de jeu survivants</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddTimeSlotDialog type="survivant" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export</h3>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleExport("survivant", "time-slots")}
                    >
                      <Download className="w-4 h-4" />
                      Exporter les créneaux
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <TimeSlotsDisplay slots={survivantTimeSlots || []} type="survivant" colorClass="text-blue-500" />
            </TabsContent>

            {/* Sous-onglet Squads */}
            <TabsContent value="squads" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des squads survivants</CardTitle>
                  <CardDescription>Créer et gérer les équipes de survivants</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddSquadDialog type="survivant" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export</h3>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleExport("survivant", "squads")}
                    >
                      <Download className="w-4 h-4" />
                      Exporter les squads
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {survivantSquads && survivantSquads.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-500" />
                      Squads survivants
                    </CardTitle>
                    <CardDescription>
                      {survivantSquads.length} squad{survivantSquads.length > 1 ? 's' : ''} créée{survivantSquads.length > 1 ? 's' : ''}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SquadList type="survivant" showActions={true} />
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Sous-onglet Tout */}
            <TabsContent value="tout" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Export complet - Section Survivants</CardTitle>
                  <CardDescription>Exporter toutes les données de la section survivants en un seul fichier</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full gap-2 bg-blue-500 hover:bg-blue-600"
                    onClick={() => handleExport("survivant", "all")}
                  >
                    <Database className="w-4 h-4" />
                    Tout exporter (Participants + Créneaux + Squads)
                  </Button>
                </CardContent>
              </Card>

              {/* QR Code Sync - Tout en un */}
              <Card className="bg-blue-500/5 border-blue-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" />
                    Synchronisation QR Code - Section Survivants
                  </CardTitle>
                  <CardDescription>
                    Exporter ou importer TOUTES les données de la section Survivants via QR Code
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataSyncQR
                    module="all"
                    type="survivant"
                    title="Données complètes Survivants"
                    description="Participants, créneaux et squads survivants"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* STAFF - Avec sous-menus (3 onglets seulement, pas de squads) */}
        <TabsContent value="staff" className="space-y-6">
          {/* Vue d'ensemble */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <UserCog className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Membres du Staff</p>
                    <p className="text-3xl font-bold">{staffParticipants?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-green-500/5 border-green-500/20">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Créneaux</p>
                    <p className="text-3xl font-bold">{staffTimeSlots?.length || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sous-menus Staff (sans Squads) */}
          <Tabs value={activeSubTab.staff} onValueChange={(v) => handleSubTabChange("staff", v)} className="space-y-4">
            <TabsList className="w-full grid grid-cols-3 bg-green-500/10">
              <TabsTrigger value="participants" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <UserCog className="w-4 h-4 mr-2" />
                Staff
              </TabsTrigger>
              <TabsTrigger value="creneaux" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <Clock className="w-4 h-4 mr-2" />
                Créneaux
              </TabsTrigger>
              <TabsTrigger value="tout" className="data-[state=active]:bg-green-500 data-[state=active]:text-white">
                <Database className="w-4 h-4 mr-2" />
                Tout
              </TabsTrigger>
            </TabsList>

            {/* Sous-onglet Staff */}
            <TabsContent value="participants" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des membres du staff</CardTitle>
                  <CardDescription>Ajouter, modifier et importer les membres du staff</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddParticipantDialog participantType="staff" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export / Import</h3>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="gap-2"
                        onClick={() => handleExport("staff")}
                      >
                        <Download className="w-4 h-4" />
                        Exporter le staff
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Liste des participants par créneau */}
              <ParticipantListByTimeslot type="staff" />

              {/* Import Excel */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" />
                    Import Excel
                  </CardTitle>
                  <CardDescription>
                    Importer des membres du staff depuis un fichier Excel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ExcelImport type="staff" />
                </CardContent>
              </Card>

              {/* Test Data Generator - DEV ONLY */}
              {process.env.NODE_ENV === 'development' && (
                <TestDataGenerator type="staff" />
              )}
            </TabsContent>

            {/* Sous-onglet Créneaux */}
            <TabsContent value="creneaux" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gestion des créneaux horaires</CardTitle>
                  <CardDescription>Créer et gérer les créneaux pour le staff</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <AddTimeSlotDialog type="staff" />
                  
                  <div className="pt-4 border-t">
                    <h3 className="font-semibold mb-3">Export</h3>
                    <Button 
                      variant="outline" 
                      className="gap-2"
                      onClick={() => handleExport("staff", "time-slots")}
                    >
                      <Download className="w-4 h-4" />
                      Exporter les créneaux
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <TimeSlotsDisplay slots={staffTimeSlots || []} type="staff" colorClass="text-green-500" />
            </TabsContent>

            {/* Sous-onglet Tout */}
            <TabsContent value="tout" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Export complet - Section Staff</CardTitle>
                  <CardDescription>Exporter toutes les données de la section staff en un seul fichier</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full gap-2 bg-green-500 hover:bg-green-600"
                    onClick={() => handleExport("staff", "all")}
                  >
                    <Database className="w-4 h-4" />
                    Tout exporter (Staff + Créneaux)
                  </Button>
                </CardContent>
              </Card>

              {/* QR Code Sync - Tout en un */}
              <Card className="bg-green-500/5 border-green-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-green-500" />
                    Synchronisation QR Code - Section Staff
                  </CardTitle>
                  <CardDescription>
                    Exporter ou importer TOUTES les données de la section Staff via QR Code
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DataSyncQR
                    module="all"
                    type="staff"
                    title="Données complètes Staff"
                    description="Membres du staff et créneaux"
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* GESTION DONNEES - Tab globale sans sous-menus */}
        <TabsContent value="data" className="space-y-6">
          <Card className="bg-emerald-500/5 border-emerald-500/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-6 h-6 text-emerald-500" />
                Gestion globale des données
              </CardTitle>
              <CardDescription>
                Export, import et réinitialisation de toutes les données de l'application
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DataManagement />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit TimeSlot Dialog */}
      {editingTimeSlot && (
        <EditTimeSlotDialog
          timeSlot={editingTimeSlot}
          open={!!editingTimeSlot}
          onOpenChange={(open) => !open && setEditingTimeSlot(null)}
        />
      )}

      {/* Delete TimeSlot Confirmation Dialog */}
      <AlertDialog open={!!deletingTimeSlotId} onOpenChange={(open) => !open && setDeletingTimeSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce créneau horaire ? Cette action est irréversible.
              Les participants associés à ce créneau perdront leur assignation.
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
