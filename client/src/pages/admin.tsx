import { useState } from "react";
import { ManagementLayout } from "@/components/management-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Download, Users, Clock, UserCog, Shield } from "lucide-react";
import { AddParticipantDialog } from "@/components/add-participant-dialog";
import { AddTimeSlotDialog } from "@/components/add-timeslot-dialog";
import { AddSquadDialog } from "@/components/add-squad-dialog";
import { SquadList } from "@/components/squad-list";
import { ExcelImport } from "@/components/excel-import";
import { useQuery } from "@tanstack/react-query";
import { ParticipantWithRelations, TimeSlot, Squad, SquadWithRelations } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function AdminPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("zombie");
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showAddTimeslot, setShowAddTimeslot] = useState(false);

  const { data: zombieParticipants } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantParticipants } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: zombieTimeSlots } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: survivantTimeSlots } = useQuery<TimeSlot[]>({
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

  const handleExport = async (type: string) => {
    try {
      const response = await fetch(`/api/export/participants?type=${type}`);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${type}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: `Export réussi pour les ${type}s`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    }
  };

  return (
    <ManagementLayout
      title="Administration"
      subtitle="Gestion des participants, créneaux et imports/exports"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="zombie" className="gap-2">
            <Users className="w-4 h-4" />
            Zombies
          </TabsTrigger>
          <TabsTrigger value="survivant" className="gap-2">
            <Users className="w-4 h-4" />
            Survivants
          </TabsTrigger>
        </TabsList>

        {/* Zombie Tab */}
        <TabsContent value="zombie" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  Participants Zombies
                </CardTitle>
                <CardDescription>
                  Gérer les participants zombies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total participants</p>
                    <p className="text-2xl font-bold">{zombieParticipants?.length || 0}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <AddParticipantDialog participantType="zombie" />

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleExport("zombie")}
                  >
                    <Download className="w-4 h-4" />
                    Exporter en Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Créneaux */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Créneaux Zombies
                </CardTitle>
                <CardDescription>
                  Gérer les créneaux horaires
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Créneaux créés</p>
                    <p className="text-2xl font-bold">{zombieTimeSlots?.length || 0}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <AddTimeSlotDialog type="zombie" />

                  {zombieTimeSlots && zombieTimeSlots.length > 0 && (
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      <p className="text-sm font-semibold mb-2">Créneaux existants :</p>
                      <div className="space-y-1">
                        {zombieTimeSlots.map((slot) => (
                          <div key={slot.id} className="text-sm p-2 bg-muted/50 rounded flex justify-between items-center">
                            <span>{slot.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Briefing: {slot.briefingTime} • Jeu: {slot.gameTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Squads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Squads Zombies
                </CardTitle>
                <CardDescription>
                  Gérer les squads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Squads créées</p>
                    <p className="text-2xl font-bold">{zombieSquads?.length || 0}</p>
                  </div>
                </div>

                <AddSquadDialog type="zombie" />
              </CardContent>
            </Card>
          </div>

          {/* Squads List */}
          {zombieSquads && zombieSquads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Liste des squads zombies</CardTitle>
                <CardDescription>Voir et gérer toutes les squads</CardDescription>
              </CardHeader>
              <CardContent>
                <SquadList type="zombie" showActions={true} />
              </CardContent>
            </Card>
          )}

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
        </TabsContent>

        {/* Survivant Tab */}
        <TabsContent value="survivant" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Participants */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCog className="w-5 h-5" />
                  Participants Survivants
                </CardTitle>
                <CardDescription>
                  Gérer les participants survivants
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Total participants</p>
                    <p className="text-2xl font-bold">{survivantParticipants?.length || 0}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <AddParticipantDialog participantType="survivant" />

                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => handleExport("survivant")}
                  >
                    <Download className="w-4 h-4" />
                    Exporter en Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Créneaux */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Créneaux Survivants
                </CardTitle>
                <CardDescription>
                  Gérer les créneaux horaires
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Créneaux créés</p>
                    <p className="text-2xl font-bold">{survivantTimeSlots?.length || 0}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <AddTimeSlotDialog type="survivant" />

                  {survivantTimeSlots && survivantTimeSlots.length > 0 && (
                    <div className="border rounded-lg p-3 max-h-48 overflow-y-auto">
                      <p className="text-sm font-semibold mb-2">Créneaux existants :</p>
                      <div className="space-y-1">
                        {survivantTimeSlots.map((slot) => (
                          <div key={slot.id} className="text-sm p-2 bg-muted/50 rounded flex justify-between items-center">
                            <span>{slot.name}</span>
                            <span className="text-xs text-muted-foreground">
                              Briefing: {slot.briefingTime} • Jeu: {slot.gameTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Squads */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Squads Survivants
                </CardTitle>
                <CardDescription>
                  Gérer les squads
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Squads créées</p>
                    <p className="text-2xl font-bold">{survivantSquads?.length || 0}</p>
                  </div>
                </div>

                <AddSquadDialog type="survivant" />
              </CardContent>
            </Card>
          </div>

          {/* Squads List */}
          {survivantSquads && survivantSquads.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Liste des squads survivants</CardTitle>
                <CardDescription>Voir et gérer toutes les squads</CardDescription>
              </CardHeader>
              <CardContent>
                <SquadList type="survivant" showActions={true} />
              </CardContent>
            </Card>
          )}

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
        </TabsContent>
      </Tabs>
    </ManagementLayout>
  );
}
