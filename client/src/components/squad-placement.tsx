import { Check, Users } from "lucide-react";
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

export function SquadPlacementCard({ team, selected, disabled, label, onSelect }: {
  team: SquadCapacity;
  selected: boolean;
  disabled?: boolean;
  label?: string;
  onSelect: () => void;
}) {
  const { maxMembers, members } = team;
  const places = squadPlaces(team);
  const filled = maxMembers === null ? 0 : Math.min(100, 100 * members / Math.max(1, maxMembers));

  return (
    <button type="button" aria-pressed={selected} disabled={disabled} onClick={onSelect}
      className={cn("block w-full rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected ? "border-primary bg-primary/10" : label ? "border-primary/50 bg-primary/5 hover:border-primary" : "border-border bg-background hover:border-primary/60",
        disabled && "cursor-not-allowed bg-muted/35 hover:border-border")}>
      <span className="flex items-start gap-2">
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">Équipe {team.number}</span>
          {label && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{label}</span>}
        </span>
        <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/60")}>
          {selected && <Check className="size-3.5" aria-hidden />}
        </span>
      </span>
      <span className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground">
          <Users className="size-3.5" aria-hidden />
          {maxMembers === null ? members : `${members} / ${maxMembers}`} {members === 1 ? "affecté" : "affectés"}
        </span>
        <span className={cn("font-semibold", places > 0 ? "text-foreground" : "text-muted-foreground")}>
          {maxMembers === null ? "Sans limite de places" : places === 0 ? "Complète" : `${places} ${places === 1 ? "place libre" : "places libres"}`}
        </span>
      </span>
      {maxMembers !== null && (
        <span aria-hidden className="mt-2 block h-1.5 overflow-hidden rounded-full bg-muted">
          <span className={cn("block h-full rounded-full", places === 0 ? "bg-muted-foreground/60" : "bg-primary")} style={{ width: `${filled}%` }} />
        </span>
      )}
    </button>
  );
}
