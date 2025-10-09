import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantListByTimeslot } from "@/components/participant-list-by-timeslot";
import { SquadList } from "@/components/squad-list";
import { SyncPushPullButtons } from "@/components/sync-push-pull-buttons";
import { ExcelExport } from "@/components/excel-export";
import { ExcelImport } from "@/components/excel-import";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield, Database, FileSpreadsheet } from "lucide-react";
import { ParticipantWithRelations, TimeSlot } from "@shared/schema";
import { ManagementLayout } from "@/components/management-layout";

export default function ZombiePage() {
  const [activeTab, setActiveTab] = useState("participants");
  const { data: participants, isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const { data: timeSlots = [], isLoading: timeSlotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const isLoading = participantsLoading || timeSlotsLoading;

  return (
    <ManagementLayout
      title="Zombies"
      subtitle="Gestion des participants zombies"
      showScanButton={true}
      scanLink="/scan?type=zombie"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="participants" className="gap-2 data-[state=active]:bg-red-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/20">
            <Users className="w-4 h-4" />
            Participants
          </TabsTrigger>
          <TabsTrigger value="squads" className="gap-2 data-[state=active]:bg-red-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/20">
            <Shield className="w-4 h-4" />
            Squads
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2 data-[state=active]:bg-red-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/20">
            <Database className="w-4 h-4" />
            Données
          </TabsTrigger>
        </TabsList>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-6">
          {/* Stats */}
          {!isLoading && participants && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="relative p-5 rounded-xl bg-card border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-400" />
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Total Zombies</p>
                  <p className="text-4xl font-bold text-red-500">{participants.length}</p>
                </div>
              </div>
              <div className="relative p-5 rounded-xl bg-card border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-400" />
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Arrivés</p>
                  <p className="text-4xl font-bold text-green-500">
                    {participants.filter(p => p.arrived).length}
                  </p>
                </div>
              </div>
              <div className="relative p-5 rounded-xl bg-card border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-orange-400" />
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">En attente</p>
                  <p className="text-4xl font-bold text-orange-500">
                    {participants.filter(p => !p.arrived).length}
                  </p>
                </div>
              </div>
              <div className="relative p-5 rounded-xl bg-card border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Checklist OK</p>
                  <p className="text-4xl font-bold text-blue-500">
                    {participants.filter(p => p.checklistCompleted).length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Participant List */}
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <ParticipantListByTimeslot
              participants={participants || []}
              timeSlots={timeSlots || []}
              type="zombie"
              onUpdate={() => refetchParticipants()}
              allowEdit={false}
            />
          )}
        </TabsContent>

        {/* Squads Tab */}
        <TabsContent value="squads" className="space-y-6">
          <SquadList type="zombie" showActions={false} />
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Synchronisation Push/Pull */}
            <SyncPushPullButtons />

            {/* Import/Export Excel Global */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Import/Export Excel Global
                </CardTitle>
                <CardDescription>
                  Gérez les participants, créneaux et squads via fichier Excel
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ExcelExport type="zombie" module="all" />
                <ExcelImport type="zombie" />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </ManagementLayout>
  );
}
