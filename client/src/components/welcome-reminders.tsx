import { useState } from "react";
import { Check, ChevronDown, Clapperboard, Gift, Utensils, type LucideIcon } from "lucide-react";
import { activeWelcomePoints, defaultWelcomeChecklist, welcomeVideoCheckId, type WelcomeChecklist } from "@shared/welcome-checklist";
import { checkInProfiles, type CheckInDetails, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { welcomeInstructions } from "./welcome-guide";
import { WelcomeChecklistEditor } from "./welcome-checklist-editor";
import { OtherWelcomeNote, WelcomeSchedule } from "./welcome-schedule";
import { normalizeWelcomeTime } from "./zombie-welcome-timeline";

export function welcomeReminderDefaults(type: CheckInType, squadId: number | null, settings = defaultWelcomeChecklist, waveId?: number, videoWatched = false): Pick<CheckInDetails, "checklist" | "welcomeChecks"> {
  const items = checkInProfiles[type].checklist.filter(key =>
    (key !== "squadExplained" || squadId !== null) && (type !== "zombie" || !settings.hidden.includes(key)));
  return {
    checklist: Object.fromEntries(items.map(key => [key, true])),
    welcomeChecks: type === "zombie" ? {
      ...Object.fromEntries(activeWelcomePoints(settings, waveId).map(point => [point.id, true])),
      ...(!settings.hideVideo && { [welcomeVideoCheckId]: videoWatched }),
    } : undefined,
  };
}

function ReminderTile({ label, title, value, icon: Icon, checked, disabled, onChange }: {
  label: string; title: string; value?: string; icon: LucideIcon;
  checked: boolean; disabled: boolean; onChange: (checked: boolean) => void;
}) {
  return <li className="min-w-0">
    <label className="relative block aspect-square cursor-pointer overflow-hidden rounded-xl border border-border bg-card
      text-center transition-colors hover:border-primary/50 focus-within:ring-2 focus-within:ring-ring
      has-[:checked]:border-emerald-600/50 has-[:checked]:bg-emerald-500/10 has-[:disabled]:cursor-wait">
      <input type="checkbox" className="peer sr-only" aria-label={label} checked={checked} disabled={disabled}
        onChange={event => onChange(event.target.checked)} />
      <Icon aria-hidden className="pointer-events-none absolute -bottom-1 -right-1 size-[68%] text-muted-foreground/[0.15]" strokeWidth={1.25} />
      <span aria-hidden className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-md border border-muted-foreground/50 bg-card
        peer-checked:border-emerald-700 peer-checked:bg-emerald-700 peer-checked:text-white">
        <Check className={cn("size-3.5", !checked && "invisible")} />
      </span>
      <span className={cn("relative flex h-full flex-col items-center justify-center px-1.5", value ? "pt-5" : "pt-3")}>
        <span className={cn("break-words font-semibold leading-tight text-foreground",
          value ? "absolute left-2 right-8 top-2 text-left text-xs" : "text-sm")}>{title}</span>
        {value && <strong className={cn("leading-none tabular-nums", /^\d/.test(value) ? "text-2xl sm:text-3xl" : "text-sm")}>{value}</strong>}
      </span>
    </label>
  </li>;
}

export function WelcomeReminders({ type, details, slot, team, settings = defaultWelcomeChecklist, canEdit, saving, onChange }: {
  type: CheckInType;
  details: CheckInDetails;
  slot?: CheckInRoster["slots"][number];
  team?: CheckInRoster["teams"][number];
  settings?: WelcomeChecklist;
  canEdit?: boolean;
  saving: boolean;
  onChange: (details: CheckInDetails) => void;
}) {
  const [editing, setEditing] = useState(false);
  const defaults = welcomeReminderDefaults(type, details.squadId, settings, slot?.id);
  const items = checkInProfiles[type].checklist.filter(key => defaults.checklist[key]);
  const extra = type === "zombie" ? activeWelcomePoints(settings, slot?.id) : [];
  const showVideo = type === "zombie" && !settings.hideVideo;
  const watched = details.welcomeChecks?.[welcomeVideoCheckId] ?? false;
  const placement = type === "zombie" ? "Squad" : "Équipe";
  const labels = {
    squadExplained: { title: placement, value: team?.number.toString() },
    briefingExplained: { title: "Briefing", value: normalizeWelcomeTime(slot?.briefingTime) ?? "À vérifier" },
    mealTicketGiven: { title: "Repas", value: normalizeWelcomeTime(slot?.mealTime) },
    waterBottleGiven: { title: "Eau" },
    makeupWaitExplained: { title: "Maquillage" },
    mapGiven: { title: "Plan" },
  };

  function changeExtra(id: string, checked: boolean) {
    onChange({ ...details, welcomeChecks: { ...details.welcomeChecks, [id]: checked } });
  }

  return <section className="space-y-3 border-t border-border pt-4" aria-labelledby="welcome-reminders-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="welcome-reminders-title" className="text-xl font-semibold">Pense-bête</h3>
      {type === "zombie" && (canEdit || editing) && <Button type="button" variant="outline" disabled={saving} aria-expanded={editing}
        onClick={() => setEditing(!editing)}>{editing ? "Fermer l’éditeur" : "Modifier la checklist"}</Button>}
    </div>
    {editing && <WelcomeChecklistEditor wave={slot} settings={settings} canEdit={Boolean(canEdit)} onClose={() => { setEditing(false); onChange(details); }} />}
    {(items.length > 0 || extra.length > 0 || showVideo) && <ul aria-label="Étapes de l’accueil"
      className="grid grid-cols-[repeat(2,minmax(0,8rem))] gap-2 min-[390px]:grid-cols-[repeat(3,minmax(0,8rem))] sm:grid-cols-[repeat(4,minmax(0,8rem))]">
      {items.map(key => {
        const instruction = welcomeInstructions[key];
        return <ReminderTile key={key} label={key === "squadExplained" ? placement : instruction.title}
          {...labels[key]} icon={key === "mealTicketGiven" ? Utensils : instruction.icon} disabled={saving}
          checked={details.checklist[key] ?? true}
          onChange={checked => onChange({ ...details, checklist: { ...details.checklist, [key]: checked } })} />;
      })}
      {showVideo && <ReminderTile label="Vidéo visionnée" title="Vidéo" value={watched ? "Visionnée" : "À vérifier"}
        icon={Clapperboard} checked={watched} disabled={saving} onChange={checked => changeExtra(welcomeVideoCheckId, checked)} />}
      {extra.map(point => <ReminderTile key={point.id} label={point.title} title={point.title} icon={Gift}
        checked={details.welcomeChecks?.[point.id] ?? true} disabled={saving} onChange={checked => changeExtra(point.id, checked)} />)}
    </ul>}
    {(slot || team?.briefing?.trim() || extra.some(point => point.note)) && (
      <details className="rounded-xl border border-border bg-card px-3 text-sm">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-medium">
          <ChevronDown className="size-4" aria-hidden /> Horaires et consignes détaillés
        </summary>
        <div className="space-y-2 pb-3">
          <WelcomeSchedule slot={slot} compact staff={type === "staff"}
            phases={items.includes("mealTicketGiven") ? ["briefing", "game", "exit", "meal"] : undefined} />
          {team?.briefing?.trim() && <p className="whitespace-pre-wrap break-words">{team.briefing}</p>}
          <OtherWelcomeNote slot={slot} />
          {extra.filter(point => point.note).map(point => <p key={point.id}><strong>{point.title}</strong> · <span>{point.note}</span></p>)}
        </div>
      </details>
    )}
  </section>;
}
