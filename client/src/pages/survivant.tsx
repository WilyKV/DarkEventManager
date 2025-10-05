import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ParticipantListByTimeslot } from "@/components/participant-list-by-timeslot";
import { SquadList } from "@/components/squad-list";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield } from "lucide-react";
import { ParticipantWithRelations, TimeSlot } from "@shared/schema";
import { ManagementLayout } from "@/components/management-layout";

export default function SurvivantPage() {
  const [activeTab, setActiveTab] = useState("participants");
  const { data: participants, isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const { data: timeSlots, isLoading: timeSlotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const isLoading = participantsLoading || timeSlotsLoading;

  return (
    <ManagementLayout
      title="Survivants"
      subtitle="Gestion des participants survivants"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="participants" className="gap-2">
            <Users className="w-4 h-4" />
            Participants
          </TabsTrigger>
          <TabsTrigger value="squads" className="gap-2">
            <Shield className="w-4 h-4" />
            Squads
          </TabsTrigger>
        </TabsList>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-6">
          {/* Stats */}
          {!isLoading && participants && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-card border">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{participants.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-card border">
                <p className="text-sm text-muted-foreground">Arrivés</p>
                <p className="text-2xl font-bold text-chart-3">
                  {participants.filter(p => p.arrived).length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card border">
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold text-chart-2">
                  {participants.filter(p => !p.arrived).length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-card border">
                <p className="text-sm text-muted-foreground">Checklist OK</p>
                <p className="text-2xl font-bold text-chart-1">
                  {participants.filter(p => p.checklistCompleted).length}
                </p>
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
              type="survivant"
              onUpdate={() => refetchParticipants()}
            />
          )}
        </TabsContent>

        {/* Squads Tab */}
        <TabsContent value="squads" className="space-y-6">
          <SquadList type="survivant" showActions={false} />
        </TabsContent>
      </Tabs>
    </ManagementLayout>
  );
}
