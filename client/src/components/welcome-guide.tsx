import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Check, Droplet, Map, Paintbrush, Ticket, Users } from "lucide-react";
import { checkInProfiles, type ChecklistItem, type CheckInDetails, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { zombieChecklist } from "@shared/zombie-offline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const instructions = {
  squadExplained: {
    title: "Présenter l’équipe",
    icon: Users,
    text: "Annoncez le numéro de l’équipe et indiquez où retrouver ses coéquipiers après le briefing.",
  },
  briefingExplained: {
    title: "Annoncer les horaires",
    icon: CalendarClock,
    text: "Demandez au joueur d’être prêt à l’heure du briefing. À la fin du jeu, il doit repasser au stand Arrivée pour confirmer son retour.",
  },
  mealTicketGiven: {
    title: "Remettre le ticket repas",
    icon: Ticket,
    text: "Donnez le ticket repas et indiquez qu’il est à utiliser à la buvette.",
  },
  waterBottleGiven: {
    title: "Donner la bouteille d’eau",
    icon: Droplet,
    text: "Remettez une bouteille d’eau. Indiquez les jerricans où la remplir avant de partir en jeu.",
  },
  makeupWaitExplained: {
    title: "Orienter vers le maquillage",
    icon: Paintbrush,
    text: "Montrez le stand de maquillage. Demandez au joueur d’y présenter son badge, puis d’attendre son tour en gardant l’heure du briefing en tête.",
  },
  mapGiven: {
    title: "Proposer une carte",
    icon: Map,
    text: "Proposez une carte au joueur s’il souhaite reconnaître le terrain. Rappelez-lui de revenir pour le briefing.",
  },
};

type WelcomeSlot = CheckInRoster["slots"][number];
type WelcomeTeam = CheckInRoster["teams"][number];

interface WelcomeGuideProps {
  type: CheckInType;
  initialDetails: CheckInDetails;
  slot?: WelcomeSlot;
  teams: WelcomeTeam[];
  review?: boolean;
  summary?: ReactNode;
  saving: boolean;
  error: string;
  onReload?: () => void;
  onSave: (details: CheckInDetails) => void;
  saveLabel: string;
}

