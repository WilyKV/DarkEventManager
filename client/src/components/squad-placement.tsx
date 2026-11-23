import { useId, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type SquadCapacity = {
  id: number;
  number: number;
  members: number;
  maxMembers: number | null;
};

export function squadPlaces({ members, maxMembers }: SquadCapacity): number {
  return maxMembers === null ? Infinity : Math.max(0, maxMembers - members);
}

export function recommendSquad<T extends SquadCapacity>(teams: readonly T[], seatsNeeded: (id: number) => number): T | undefined {
  let best: T | undefined;
  let smallestGap = Infinity;
  for (const team of teams) {
    const gap = squadPlaces(team) - seatsNeeded(team.id);
    if (gap >= 0 && (gap < smallestGap || !best || (gap === smallestGap && team.number < best.number))) {
      best = team;
      smallestGap = gap;
    }
  }
  return best;
}

export function orderSquads<T extends SquadCapacity>(teams: readonly T[], seatsNeeded: (id: number) => number, firstId?: number): T[] {
  return [...teams].sort((a, b) => Number(b.id === firstId) - Number(a.id === firstId) ||
    Number(squadPlaces(b) >= seatsNeeded(b.id)) - Number(squadPlaces(a) >= seatsNeeded(a.id)) ||
    a.number - b.number);
}

export const placementLabels = (type?: string) => type === "zombie"
  ? { name: "Squad", plural: "Squads", noun: "squad", article: "la squad", of: "de la squad" }
  : { name: "Équipe", plural: "Équipes", noun: "équipe", article: "l’équipe", of: "de l’équipe" };

export type PlacementMember = { id: number; firstName: string; lastName: string };

export function placementMembers(players: readonly (PlacementMember & { squadId: number | null })[]) {
  const groups = new Map<number, PlacementMember[]>();
  for (const player of players) {
    if (player.squadId === null) continue;
    const members = groups.get(player.squadId) ?? [];
    members.push(player);
    groups.set(player.squadId, members);
  }
  return groups;
}

export function SquadPlacementCard({ team, profile, people = [], selected, disabled, label, onSelect }: {
  team: SquadCapacity;
  profile?: string;
  people?: readonly PlacementMember[];
  selected: boolean;
  disabled?: boolean;
  label?: string;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const memberListId = useId();
  const { maxMembers, members } = team;
  const places = squadPlaces(team);
  const filled = maxMembers === null ? 0 : Math.min(100, 100 * members / Math.max(1, maxMembers));
  const name = `${placementLabels(profile).name} ${team.number}`;

  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm transition-colors",
      selected ? "border-primary ring-1 ring-primary" : label ? "border-primary/40" : "border-border")}>
      <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect}
        className={cn("flex min-h-[76px] w-full items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4",
          selected ? "bg-primary/10" : "hover:bg-muted/60", disabled && "cursor-not-allowed opacity-70")}>
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground")}>
          {selected ? <Check className="size-5" aria-hidden /> : <Users className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-tight">{name}</span>
          {label && <span className="text-xs font-semibold text-primary">{label}</span>}
        </span>
        <span className={cn("rounded-full px-2 py-1 text-right text-xs font-semibold",
          places === 0 ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>
          {maxMembers === null ? "Sans limite de places" : places === 0 ? "Complète" : `${places} ${places === 1 ? "place libre" : "places libres"}`}
        </span>
      </button>
      {maxMembers !== null && (
        <div aria-hidden className="mx-3 h-1.5 overflow-hidden rounded-full bg-muted sm:mx-4">
          <div className={cn("h-full rounded-full", places === 0 ? "bg-muted-foreground/60" : "bg-emerald-500")} style={{ width: `${filled}%` }} />
        </div>
      )}
      <button type="button" aria-expanded={expanded} aria-controls={memberListId}
        aria-label={`Membres · ${name} · ${members}`} data-testid={`button-toggle-squad-${team.id}`}
        onClick={() => setExpanded(!expanded)}
        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-4">
        <span className="font-bold tabular-nums">{maxMembers === null ? members : `${members} / ${maxMembers}`}</span>
        <span className="flex-1 text-muted-foreground"> {members === 1 ? "membre" : "membres"}</span>
        <ChevronDown className={cn("size-4 shrink-0 transition-transform", expanded && "rotate-180")} aria-hidden />
      </button>
      <div id={memberListId} hidden={!expanded} className="border-t bg-muted/30 px-3 py-2 sm:px-4">
        {expanded && (people.length ? (
          <ul aria-label={`Membres · ${name}`} className="divide-y divide-border text-sm">
            {[...people].sort((a, b) => a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr"))
              .map(person => <li className="break-words py-1.5" key={person.id} data-testid={`participant-${person.id}`}>{person.firstName} {person.lastName}</li>)}
          </ul>
        ) : <p className="text-sm text-muted-foreground">{members ? "Détail indisponible" : "Aucun membre"}</p>)}
      </div>
    </div>
  );
}
