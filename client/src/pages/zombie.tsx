import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { ParticipantList } from "@/components/participant-list";
import { ExcelImport } from "@/components/excel-import";
import { Skeleton } from "@/components/ui/skeleton";
import { ParticipantWithRelations, TimeSlot, Squad } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { ManagementLayout } from "@/components/management-layout";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ZombiePage() {
  const { toast } = useToast();

  const { data: participants, isLoading: participantsLoading, refetch: refetchParticipants } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const { data: timeSlots, isLoading: timeSlotsLoading } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const { data: squads, isLoading: squadsLoading } = useQuery<Squad[]>({
    queryKey: ["/api/squads", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/squads?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch squads");
      return res.json();
    },
  });

  const isLoading = participantsLoading || timeSlotsLoading || squadsLoading;

  const handleExport = async (timeSlotId?: number, squadId?: number, filterName?: string) => {
    try {
      let url = "/api/export/participants?type=zombie";
      if (timeSlotId) url += `&timeSlotId=${timeSlotId}`;
      if (squadId) url += `&squadId=${squadId}`;
      if (filterName) url += `&filterLabel=${encodeURIComponent(filterName)}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);

      const description = filterName 
        ? `Export réussi pour: ${filterName}`
        : "Export réussi pour tous les zombies";

      toast({
        title: "Export réussi",
        description,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    }
  };

  const actions = (
    <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="gap-2"
                data-testid="button-export"
              >
                <Download className="w-4 h-4" />
                Exporter en Excel
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Options d'export</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport()}>
                Tous les zombies
              </DropdownMenuItem>
              {timeSlots && timeSlots.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Par créneau</DropdownMenuLabel>
                  {timeSlots.map((slot) => (
                    <DropdownMenuItem
                      key={slot.id}
                      onClick={() => handleExport(slot.id, undefined, `Créneau ${slot.name}`)}
                    >
                      {slot.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {squads && squads.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Par squad</DropdownMenuLabel>
                  {squads.map((squad) => (
                    <DropdownMenuItem
                      key={squad.id}
                      onClick={() => handleExport(undefined, squad.id, squad.name)}
                    >
                      {squad.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <ManagementLayout
      title="Zombies"
      subtitle="Gestion des participants zombies"
      actions={actions}
    >
      <div className="space-y-6">

        {/* Excel Import */}
        <ExcelImport type="zombie" />

        {/* Stats */}
        {!isLoading && participants && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-foreground">{participants.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-card border">
              <p className="text-sm text-muted-foreground">Arrivés</p>
              <p className="text-2xl font-bold text-primary">
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
            type="zombie"
            onUpdate={() => refetchParticipants()}
          />
        )}
      </div>
    </ManagementLayout>
  );
}
