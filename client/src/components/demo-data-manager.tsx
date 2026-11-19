import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, FlaskConical, Trash2 } from "lucide-react";
import { demoDataPath, type DemoDataStatus } from "@shared/demo-data";
import { liveQueryPrefixes, matchesQueryPrefix } from "@shared/live-updates";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DemoDataManager() {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const status = useQuery<DemoDataStatus>({ queryKey: [demoDataPath], refetchOnMount: "always" });
  const mutation = useMutation({
    mutationFn: async (method: "POST" | "DELETE"): Promise<DemoDataStatus> => {
      const response = await fetch(demoDataPath, { method, credentials: "same-origin" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Impossible de modifier les données de test.");
      return body;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([demoDataPath], data);
      void queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => typeof key === "string" &&
          liveQueryPrefixes.all.some(prefix => prefix !== demoDataPath && matchesQueryPrefix(key, prefix)),
      });
    },
  });

  const disabled = !online || !status.data || mutation.isPending;
  const loaded = status.data?.loaded;
  const count = status.data?.participants ?? 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FlaskConical className="size-5 text-emerald-300" aria-hidden />
            Données de test
          </CardTitle>
          {status.data && (
            <Badge variant={loaded ? "secondary" : "outline"} role="status">
              {loaded ? `Démo chargée · ${count} ${count === 1 ? "participant" : "participants"}` : "Aucune donnée de test"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Retrouvez des exemples dans les listes, les équipes, les badges, la boutique, les repas, les comptes et l’historique.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={disabled || loaded} onClick={() => mutation.mutate("POST")}>
            <Database aria-hidden />
            {mutation.isPending && mutation.variables === "POST" ? "Chargement…" : "Charger les données de test"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" disabled={disabled || !loaded}>
                <Trash2 aria-hidden />
                {mutation.isPending && mutation.variables === "DELETE" ? "Suppression…" : "Supprimer les données de test"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="w-[calc(100%-2rem)] rounded-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer les données de test ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Les exemples chargés et les opérations réalisées entre ces exemples seront supprimés du serveur. Vos fiches réelles seront conservées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction className={buttonVariants({ variant: "destructive" })} disabled={!online}
                  onClick={() => mutation.mutate("DELETE")}>Supprimer la démo</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {!online && <p className="text-sm text-muted-foreground">Connectez-vous au serveur pour modifier les données de test.</p>}
        {online && status.isError && (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-sm text-destructive">Impossible de vérifier l’état de la démo.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void status.refetch()}>Réessayer</Button>
          </div>
        )}
        {mutation.isError && <p role="alert" className="text-sm text-destructive">{mutation.error.message}</p>}
        <p className="text-sm text-muted-foreground">Si vous utilisez l’accueil zombie hors ligne, actualisez la liste sur l’appareil après avoir chargé ou retiré la démo.</p>
      </CardContent>
    </Card>
  );
}
