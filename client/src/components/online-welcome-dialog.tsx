import { offlineCheckInPage } from "@shared/zombie-offline";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { checkInPath, checkInRoles, checkInRosterPath, checkInTypes, type CheckInPlayer, type CheckInRoster } from "@shared/check-in";
import { liveQueryPrefixes, matchesQueryPrefix } from "@shared/live-updates";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { WelcomeDialog } from "./welcome-dialog";

export function OnlineWelcomeDialog({ onClose }: { onClose: () => void }) {
  const { hasAnyRole, user } = useAuth();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const queryKey = [checkInRosterPath, user?.id];
  const query = useQuery<CheckInRoster>({
    queryKey, enabled: online, refetchOnMount: "always",
    queryFn: async ({ signal }) => {
      const response = await fetch(checkInRosterPath, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Impossible de charger la liste d’accueil.");
      return response.json();
    },
  });
  const canOpenLocal = hasAnyRole(checkInRoles);
  const profileTypes = hasAnyRole(["admin"]) ? checkInTypes
    : checkInTypes.filter(type => type !== "staff" && hasAnyRole([`staff_${type}`]));
  const retry = () => { void query.refetch(); };

  return <WelcomeDialog onClose={onClose} roster={online ? query.data : undefined} profileTypes={profileTypes} onReload={retry}
    unavailable={!online || query.isError ? (
      <div className="flex flex-wrap items-center gap-2">
        <p role="status" className="w-full text-sm text-muted-foreground">{online ? "Impossible de joindre le serveur." : "Vous êtes hors connexion."}</p>
        {online && <Button type="button" variant="outline" onClick={retry}>Réessayer</Button>}
        {canOpenLocal && <Link href={offlineCheckInPage} className={buttonVariants()}>Ouvrir l’accueil hors ligne</Link>}
      </div>
    ) : <p role="status" className="text-sm text-muted-foreground">Chargement des listes…</p>}
    onSave={async (player, details) => {
      let saved: CheckInPlayer;
      try {
        const response = await apiRequest("POST", `${checkInPath}/${player.id}`, { ...details, revision: player.revision }, AbortSignal.timeout(15_000));
        saved = await response.json();
      } catch (error) {
        const response = error instanceof Error ? /^\d+: (.*)$/.exec(error.message) : null;
        let message: string | undefined;
        try { if (response) message = JSON.parse(response[1]).message; } catch {}
        throw new Error(message || "Impossible d’enregistrer cette fiche. Vérifiez la connexion.");
      }
      await queryClient.cancelQueries({ queryKey, exact: true });
      queryClient.setQueryData<CheckInRoster>(queryKey, old => {
        if (!old) return old;
        const previous = old.players.find(candidate => candidate.id === saved.id)?.details.squadId;
        return {
          ...old,
          players: old.players.map(candidate => candidate.id === saved.id ? saved : candidate),
          teams: old.teams.map(team => previous === saved.details.squadId ? team : {
            ...team,
            members: team.members + Number(team.id === saved.details.squadId) - Number(team.id === previous),
          }),
        };
      });
      void queryClient.invalidateQueries({
        predicate: ({ queryKey: [key] }) => typeof key === "string" &&
          liveQueryPrefixes.roster.some(prefix => matchesQueryPrefix(key, prefix)),
      });
    }} />;
}
