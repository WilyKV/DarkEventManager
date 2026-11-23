import { useState } from "react";
import { Button } from "@/components/ui/button";
import { checkInProfiles, type CheckInDetails, type CheckInPlayer, type CheckInRoster } from "@shared/check-in";
import { WelcomeGuide } from "./welcome-guide";
import { WelcomeBriefing } from "./welcome-briefing";

export type OfflineArrival = {
  player: CheckInPlayer;
  details: CheckInDetails;
  overflowConfirmed: boolean;
};

export function OfflineGroupWelcome({ roster, ids, saving, error, savedIds, onConfirm, onBack, onReplan }: {
  roster: CheckInRoster;
  ids: number[];
  saving: boolean;
  error: string;
  savedIds: number[];
  onConfirm: (arrivals: OfflineArrival[]) => Promise<void>;
  onBack: () => void;
  onReplan: () => Promise<void>;
}) {
  const byId = new Map(roster.players.filter(player => !player.returned).map(player => [player.id, player]));
  const selected = ids.flatMap(id => {
    const player = byId.get(id);
    return player ? [player] : [];
  });
  const [groups, setGroups] = useState(() => {
    const grouped = new Map<number | null, number[]>();
    for (const player of selected) {
      const key = player.details.squadId;
      grouped.set(key, [...(grouped.get(key) ?? []), player.id]);
    }
    return Array.from(grouped.values());
  });
  const [assignments, setAssignments] = useState<OfflineArrival[][]>(() => selected[0]?.type === "staff"
    ? [selected.map(player => ({ player, details: player.details, overflowConfirmed: false }))]
    : []);
  const [plans, setPlans] = useState<OfflineArrival[][]>([]);
  const [briefed, setBriefed] = useState(false);

  if (selected.length !== ids.length || !selected.length) {
    return <>
      <p role="alert">Une fiche n’est plus disponible. Vérifiez la sélection.</p>
      <Button type="button" variant="outline" onClick={savedIds.length ? onReplan : onBack}>Revoir les personnes</Button>
    </>;
  }

  const first = selected[0];
  const nextGroup = first.type === "staff" ? undefined : groups[assignments.length];
  const slot = roster.slots.find(slot => slot.id === first.timeSlotId);
  const groupNames = (players: CheckInPlayer[]) => players.map(player => player.firstName).join(", ");
  if (nextGroup) {
    const players = nextGroup.map(id => byId.get(id)!);
    const leader = players[0];
    const initialDetails = {
      squadId: leader.details.squadId,
      checklist: { squadExplained: players.every(player => player.details.checklist.squadExplained) },
    };
    const assigned = assignments.flat();
    const teams = roster.teams
      .filter(team => team.id === leader.details.squadId ||
        (team.timeSlotId === leader.timeSlotId && (!team.type || team.type === leader.type)))
      .map(team => ({
        ...team,
        members: assigned.reduce((count, plan) => count + Number(plan.details.squadId === team.id)
          - Number(plan.player.details.squadId === team.id), team.members),
      }));

    return <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <p className="font-semibold">Équipe · {groupNames(players)}</p>
        {players.length > 1 && <Button type="button" variant="outline" onClick={() => setGroups([
          ...groups.slice(0, assignments.length), ...nextGroup.map(id => [id]), ...groups.slice(assignments.length + 1),
        ])}>Répartir le groupe</Button>}
      </div>
      <WelcomeGuide key={nextGroup.join(",")} type={leader.type} initialDetails={initialDetails} slot={slot} teams={teams}
        squadOnly groupSize={players.length} sharedArrival allowCapacityOverride saving={false} error=""
        saveLabel="Confirmer l’équipe" onSave={(details, _, overflowConfirmed) => setAssignments([...assignments,
          players.map(player => ({ player, details: {
            ...details, checklist: { ...player.details.checklist, ...details.checklist },
          }, overflowConfirmed })),
        ])} />
      <Button type="button" variant="ghost" className="self-start" onClick={() => {
        if (assignments.length) setAssignments(assignments.slice(0, -1));
        else if (savedIds.length) onReplan();
        else onBack();
      }}>Retour</Button>
    </>;
  }

  if (!briefed) {
    return <WelcomeBriefing type={first.type} slot={slot} arrivals={assignments.flat()} teams={roster.teams}
      onBack={() => {
        if (first.type !== "staff") setAssignments(assignments.slice(0, -1));
        else if (savedIds.length) void onReplan();
        else onBack();
      }} onContinue={completed => {
        if (completed && first.type !== "staff") {
          setAssignments(assignments.map(group => group.map(arrival => ({
            ...arrival, details: { ...arrival.details, checklist: {
              ...arrival.details.checklist, briefingExplained: true,
              ...(first.type === "zombie" && { makeupWaitExplained: true }),
            } },
          }))));
        }
        setBriefed(true);
      }} />;
  }

  const current = assignments[plans.length];
  if (current) {
    const { player, details } = current[0];
    const initialDetails: CheckInDetails = { squadId: details.squadId, checklist: {} };
    for (const item of checkInProfiles[player.type].checklist) {
      if (current.every(arrival => arrival.details.checklist[item])) initialDetails.checklist[item] = true;
    }
    return <WelcomeGuide key={player.id} type={player.type} initialDetails={initialDetails} slot={slot} teams={roster.teams}
      lockSquad review saving={false} error=""
      summary={<p className="break-words text-sm text-muted-foreground">{groupNames(current.map(arrival => arrival.player))}</p>}
      saveLabel={plans.length + 1 < assignments.length ? "Continuer" : "Vérifier les arrivées"}
      onSave={next => {
        const changes: CheckInDetails["checklist"] = {};
        for (const item of checkInProfiles[player.type].checklist) {
          if (next.checklist[item] !== initialDetails.checklist[item]) changes[item] = next.checklist[item];
        }
        setPlans([...plans, current.map(arrival => ({
          ...arrival, details: { ...arrival.details, checklist: { ...arrival.details.checklist, ...changes } },
        }))]);
      }} />;
  }

  const completed = plans.flat();
  const teamNumber = new Map(roster.teams.map(team => [team.id, team.number]));
  return <>
    <ul aria-label="Arrivées à valider" className="min-h-0 divide-y divide-border overflow-y-auto rounded-lg border border-border">
      {completed.map(({ player, details, overflowConfirmed }) => (
        <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="font-medium">{player.firstName} {player.lastName}</span>
          <span className={overflowConfirmed ? "text-amber-500" : "text-muted-foreground"}>
            {details.squadId === null ? "Sans équipe" : `Équipe ${teamNumber.get(details.squadId) ?? details.squadId}`}
            {overflowConfirmed && " · Dépassement confirmé"}
            {savedIds.includes(player.id) && " · Enregistré"}
          </span>
        </li>
      ))}
    </ul>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex shrink-0 flex-wrap gap-2">
      <Button type="button" variant="outline" disabled={saving} onClick={() => {
        if (error) onReplan();
        else setPlans([]);
      }}>{error ? "Actualiser et revoir les fiches restantes" : "Revoir les consignes"}</Button>
      {first.type !== "staff" && !savedIds.length && !error && <Button type="button" variant="outline" disabled={saving}
        onClick={() => { setPlans([]); setBriefed(false); setAssignments([]); }}>Modifier les équipes</Button>}
      <Button type="button" className="flex-1" disabled={saving} loading={saving} onClick={() => void onConfirm(completed)}>
        {error ? "Réessayer" : completed.length === 1 ? "Valider l’arrivée" : `Valider les ${completed.length} arrivées`}
      </Button>
    </div>
  </>;
}
