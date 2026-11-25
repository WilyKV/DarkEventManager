import { ZombieWelcomeVideo } from "./zombie-welcome-video";
import { normalizeWelcomeTime } from "./zombie-welcome-timeline";
import type { WelcomeChecklist } from "@shared/welcome-checklist";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { type CheckInDetails, type CheckInPlayer, type CheckInRoster } from "@shared/check-in";
import { WelcomeGuide } from "./welcome-guide";
import { placementLabels, placementMembers } from "./squad-placement";
import { WelcomeBriefing } from "./welcome-briefing";

export type OfflineArrival = {
  player: CheckInPlayer;
  details: CheckInDetails;
  overflowConfirmed: boolean;
};

export function OfflineGroupWelcome({ roster, checklist, ids, saving, error, savedIds, savedSquadId, onConfirm, onBack, onReplan }: {
  roster: CheckInRoster;
  checklist?: { settings: WelcomeChecklist; canEdit: boolean };
  ids: number[];
  saving: boolean;
  error: string;
  savedIds: number[];
  savedSquadId?: number;
  onConfirm: (arrivals: OfflineArrival[]) => Promise<void>;
  onBack: () => void;
  onReplan: () => Promise<void>;
}) {
  const byId = new Map(roster.players.filter(player => !player.returned).map(player => [player.id, player]));
  const selected = ids.flatMap(id => {
    const player = byId.get(id);
    return player ? [player] : [];
  });
  const [assignment, setAssignment] = useState<OfflineArrival[] | undefined>(() => selected[0]?.type === "staff"
    ? selected.map(player => ({ player, details: player.details, overflowConfirmed: false }))
    : undefined);
  const [completed, setCompleted] = useState<OfflineArrival[]>();
  const [briefed, setBriefed] = useState(false);

  if (selected.length !== ids.length || !selected.length) {
    return <>
      <p role="alert">Une fiche n’est plus disponible. Vérifiez la sélection.</p>
      <Button type="button" variant="outline" onClick={savedIds.length ? onReplan : onBack}>Revoir les personnes</Button>
    </>;
  }

  const first = selected[0];
  const words = placementLabels(first.type);
  const slot = roster.slots.find(slot => slot.id === first.timeSlotId);
  const groupNames = selected.map(player => player.firstName).join(", ");
  if (!assignment) {
    const teams = roster.teams.filter(team => team.timeSlotId === first.timeSlotId &&
      (!team.type || team.type === first.type) && (savedSquadId === undefined || team.id === savedSquadId));
    const currentSquadId = first.details.squadId;
    const squadId = teams.some(team => team.id === currentSquadId) && selected.every(player => player.details.squadId === currentSquadId)
      ? currentSquadId : null;
    const initialDetails = {
      squadId,
      checklist: { squadExplained: squadId !== null && selected.every(player => player.details.checklist.squadExplained) },
    };
    const membersByTeam = placementMembers(roster.players.map(player => ({ ...player, squadId: player.details.squadId })));
    const selectedByTeam = placementMembers(selected.map(player => ({ ...player, squadId: player.details.squadId })));

    return <>
      <p className="shrink-0 break-words font-semibold">{words.name} · {groupNames}</p>
      {savedSquadId !== undefined && <p className="text-sm text-muted-foreground">
        Les fiches restantes rejoindront {words.article} déjà confirmée pour le groupe.
      </p>}
      <WelcomeGuide type={first.type} initialDetails={initialDetails} slot={slot} teams={teams} membersByTeam={membersByTeam}
        squadOnly requirePlacement={selected.length > 1 || savedSquadId !== undefined} groupSize={selected.length} sharedArrival allowCapacityOverride saving={false} error=""
        groupSeatsNeeded={id => selected.length - (selectedByTeam.get(id)?.length ?? 0)}
        saveLabel={`Confirmer ${words.article}`} onSave={(details, _, overflowConfirmed) => setAssignment(
          selected.map(player => ({ player, details: {
            ...details, checklist: { ...player.details.checklist, ...details.checklist },
          }, overflowConfirmed })),
        )} />
      <Button type="button" variant="ghost" className="self-start" onClick={savedIds.length ? onReplan : onBack}>Retour</Button>
    </>;
  }

  if (!briefed) {
    const back = () => {
      if (first.type !== "staff") setAssignment(undefined);
      else if (savedIds.length) void onReplan();
      else onBack();
    };
    const continueWelcome = () => setBriefed(true);
    const team = roster.teams.find(item => item.id === assignment[0]?.details.squadId);
    const briefing = normalizeWelcomeTime(slot?.briefingTime);
    const start = normalizeWelcomeTime(slot?.gameTime);
    const end = normalizeWelcomeTime(slot?.exitTime);
    if (first.type === "zombie" && team && briefing && start && end) {
      const otherTimes = roster.slots.flatMap(item => {
        const time = normalizeWelcomeTime(item.briefingTime);
        const zombieWave = item.type === "zombie" || (!item.type && roster.players.some(player => player.type === "zombie" && player.timeSlotId === item.id));
        return zombieWave && item.id !== slot?.id && time ? [time] : [];
      });
      const squadCount = roster.teams.filter(item => item.timeSlotId === team.timeSlotId && (!item.type || item.type === "zombie")).length;
      return <ZombieWelcomeVideo briefing={briefing}
        start={start} end={end} squad={team.number} otherTimes={otherTimes} squadCount={squadCount} onBack={back} onContinue={continueWelcome} />;
    }
    return <WelcomeBriefing type={first.type} slot={slot} arrivals={assignment} teams={roster.teams} onBack={back} onContinue={continueWelcome} />;
  }

  if (!completed) {
    const { player, details } = assignment[0];
    const initialDetails: CheckInDetails = { squadId: details.squadId, checklist: {} };
    const settings = checklist?.settings ?? roster.welcomeChecklist;
    return <WelcomeGuide key={player.id} type={player.type} initialDetails={initialDetails} slot={slot} teams={roster.teams}
      checklistSettings={settings} canEditChecklist={checklist?.canEdit}
      lockSquad review defaultChecked saving={false} error=""
      summary={<p className="break-words text-sm text-muted-foreground">{groupNames}</p>}
      saveLabel="Vérifier les arrivées"
      onSave={next => {
        setCompleted(assignment.map(arrival => ({
          ...arrival, details: { ...arrival.details, checklist: { ...arrival.details.checklist, ...next.checklist },
            ...(next.welcomeChecks && { welcomeChecks: { ...arrival.details.welcomeChecks, ...next.welcomeChecks } }),
          },
        })));
      }} />;
  }

  const teamNumber = new Map(roster.teams.map(team => [team.id, team.number]));
  return <>
    <ul aria-label="Arrivées à valider" className="min-h-0 divide-y divide-border overflow-y-auto rounded-lg border border-border">
      {completed.map(({ player, details, overflowConfirmed }) => (
        <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <span className="font-medium">{player.firstName} {player.lastName}</span>
          <span className={overflowConfirmed ? "text-amber-500" : "text-muted-foreground"}>
            {details.squadId === null ? `Sans ${words.noun}` : `${words.name} ${teamNumber.get(details.squadId) ?? details.squadId}`}
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
        else setCompleted(undefined);
      }}>{error ? "Actualiser et revoir les fiches restantes" : "Revoir les consignes"}</Button>
      {first.type !== "staff" && !savedIds.length && !error && <Button type="button" variant="outline" disabled={saving}
        onClick={() => { setCompleted(undefined); setBriefed(false); setAssignment(undefined); }}>Modifier {words.article}</Button>}
      <Button type="button" className="flex-1" disabled={saving} loading={saving} onClick={() => void onConfirm(completed)}>
        {error ? "Réessayer" : completed.length === 1 ? "Valider l’arrivée" : `Valider les ${completed.length} arrivées`}
      </Button>
    </div>
  </>;
}
