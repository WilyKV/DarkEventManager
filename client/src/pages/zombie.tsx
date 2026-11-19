import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ParticipantListByTimeslot } from "@/components/participant-list-by-timeslot";
import { SquadList } from "@/components/squad-list";
import { ExcelExport } from "@/components/excel-export";
import { ExcelImport } from "@/components/excel-import";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, WifiOff } from "lucide-react";
import { ParticipantWithRelations, TimeSlot } from "@shared/schema";
import { ManagementLayout } from "@/components/management-layout";

export default function ZombiePage() {
  const { data: participants, isLoading: participantsLoading, isError: participantsError, refetch: refetchParticipants } = useQuery<ParticipantWithRelations[]>({
    queryKey: ["/api/participants", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/participants?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch participants");
      return res.json();
    },
  });

  const { data: timeSlots = [], isLoading: timeSlotsLoading, isError: timeSlotsError, refetch: refetchTimeSlots } = useQuery<TimeSlot[]>({
    queryKey: ["/api/time-slots", { type: "zombie" }],
    queryFn: async () => {
      const res = await fetch("/api/time-slots?type=zombie");
      if (!res.ok) throw new Error("Failed to fetch time slots");
      return res.json();
    },
  });

  const isLoading = participantsLoading || timeSlotsLoading;

  const metrics = participants ? [
    { label: "Inscrits", value: participants.length },
    { label: "Arrivés", value: participants.filter(p => p.arrived).length },
    { label: "En attente", value: participants.filter(p => !p.arrived).length },
    { label: "Checklists terminées", value: participants.filter(p => p.checklistCompleted).length },
  ] : [];

  return (
    <ManagementLayout title="Accueil zombie" subtitle="Arrivées, checklist et équipes" showScanButton
      actions={<Link href="/zombie/hors-ligne" className={buttonVariants({ variant: "outline" })}>Accueil hors ligne</Link>}>
      <Tabs defaultValue="participants" className="space-y-4">
        <TabsList className="grid h-auto w-full grid-cols-3 border border-border sm:inline-grid sm:w-auto">
          <TabsTrigger className="min-h-11" value="participants">Participants</TabsTrigger>
          <TabsTrigger className="min-h-11" value="squads">Équipes</TabsTrigger>
          <TabsTrigger className="min-h-11" value="data">Données</TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="space-y-4">
          {!isLoading && participants && !participantsError && (
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
              {metrics.map(({ label, value }) => (
                <div key={label} className="bg-card px-4 py-2.5 sm:p-4">
                  <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
                  <dd className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : participantsError || timeSlotsError ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Impossible de charger la liste des participants.</p>
              <Button variant="outline" size="sm" onClick={() => { void refetchParticipants(); void refetchTimeSlots(); }}>
                Réessayer
              </Button>
            </div>
          ) : (
            <ParticipantListByTimeslot
              participants={participants || []}
              timeSlots={timeSlots}
              type="zombie"
              onUpdate={() => refetchParticipants()}
              allowEdit={false}
            />
          )}
        </TabsContent>

        <TabsContent value="squads" className="space-y-6">
          <SquadList type="zombie" showActions={false} />
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><WifiOff className="size-5" /> Accueil hors ligne</CardTitle>
                <CardDescription>Téléchargez la liste chiffrée pour cocher les arrivées et attribuer les équipes sans réseau.</CardDescription>
              </CardHeader>
              <CardContent><Link href="/zombie/hors-ligne" className={buttonVariants({ variant: "outline" })}>Ouvrir l’accueil hors ligne</Link></CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5" />
                  Import et export Excel
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
