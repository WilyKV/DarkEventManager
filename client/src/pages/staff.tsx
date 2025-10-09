import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantListByTimeslot } from "@/components/participant-list-by-timeslot";
import { SyncPushPullButtons } from "@/components/sync-push-pull-buttons";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Database } from "lucide-react";
import { ParticipantWithRelations, TimeSlot } from "@shared/schema";
import { ManagementLayout } from "@/components/management-layout";

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState("participants");
  const { data: participants, isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=staff");
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const { data: timeSlots = [], isLoading: timeSlotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "staff" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=staff");
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const isLoading = participantsLoading || timeSlotsLoading;

  return (
    <ManagementLayout
      title="Staff"
      subtitle="Gestion des membres du staff"
      showScanButton={true}
      scanLink="/scan?type=staff"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 border border-border/50">
          <TabsTrigger value="participants" className="gap-2 data-[state=active]:bg-green-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20">
            <Users className="w-4 h-4" />
            Membres du Staff
          </TabsTrigger>
          <TabsTrigger value="data" className="gap-2 data-[state=active]:bg-green-500/90 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-green-500/20">
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
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 to-green-400" />
                <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Total Staff</p>
                  <p className="text-4xl font-bold text-green-500">{participants.length}</p>
                </div>
              </div>
              <div className="relative p-5 rounded-xl bg-card border border-border/50 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-400" />
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Arrivés</p>
                  <p className="text-4xl font-bold text-blue-500">
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
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-purple-400" />
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-300" />
                <div className="relative">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Attributions</p>
                  <p className="text-4xl font-bold text-purple-500">
                    {timeSlots?.length || 0}
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
              type="staff"
              onUpdate={() => refetchParticipants()}
              timeSlotLabel="Attribution"
              allowEdit={false}
            />
          )}
        </TabsContent>

        {/* Data Tab */}
        <TabsContent value="data" className="space-y-6">
          <SyncPushPullButtons />
        </TabsContent>
      </Tabs>
    </ManagementLayout>
  );
}
