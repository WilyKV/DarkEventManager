import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkInProfiles, type CheckInDetails, type CheckInPlayer, type CheckInRoster } from "@shared/check-in";
import { WelcomeGuide } from "./welcome-guide";

export type OfflineArrival = {
  player: CheckInPlayer;
  details: CheckInDetails;
  overflowConfirmed: boolean;
};

export function OfflineGroupWelcome({ roster, ids, saving, error, onConfirm }: {
  roster: CheckInRoster;
  ids: number[];
  saving: boolean;
  error: string;
  onConfirm: (arrivals: OfflineArrival[]) => Promise<void>;
}) {
  const [plans, setPlans] = useState<OfflineArrival[][]>([]);
  const selected = roster.players.filter(player => ids.includes(player.id) && !player.returned);
  const grouped = new Map<string, CheckInPlayer[]>();
  for (const player of selected) {
    const key = [player.type, player.timeSlotId, player.details.squadId].join(":");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(player);
  }
  const groups = Array.from(grouped.values());
  const current = groups[plans.length];
  if (selected.length !== ids.length || !selected.length) {
    return <p role="alert">Une fiche n’est plus disponible. Fermez l’accueil et vérifiez la sélection.</p>;
  }

  const completed = plans.flat();
  if (!current) {
    const teamNumber = new Map(roster.teams.map(team => [team.id, team.number]));
    return (
      <>
        <ul aria-label="Arrivées à valider" className="min-h-0 divide-y divide-border overflow-y-auto rounded-lg border border-border">
          {completed.map(({ player, details, overflowConfirmed }) => (
            <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <span className="font-medium">{player.firstName} {player.lastName}</span>
              <span className={overflowConfirmed ? "text-amber-400" : "text-muted-foreground"}>
                {details.squadId === null ? "Sans squad" : `Squad ${teamNumber.get(details.squadId)}`}
                {overflowConfirmed && " · Dépassement confirmé"}
              </span>
            </li>
          ))}
        </ul>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => setPlans([])}>Revoir les consignes</Button>
          <Button type="button" className="flex-1" disabled={saving} loading={saving} onClick={() => void onConfirm(completed)}>
            {completed.length === 1 ? "Valider l’arrivée" : `Valider les ${completed.length} arrivées`}
          </Button>
        </div>
      </>
    );
  }

  const first = current[0];
  const initialDetails: CheckInDetails = { squadId: first.details.squadId, checklist: {} };
  for (const item of checkInProfiles[first.type].checklist) {
    if (current.every(player => player.details.checklist[item])) initialDetails.checklist[item] = true;
  }
  const teams = roster.teams
    .filter(team => team.id === first.details.squadId || (team.type === first.type && team.timeSlotId === first.timeSlotId))
    .map(team => ({
      ...team,
      members: completed.reduce((count, plan) => count + Number(plan.details.squadId === team.id)
        - Number(plan.player.details.squadId === team.id), team.members),
    }));
  return (
    <WelcomeGuide key={first.id} type={first.type} initialDetails={initialDetails}
      slot={roster.slots.find(slot => slot.id === first.timeSlotId)} teams={teams}
      groupSize={current.length} sharedArrival allowCapacityOverride saving={saving} error=""
      summary={<p className="break-words text-sm text-muted-foreground">
        {current.map(player => `${player.firstName} ${player.lastName}`).join(", ")}
      </p>}
      saveLabel={plans.length + 1 < groups.length ? "Continuer vers les autres consignes" : "Vérifier les arrivées"}
      onSave={(details, _, overflowConfirmed) =>
        setPlans(previous => [...previous, current.map(player => ({ player, details, overflowConfirmed }))])}
    />
  );
}
