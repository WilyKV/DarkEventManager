import { useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { checkInProfiles } from "@shared/check-in";
import { normalizePlayerName, type OfflineParticipant, type OfflineSnapshot } from "@shared/zombie-offline";

const byName = new Intl.Collator("fr", { sensitivity: "base" });

export function OfflineSquadRoster({ squads, timeSlots, participants }: Pick<OfflineSnapshot, "squads" | "timeSlots" | "participants">) {
  const [search, setSearch] = useState("");
  const [slot, setSlot] = useState("");
  const words = normalizePlayerName(search).trim().split(/\s+/).filter(Boolean);
  const slotNames = new Map(timeSlots.map(item => [item.id, item.name]));
  const teamIds = new Set(squads.map(squad => squad.id));
  const members = new Map<number | null, OfflineParticipant[]>();
  for (const player of participants) {
    const id = player.state.squadId;
    const key = id !== null && teamIds.has(id) ? id : null;
    if (!members.has(key)) members.set(key, []);
    members.get(key)!.push(player);
  }
  const teams = [...squads].sort((a, b) => a.timeSlotId - b.timeSlotId || a.number - b.number)
    .filter(team => !slot || String(team.timeSlotId) === slot);

  function renderTeam(team: (typeof squads)[number] | null) {
    const title = team ? `Squad ${team.number}` : "Sans squad";
    const all = (members.get(team?.id ?? null) ?? [])
      .filter(player => team || !slot || String(player.timeSlotId) === slot);
    const context = team ? `${checkInProfiles[team.type].label} · ${slotNames.get(team.timeSlotId) ?? "Sans créneau"}` : "";
    const teamMatches = words.every(word => normalizePlayerName(`${title} ${context}`).includes(word));
    const shown = (teamMatches ? [...all] : all.filter(player => {
      const name = normalizePlayerName(`${player.firstName} ${player.lastName}`);
      return words.every(word => name.includes(word));
    })).sort((a, b) => byName.compare(a.lastName, b.lastName) || byName.compare(a.firstName, b.firstName));
    if ((!team && !all.length) || (!teamMatches && !shown.length)) return null;
    const max = team?.maxMembers ?? null;
    const extra = max === null ? 0 : Math.max(0, all.length - max);
    return (
      <details key={team?.id ?? "none"} open={words.length > 0 ? true : undefined} className="group rounded-xl border border-border bg-card">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
          <Users className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{title}</span>
            {context && <span className="block break-words text-xs text-muted-foreground">{context}</span>}
          </span>
          <span className={extra ? "text-sm font-medium text-amber-400" : "text-sm text-muted-foreground"}>
            {all.length}{max === null ? "" : ` / ${max}`}
            {extra > 0 && <span className="block text-xs">+${extra} au-delà du maximum</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 group-open:rotate-180" aria-hidden />
        </summary>
        {shown.length ? <ul className="divide-y divide-border border-t border-border">
          {shown.map(player => (
            <li key={player.id} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-2 text-sm">
              <span className="min-w-0 break-words">{player.firstName} {player.lastName}</span>
              <span className={player.state.arrived && !player.returned ? "text-emerald-400" : "text-muted-foreground"}>
                {player.returned ? "Sorti" : player.state.arrived ? "Arrivé" : "Attendu"}
              </span>
            </li>
          ))}
        </ul> : <p className="border-t border-border p-3 text-sm text-muted-foreground">Aucune personne affectée.</p>}
      </details>
    );
  }

  const cards = [...teams.map(renderTeam), renderTeam(null)].filter(Boolean);
  return (
    <section id="offline-squads" aria-label="Squads hors ligne" className="space-y-3">
      <h2 className="text-xl font-semibold">Squads</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="search" aria-label="Rechercher une squad ou une personne" placeholder="Squad ou nom" value={search}
          onChange={event => setSearch(event.target.value)} className="min-h-11" />
        <select aria-label="Filtrer les squads par créneau" value={slot} onChange={event => setSlot(event.target.value)}
          className="min-h-11 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Tous les créneaux</option>
          {timeSlots.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </div>
      {cards.length ? cards : <p role="status" className="text-sm text-muted-foreground">Aucun résultat.</p>}
    </section>
  );
}
