import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ParticipantList } from "@/components/participant-list";
import { ExcelImport } from "@/components/excel-import";
import { Skeleton } from "@/components/ui/skeleton";
import { ParticipantWithRelations, TimeSlot, Squad } from "@shared/schema";

export default function SurvivantPage() {
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

  const { data: squads, isLoading: squadsLoading } = useQuery<Squad[]>({
    queryKey: ["/api/squads", { type: "survivant" }],
    queryFn: async () => {
      const res = await fetch("/api/squads?type=survivant");
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  const isLoading = participantsLoading || timeSlotsLoading || squadsLoading;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-display text-chart-3">Survivants</h1>
              <p className="text-muted-foreground mt-1">Gestion des participants survivants</p>
            </div>
          </div>
        </div>

        {/* Excel Import */}
        <ExcelImport type="survivant" />

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
          <ParticipantList
            participants={participants || []}
            timeSlots={timeSlots || []}
            squads={squads || []}
            type="survivant"
            onUpdate={() => refetchParticipants()}
          />
        )}
      </div>
    </div>
  );
}
