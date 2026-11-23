import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { LogIn, LogOut, ShoppingBag, Utensils } from "lucide-react";
import { staffCardPath, type StaffCardScan } from "@shared/card-scan";
import { apiRequest } from "@/lib/queryClient";
import { Button, buttonVariants } from "@/components/ui/button";

export function StaffCardActions({ token, accountId }: { token: string; accountId: number }) {
  const path = `${staffCardPath}/${encodeURIComponent(token)}`;
  const queryKey = [path, accountId];
  const client = useQueryClient();
  const query = useQuery<StaffCardScan | null>({
    queryKey, gcTime: 0, refetchOnMount: "always",
    queryFn: async ({ signal }) => {
      const response = await fetch(path, { signal, cache: "no-store" });
      if ([401, 403, 404].includes(response.status)) return null;
      if (!response.ok) throw new Error("Impossible de vérifier les actions du staff.");
      return response.json();
    },
  });
  const presence = useMutation({
    mutationFn: async (action: "arrive" | "depart") => {
      const response = await apiRequest("POST", `${path}/presence`, { action });
      return await response.json() as StaffCardScan;
    },
    onSuccess: data => {
      client.setQueryData(queryKey, data);
      void client.invalidateQueries({ queryKey: ["/api/participants"] });
    },
    onError: () => { void query.refetch(); },
  });
  if (query.isPending) return <p role="status" className="pt-4 text-sm">Vérification des actions du staff…</p>;
  if (query.isError) return <p role="alert" className="pt-4 text-sm">Impossible de vérifier les actions du staff.</p>;
  const scan = query.data;
  if (!scan) return null;
  const { firstName, lastName } = scan.participant;
  const arrived = scan.presence === "present";
  return <section className="souvenir-highlights" aria-label="Actions du staff">
    <h2>{firstName} {lastName}</h2>
    {scan.canManagePresence && <p className="mt-1 text-sm">{arrived ? "Présent" : scan.presence === "departed" ? "Sortie enregistrée" : "Arrivée à enregistrer"}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {scan.canManagePresence && scan.presence !== "departed" && <Button type="button" variant="outline" loading={presence.isPending}
        onClick={() => presence.mutate(arrived ? "depart" : "arrive")}>
        {arrived ? <LogOut /> : <LogIn />} {arrived ? "Noter la sortie" : "Noter l’arrivée"}
      </Button>}
      {scan.canServeMeals && <Link className={buttonVariants({ variant: "outline" })} href={`/repas?carte=${token}`}><Utensils /> Ouvrir les repas</Link>}
      {scan.canSell && <Link className={buttonVariants({ variant: "outline" })} href={`/boutique?carte=${token}`}><ShoppingBag /> Ouvrir la boutique</Link>}
    </div>
    {scan.canServeMeals && <p className="mt-2 text-sm">Vérifiez la case repas sur la carte physique avant de servir.</p>}
    {presence.isError && <p role="alert" className="souvenir-error">Impossible de valider cette action. Vérifiez l’état affiché.</p>}
  </section>;
}
