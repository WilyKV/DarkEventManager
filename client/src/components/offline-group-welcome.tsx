import type { TabletPresentation } from "./welcome-tablet-transfer";
import { ZombieWelcomeVideo } from "./zombie-welcome-video";
import { normalizeWelcomeTime } from "./zombie-welcome-timeline";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
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

export type WelcomePresentationResult = { tablet?: TabletPresentation; videoWatched?: boolean };

export function OfflineGroupWelcome({ roster, ids, saving, error, savedIds, savedSquadId, onConfirm, onBack, onReplan }: {
  roster: CheckInRoster;
  ids: number[];
  saving: boolean;
  error: string;
  savedIds: number[];
  savedSquadId?: number;
  onConfirm: (arrivals: OfflineArrival[], result: WelcomePresentationResult) => Promise<void>;
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
  const [pending, setPending] = useState<WelcomePresentationResult>();

  const first = selected[0];
  const words = placementLabels(first?.type);
  const slot = roster.slots.find(slot => slot.id === first?.timeSlotId);
  const groupNames = selected.map(player => player.firstName).join(", ");
  const squadStoragePrefix = `welcome-closed-squad:${roster.eventDay ?? "event"}:${slot?.id ?? "none"}:`;
  const [closedSquads, setClosedSquads] = useState(() => new Set(roster.teams.flatMap(team => {
    if (first?.type !== "zombie" || team.timeSlotId !== first.timeSlotId) return [];
    try { return localStorage.getItem(squadStoragePrefix + team.id) === "1" ? [team.id] : []; }
    catch { return []; }
  })));

  function toggleSquad(id: number) {
    const next = new Set(closedSquads);
    const key = squadStoragePrefix + id;
    if (next.has(id)) {
      next.delete(id);
      try { localStorage.removeItem(key); } catch {}
    } else {
      next.add(id);
      try { localStorage.setItem(key, "1"); } catch {}
    }
    setClosedSquads(next);
  }

  if (selected.length !== ids.length || !selected.length) {
    return <>
      <p role="alert">Une fiche n’est plus disponible. Vérifiez la sélection.</p>
      <Button type="button" variant="outline" onClick={savedIds.length ? onReplan : onBack}>Revoir les personnes</Button>
    </>;
  }

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
      <div className="shrink-0 space-y-1 rounded-2xl border border-border bg-muted/50 p-4">
        <h3 className="text-lg font-semibold">Choisir {words.article}</h3>
        <p className="break-words text-sm text-muted-foreground">{groupNames} · Étape réservée au staff</p>
      </div>
      {savedSquadId !== undefined && <p className="text-sm text-muted-foreground">
        Les fiches restantes rejoindront {words.article} déjà confirmée pour le groupe.
      </p>}
      <WelcomeGuide type={first.type} initialDetails={initialDetails} slot={slot} teams={teams} membersByTeam={membersByTeam}
        squadOnly closedSquads={first.type === "zombie" ? closedSquads : undefined}
        onToggleSquad={first.type === "zombie" ? toggleSquad : undefined} requirePlacement={selected.length > 1 || savedSquadId !== undefined} groupSize={selected.length} sharedArrival allowCapacityOverride saving={false} error=""
        groupSeatsNeeded={id => selected.length - (selectedByTeam.get(id)?.length ?? 0)}
        saveLabel={`Confirmer ${words.article}`} onSave={(details, _, overflowConfirmed) => setAssignment(
          selected.map(player => ({ player, details: {
            ...details, checklist: { ...player.details.checklist, ...details.checklist },
          }, overflowConfirmed })),
        )} />
      <Button type="button" variant="ghost" className="self-start" onClick={savedIds.length ? onReplan : onBack}>Retour</Button>
    </>;
  }

  if (!pending) {
    const back = () => {
      if (first.type !== "staff") setAssignment(undefined);
      else if (savedIds.length) void onReplan();
      else onBack();
    };
    const continueWelcome = (result: WelcomePresentationResult) => {
      setPending(result);
      void onConfirm(assignment, result);
    };
    const team = roster.teams.find(item => item.id === assignment[0]?.details.squadId);
    const briefing = normalizeWelcomeTime(slot?.briefingTime);
    const start = normalizeWelcomeTime(slot?.gameTime);
    const end = normalizeWelcomeTime(slot?.exitTime);
    if (first.type === "zombie" && team && briefing && start && end) {
      const otherTimes = roster.slots.flatMap(item => {
        const time = normalizeWelcomeTime(item.briefingTime);
        const zombieWave = item.type === "zombie" || (!item.type && roster.players.some(player => player.type === "zombie" && player.timeSlotId === item.id));
        return zombieWave && item.id !== slot?.id && time && time !== briefing ? [time] : [];
      });
      const squadCount = roster.teams.filter(item => item.timeSlotId === team.timeSlotId && (!item.type || item.type === "zombie")).length;
      const presentation = { briefing, start, end, squad: team.number, otherTimes: Array.from(new Set(otherTimes)).slice(0, 8), squadCount };
      return <ZombieWelcomeVideo {...presentation} autoContinue onBack={back} onContinue={videoWatched => continueWelcome({ videoWatched })}
        onTablet={() => continueWelcome({ tablet: presentation })} />;
    }
    return <WelcomeBriefing type={first.type} slot={slot} arrivals={assignment} teams={roster.teams} onBack={back} onContinue={() => continueWelcome({})} />;
  }

  return <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
    {saving ? <p role="status">Enregistrement des arrivées…</p> : <>
      <p role="alert">{error || "Impossible d’enregistrer les arrivées."}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void onConfirm(assignment, pending)}>Réessayer</Button>
        <Button type="button" variant="outline" onClick={() => void onReplan()}>Actualiser et revoir les fiches restantes</Button>
      </div>
    </>}
  </div>;
}
