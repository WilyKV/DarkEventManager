import { useState } from "react";
import { Clapperboard, Gift } from "lucide-react";
import { activeWelcomePoints, defaultWelcomeChecklist, type WelcomeChecklist } from "@shared/welcome-checklist";
import { checkInProfiles, type CheckInDetails, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { Button } from "@/components/ui/button";
import { WelcomeCheckCard, welcomeInstructions } from "./welcome-guide";
import { WelcomeChecklistEditor } from "./welcome-checklist-editor";
import { OtherWelcomeNote, WelcomeSchedule } from "./welcome-schedule";

export function welcomeReminderDefaults(type: CheckInType, squadId: number | null, settings = defaultWelcomeChecklist, waveId?: number) {
  const items = checkInProfiles[type].checklist.filter(key =>
    (key !== "squadExplained" || squadId !== null) && (type !== "zombie" || !settings.hidden.includes(key)));
  return {
    checklist: Object.fromEntries(items.map(key => [key, true])),
    welcomeChecks: type === "zombie" ? Object.fromEntries(activeWelcomePoints(settings, waveId).map(point => [point.id, true])) : undefined,
  };
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
  return <section className="space-y-3 border-t border-border pt-4" aria-labelledby="welcome-reminders-title">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="welcome-reminders-title" className="text-xl font-semibold">Pense-bête</h3>
      {type === "zombie" && (canEdit || editing) && <Button type="button" variant="outline" disabled={saving}
        aria-expanded={editing} onClick={() => setEditing(!editing)}>
        {editing ? "Fermer l’éditeur" : "Modifier la checklist"}
      </Button>}
    </div>
    {editing && <WelcomeChecklistEditor wave={slot} settings={settings} canEdit={Boolean(canEdit)} onClose={() => { setEditing(false); onChange(details); }} />}
    {type === "staff" && <WelcomeSchedule slot={slot} staff />}
    <OtherWelcomeNote slot={slot} />
    {(items.length > 0 || extra.length > 0) && <ul aria-label="Étapes de l’accueil" className="grid items-start gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(key => {
        const instruction = welcomeInstructions[key];
        const title = key === "squadExplained" ? (type === "zombie" ? "Présenter la squad" : "Présenter l’équipe")
          : key === "briefingExplained" && type === "zombie" ? "Présentation et horaires" : instruction.title;
        return <WelcomeCheckCard compact key={key} title={title} icon={key === "briefingExplained" && type === "zombie" ? Clapperboard : instruction.icon} disabled={saving}
          checked={details.checklist[key] ?? true}
          onChange={checked => onChange({ ...details, checklist: { ...details.checklist, [key]: checked } })}>
          {key === "briefingExplained" ? <>
            {type === "zombie" && <p>Vérifiez que le groupe a vu la vidéo ou reçu les consignes.</p>}
            <WelcomeSchedule slot={slot} compact />
            {!slot?.briefingTime && <p>Horaire du briefing à vérifier avec l’organisation.</p>}
            {team?.briefing?.trim() && <p className="whitespace-pre-wrap break-words">{team.briefing}</p>}
          </> : key === "mealTicketGiven" ? <>
            <p>Remettre la carte et indiquer où prendre le repas.</p>
            <WelcomeSchedule slot={slot} phases={["meal"]} compact />
          </> : <p>{key === "squadExplained" && team
            ? `${type === "zombie" ? "Squad" : "Équipe"} ${team.number} · Indiquer où retrouver le groupe.` : instruction.text}</p>}
        </WelcomeCheckCard>;
      })}
      {extra.map(point => <WelcomeCheckCard compact key={point.id} title={point.title} icon={Gift} disabled={saving}
        checked={details.welcomeChecks?.[point.id] ?? true}
        onChange={checked => onChange({ ...details, welcomeChecks: { ...details.welcomeChecks, [point.id]: checked } })}>
        {point.note && <p>{point.note}</p>}
      </WelcomeCheckCard>)}
    </ul>}
  </section>;
}
