import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import { souvenirErasureDeadline, souvenirErasureRequestsPath, type SouvenirErasureRequest } from "@shared/participant-card";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SouvenirDeleteAction } from "./souvenir-delete-action";

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Europe/Paris" });
const queryKey = [souvenirErasureRequestsPath];

export function SouvenirErasureRequests() {
  const client = useQueryClient();
  const requests = useQuery<SouvenirErasureRequest[]>({
    queryKey, staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 60_000,
  });
  const erase = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `${souvenirErasureRequestsPath}/${id}`); },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["/api/participants"] });
      void client.invalidateQueries({ queryKey: ["/api/check-in"] });
    },
    onSettled: () => { void client.invalidateQueries({ queryKey }); },
  });

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><Shield className="size-5" aria-hidden /> Demandes d’effacement</CardTitle>
      <CardDescription>Le délai de réponse est de 30 jours. La purge habituelle reste prévue trois mois après la clôture.</CardDescription>
    </CardHeader>
    <CardContent>
      {requests.isPending && <p role="status" className="text-sm text-muted-foreground">Chargement des demandes…</p>}
      {requests.isError && <p role="alert" className="text-sm text-destructive">Impossible de charger les demandes.</p>}
      {requests.data?.length === 0 && <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>}
      {requests.data && requests.data.length > 0 && <ul className="divide-y divide-border">
        {requests.data.map(request => {
          const requestedAt = new Date(request.requestedAt);
          const deadline = souvenirErasureDeadline(requestedAt);
          return <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold">{request.firstName} {request.lastName}</p>
              <p className="text-sm text-muted-foreground">Demande du {date.format(requestedAt)} · Échéance le {date.format(deadline)}</p>
            </div>
            <SouvenirDeleteAction label="Traiter et effacer" disabled={erase.isPending}
              description={`Confirmez l’effacement de la fiche, du récapitulatif et de la photo de ${request.firstName} ${request.lastName}. Le code de sa carte cessera de fonctionner.`}
              onConfirm={() => erase.mutate(request.id)} />
          </li>;
        })}
      </ul>}
      {erase.isError && <p role="alert" className="text-sm text-destructive">Impossible d’effacer cette fiche. Vérifiez si la demande est encore en attente.</p>}
      {erase.isSuccess && <p role="status" className="text-sm text-muted-foreground">Demande traitée et données effacées.</p>}
      <Button type="button" variant="ghost" className="mt-2" disabled={requests.isFetching} onClick={() => void requests.refetch()}>Actualiser les demandes</Button>
    </CardContent>
  </Card>;
}
