import { Info } from "lucide-react";
import { timeSlotHourFields, type TimeSlotPhase, type WelcomeTimeSlot } from "@shared/time-slot-notes";

const labels = { meal: "Repas", briefing: "Briefing", game: "Début du jeu", exit: "Sortie" };
const briefingPhases = ["briefing", "game", "exit"] as const;

export function WelcomeSchedule({ slot, phases = briefingPhases, notesOnly = false }: {
  slot?: WelcomeTimeSlot | null;
  phases?: readonly TimeSlotPhase[];
  notesOnly?: boolean;
}) {
  if (!slot) return null;

  const rows = phases.map(phase => ({
    phase,
    time: slot[timeSlotHourFields[phase]],
    note: slot.welcomeNotes?.[phase]?.trim(),
  })).filter(({ time, note }) => note || (!notesOnly && time));
  if (rows.length === 0) return null;

  return (
    <dl className="divide-y divide-border/75 rounded-lg bg-muted/60 px-3 text-sm">
      {rows.map(({ phase, time, note }) => (
        <div key={phase} className="grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1 py-2.5">
          <dt className="font-medium">{labels[phase]}</dt>
          {time && <dd className="font-semibold tabular-nums text-right">{time}</dd>}
          {note && <dd className="col-span-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-muted-foreground">{note}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function OtherWelcomeNote({ slot }: { slot?: WelcomeTimeSlot | null }) {
  const note = slot?.welcomeNotes?.other?.trim();
  if (!note) return null;

  return (
    <section aria-label="Autre" className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">Autre</p>
        <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{note}</p>
      </div>
    </section>
  );
}
