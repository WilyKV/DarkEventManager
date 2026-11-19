import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { dashboardReportsPath, type DashboardReport } from "@shared/dashboard";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

export function AnalyticsSettings() {
  const [confirm, setConfirm] = useState(false);
  const client = useQueryClient();
  const { data, isError } = useQuery<DashboardReport>({ queryKey: [dashboardReportsPath] });
  const reset = useMutation({
    mutationFn: () => apiRequest("POST", `${dashboardReportsPath}/reset`),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [dashboardReportsPath] });
      setConfirm(false);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><BarChart3 className="size-5" aria-hidden /> Analyses</CardTitle>
        <CardDescription>Démarrez une nouvelle période pour les inscriptions, les arrivées et les débriefs des participants de cette période.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => { reset.reset(); setConfirm(true); }}>Réinitialiser les analyses</Button>
        {data && <p role="status" className="text-sm text-muted-foreground">
          {data.startedAt ? `Période démarrée le ${new Date(data.startedAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : "Période actuelle · Tout l’événement"}
        </p>}
        {isError && <p className="text-sm text-destructive">Période indisponible.</p>}
      </CardContent>
      <AlertDialog open={confirm} onOpenChange={open => { if (!reset.isPending) setConfirm(open); }}>
        <AlertDialogContent className="w-[calc(100%-1.25rem)] rounded-xl p-4 sm:p-6">
          <AlertDialogHeader>
            <AlertDialogTitle>Démarrer une nouvelle période d’analyse ?</AlertDialogTitle>
            <AlertDialogDescription>Les compteurs repartent à partir de maintenant. Les listes d’accueil, les achats et les stocks restent disponibles dans leurs écrans habituels.</AlertDialogDescription>
          </AlertDialogHeader>
          {reset.isError && <p role="alert" className="text-sm text-destructive">Impossible de réinitialiser les analyses.</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reset.isPending}>Annuler</AlertDialogCancel>
            <Button type="button" loading={reset.isPending} onClick={() => reset.mutate()}>Démarrer la période</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