export function WelcomeGuide({ type, initialDetails, slot, teams, review, summary, saving, error, onReload, onSave, saveLabel }: WelcomeGuideProps) {
  const items = checkInProfiles[type].checklist;
  const [index, setIndex] = useState(review ? items.length : 0);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(initialDetails);
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const item = items[index];
  const stage = item === undefined ? undefined : instructions[item];
  const complete = item !== undefined && Boolean(details.checklist[item]);
  const canConfirm = item !== "squadExplained" || details.squadId !== null;
  const selectedTeam = teams.find(team => team.id === details.squadId);

  useEffect(() => {
    if (scroll.current) scroll.current.scrollTop = 0;
    heading.current?.focus({ preventScroll: true });
  }, [index]);

  function next() {
    setIndex(editing ? items.length : index + 1);
    setEditing(false);
  }

  function mark(key: ChecklistItem, value: boolean) {
    setDetails(previous => ({ ...previous, checklist: { ...previous.checklist, [key]: value } }));
    next();
  }

  function showSummary() {
    setIndex(items.length);
    setEditing(false);
  }

  return (
    <form className="flex min-h-0 flex-col" onSubmit={event => {
      event.preventDefault();
      if (!stage && !saving) onSave(details);
    }}>
      {items.length > 0 && (
        <div className="shrink-0 space-y-1 pb-3">
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2">
            <p className="text-sm font-semibold text-primary">
              {stage ? `Étape ${index + 1} sur ${items.length}` : "Récapitulatif de l’accueil"}
            </p>
            {stage && !editing && <Button type="button" variant="ghost" className="px-2" onClick={showSummary}>Voir le récapitulatif</Button>}
          </div>
          <div className="flex gap-1" aria-hidden>
            {items.map((key, position) => (
              <span key={key} className={cn("h-1.5 flex-1 rounded-full", position < index ? "bg-primary/55" : position === index ? "bg-primary" : "bg-muted")} />
            ))}
          </div>
        </div>
      )}
      <div ref={scroll} className="min-h-0 space-y-3 overflow-y-auto overscroll-contain pb-3">
        {stage && item ? (
          <section className="space-y-4 rounded-xl border border-border bg-card p-3.5 sm:p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <stage.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                {item === "mapGiven" && <p className="text-xs font-medium text-muted-foreground">Facultatif</p>}
                <h3 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">{stage.title}</h3>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{stage.text}</p>
            {item === "squadExplained" && (
              <label className="block space-y-1.5 text-sm font-medium">Équipe
                <select className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={details.squadId ?? ""} onChange={event => {
                    const squadId = event.target.value ? Number(event.target.value) : null;
                    setDetails(previous => ({
                      ...previous, squadId,
                      checklist: previous.checklist.squadExplained ? { ...previous.checklist, squadExplained: false } : previous.checklist,
                    }));
                  }}>
                  <option value="">Sans équipe</option>
                  {teams.map(team => {
                    const full = team.maxMembers != null && team.members >= team.maxMembers && team.id !== initialDetails.squadId;
                    return <option key={team.id} value={team.id} disabled={full}>Équipe {team.number}{full ? " (complète)" : ""}</option>;
                  })}
                </select>
              </label>
            )}
            {item === "briefingExplained" && (
              <>
                {slot ? (
                  <div className="space-y-2 rounded-lg bg-muted/60 p-3">
                    <p className="break-words text-sm font-semibold">{slot.name}</p>
                    <dl className="grid gap-1.5 text-sm">
                      <Time label="Briefing" value={slot.briefingTime} />
                      <Time label="Début du jeu" value={slot.gameTime} />
                      <Time label="Sortie" value={slot.exitTime} />
                    </dl>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Aucun créneau attribué. Vérifiez l’horaire avec l’organisation.</p>}
                {selectedTeam?.briefing?.trim() && (
                  <div className="space-y-1 border-l-2 border-primary/60 pl-3 text-sm">
                    <p className="font-semibold">Consignes de l’équipe {selectedTeam.number}</p>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">{selectedTeam.briefing}</p>
                  </div>
                )}
              </>
            )}
            {item === "mealTicketGiven" && slot?.mealTime && (
              <dl className="rounded-lg bg-muted/60 p-3 text-sm"><Time label="Repas" value={slot.mealTime} /></dl>
            )}
            {complete && <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><Check className="size-4" aria-hidden /> Déjà confirmé</p>}
          </section>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-3.5 sm:p-5">
              <h3 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
                {items.length ? "Vérifier avant d’enregistrer" : "Confirmer l’arrivée"}
              </h3>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {slot?.name ?? "Sans créneau"}{type !== "staff" && (selectedTeam ? ` · Équipe ${selectedTeam.number}` : " · Sans équipe")}
              </p>
            </div>
            {summary}
            {items.length > 0 && (
              <ul aria-label="Étapes de l’accueil" className="divide-y divide-border rounded-lg border border-border">
                {items.map((key, position) => {
                  const confirmed = details.checklist[key];
                  const status = confirmed ? "Confirmé" : key === "mapGiven" ? "Facultatif" : "À faire";
                  return (
                    <li key={key}>
                      <button type="button" disabled={saving} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:outline-primary"
                        aria-label={`${instructions[key].title} ${status}`}
                        onClick={() => { setEditing(true); setIndex(position); }}>
                        <span className="font-medium">{instructions[key].title}</span>
                        <span className={cn("flex shrink-0 items-center gap-1 text-xs", confirmed ? "text-primary" : "text-muted-foreground")}>
                          {confirmed && <Check className="size-3.5" aria-hidden />}
                          {status}
                          <ArrowRight className="size-3.5" aria-hidden />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="shrink-0 space-y-2 border-t border-border pt-3">
        {error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            {onReload && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onReload}>Actualiser la fiche</Button>}
          </div>
        )}
        {stage && item ? (
          <>
            <Button type="button" className="w-full" onClick={() => {
              if (complete || !canConfirm) next();
              else mark(item, true);
            }}>
              {complete ? "Continuer" : !canConfirm ? "Continuer sans équipe" : item === "mapGiven" ? "Carte remise" : zombieChecklist[item]} <ArrowRight />
            </Button>
            {(index > 0 || editing || canConfirm || complete) && (
              <div className="flex flex-wrap justify-between gap-x-2">
                {(index > 0 || editing) && <Button type="button" variant="ghost" className="px-2.5"
                  onClick={() => editing ? showSummary() : setIndex(index - 1)}><ArrowLeft /> {editing ? "Récapitulatif" : "Précédent"}</Button>}
                {(canConfirm || complete) && (
                  <Button type="button" variant="ghost" className="ml-auto px-2.5 text-muted-foreground"
                    onClick={() => complete ? mark(item, false) : next()}>
                    {complete ? "Marquer à faire" : "Passer cette étape"}
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <Button type="submit" className="w-full whitespace-normal" loading={saving}>
            {saving ? "Enregistrement…" : saveLabel}
          </Button>
        )}
      </div>
    </form>
  );
}

function Time({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
