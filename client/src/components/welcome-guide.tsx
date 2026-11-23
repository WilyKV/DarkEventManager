import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Check, Droplet, Map, Paintbrush, Ticket, Users } from "lucide-react";
import { checkInProfiles, type ChecklistItem, type CheckInDetails, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { timeSlotPhases } from "@shared/time-slot-notes";
import { zombieChecklist } from "@shared/zombie-offline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { orderSquads, placementLabels, recommendSquad, SquadPlacementCard, squadPlaces, type PlacementMember } from "./squad-placement";
import { OtherWelcomeNote, WelcomeSchedule } from "./welcome-schedule";

const instructions = {
  squadExplained: {
    title: "Présenter l’équipe",
    icon: Users,
    text: "Annoncez le numéro de l’équipe et où retrouver ses coéquipiers après le briefing.",
  },
  briefingExplained: {
    title: "Annoncer les horaires",
    icon: CalendarClock,
    text: "Demandez au joueur d’être prêt à l’heure du briefing. À la fin du jeu, il doit repasser au stand Arrivée pour confirmer son retour.",
  },
  mealTicketGiven: {
    title: "Remettre la carte participant",
    icon: Ticket,
    text: "Remettez la carte participant et inscrivez son numéro de passage. La case repas sera cochée à la buvette.",
  },
  waterBottleGiven: {
    title: "Donner la bouteille d’eau",
    icon: Droplet,
    text: "Remettez une bouteille d’eau. Indiquez les jerricans où la remplir avant de partir en jeu.",
  },
  makeupWaitExplained: {
    title: "Orienter vers le maquillage",
    icon: Paintbrush,
    text: "Le numéro de passage inscrit sur la carte indique l’ordre du maquillage. À son tour, le joueur présente sa carte au stand. Rappelez-lui l’heure du briefing.",
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
  groupSize?: number;
  /** All listed attendees share the chosen squad in the offline group guide. */
  sharedArrival?: boolean;
  allowCapacityOverride?: boolean;
  plannedTeamId?: number;
  review?: boolean;
  summary?: ReactNode;
  saving: boolean;
  error: string;
  onReload?: () => void;
  squadOnly?: boolean;
  requirePlacement?: boolean;
  groupSeatsNeeded?: (id: number) => number;
  membersByTeam?: ReadonlyMap<number, readonly PlacementMember[]>;
  lockSquad?: boolean;
  onSave: (details: CheckInDetails, keepTeamForGroup: boolean, overflowConfirmed: boolean) => void;
  saveLabel: string;
}

export function WelcomeGuide({ type, initialDetails, slot, teams, groupSize = 1, plannedTeamId, review, summary, saving, error, onReload, onSave, saveLabel, sharedArrival = false, allowCapacityOverride = false, squadOnly = false, lockSquad = false, requirePlacement = false, groupSeatsNeeded, membersByTeam }: WelcomeGuideProps) {
  const items: ChecklistItem[] = checkInProfiles[type].checklist.filter(item =>
    squadOnly ? item === "squadExplained" : !lockSquad || item !== "squadExplained");
  const [index, setIndex] = useState(review ? items.length : 0);
  const [editing, setEditing] = useState(false);
  const [details, setDetails] = useState(() => plannedTeamId === undefined ? initialDetails : {
    ...initialDetails, squadId: plannedTeamId, checklist: { ...initialDetails.checklist, squadExplained: false },
  });
  const [keepTeamForGroup, setKeepTeamForGroup] = useState(false);
  const [overflowTeamId, setOverflowTeamId] = useState<number>();
  const heading = useRef<HTMLHeadingElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const item = items[index];
  const words = placementLabels(type);
  const stage = item === "squadExplained" ? {
    ...instructions.squadExplained,
    title: `Présenter ${words.article}`,
    text: `Annoncez le numéro ${words.of} et où retrouver ses coéquipiers après le briefing.`,
  } : item === undefined ? undefined : instructions[item];
  const complete = item !== undefined && Boolean(details.checklist[item]);
  const canConfirm = item !== "squadExplained" || details.squadId !== null;
  const selectedTeam = teams.find(team => team.id === details.squadId);
  const newSeatNeeded = (id: number) => Number(id !== initialDetails.squadId);
  const seatsForGroup = groupSeatsNeeded ?? ((id: number) => sharedArrival
    ? groupSize * newSeatNeeded(id)
    : groupSize - 1 + newSeatNeeded(id));
  const groupRecommendation = recommendSquad(teams, seatsForGroup);
  const recommendation = groupRecommendation ?? (groupSize > 1 ? recommendSquad(teams, newSeatNeeded) : undefined);
  const seats = selectedTeam ? (sharedArrival ? seatsForGroup(selectedTeam.id) : newSeatNeeded(selectedTeam.id)) : 0;
  const needsOverride = Boolean(selectedTeam && seats > squadPlaces(selectedTeam));
  const overflowConfirmed = selectedTeam !== undefined && overflowTeamId === selectedTeam.id;
  const teamUnavailable = details.squadId !== null && details.squadId !== initialDetails.squadId &&
    (!selectedTeam || (needsOverride && (!allowCapacityOverride || !overflowConfirmed)));
  const fitsGroup = groupSize > 1 && Boolean(selectedTeam && squadPlaces(selectedTeam) >= seatsForGroup(selectedTeam.id));
  const groupUnavailable = keepTeamForGroup && groupSize > 1 && !fitsGroup;
  const mustChooseSquad = requirePlacement && !canConfirm;

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

  function chooseTeam(squadId: number | null) {
    if (details.squadId === squadId) return;
    setKeepTeamForGroup(false);
    setOverflowTeamId(undefined);
    setDetails(previous => ({
      ...previous, squadId,
      checklist: previous.checklist.squadExplained ? { ...previous.checklist, squadExplained: false } : previous.checklist,
    }));
  }

  return (
    <form className="flex min-h-0 flex-col" onSubmit={event => {
      event.preventDefault();
      if (!stage && !saving && !teamUnavailable && !groupUnavailable) {
        onSave(details, keepTeamForGroup && fitsGroup, needsOverride && overflowConfirmed);
      }
    }}>
      {items.length > 0 && (
        <div className="shrink-0 space-y-1 pb-3">
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-2">
            <p className="text-sm font-semibold text-primary">
              {stage ? (squadOnly ? "Affectation" : `Étape ${index + 1} sur ${items.length}`) : "Récapitulatif de l’accueil"}
            </p>
            {stage && !editing && !squadOnly && <Button type="button" variant="ghost" className="px-2" onClick={showSummary}>Voir le récapitulatif</Button>}
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
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-x-2">
                  <p className="min-w-0 break-words text-sm font-semibold">{slot?.name ?? "Sans créneau"}</p>
                  {details.squadId !== null && !requirePlacement && <Button type="button" variant="ghost" className="px-2 text-muted-foreground"
                    onClick={() => chooseTeam(null)}>Sans {words.noun}</Button>}
                </div>
                {teams.length === 0 ? <p className="text-sm text-muted-foreground">
                  Aucune {words.noun} disponible pour ce créneau.{requirePlacement && ` Il faut une ${words.noun} pour accueillir le groupe.`}
                </p> : (
                  <>
                    {!allowCapacityOverride && (!recommendation || groupSize > 1) && (
                      <p className="text-sm text-muted-foreground">
                        {!recommendation ? `Aucune place disponible. Vous pouvez continuer sans ${words.noun}.` : groupRecommendation
                          ? `${groupSize} personnes de ce créneau peuvent être placées ensemble.`
                          : `Aucune ${words.noun} n’a assez de place pour les ${groupSize} personnes.`}
                      </p>
                    )}
                    <ul aria-label={`${words.plural} du créneau`} className="grid gap-3 sm:grid-cols-2">
                      {orderSquads(teams, sharedArrival ? seatsForGroup : newSeatNeeded, plannedTeamId ?? recommendation?.id).map(team => {
                        const label = team.id === plannedTeamId ? "Choix du groupe"
                          : team.id === recommendation?.id ? (groupRecommendation ? "Recommandée" : "Pour ce joueur") : undefined;
                        return (
                          <li key={team.id}>
                            <SquadPlacementCard team={team} profile={type} people={membersByTeam?.get(team.id)} label={label} selected={team.id === details.squadId}
                              disabled={!allowCapacityOverride && squadPlaces(team) < newSeatNeeded(team.id)} onSelect={() => chooseTeam(team.id)} />
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}
            {item === "briefingExplained" && (
              <>
                {slot ? (
                  <div className="space-y-2">
                    <p className="break-words text-sm font-semibold">{slot.name}</p>
                    <WelcomeSchedule slot={slot}
                      phases={type === "survivant" && slot.welcomeNotes?.meal?.trim() ? timeSlotPhases : undefined} />
                  </div>
                ) : <p className="text-sm text-muted-foreground">Aucun créneau attribué. Vérifiez l’horaire avec l’organisation.</p>}
                {selectedTeam?.briefing?.trim() && (
                  <div className="space-y-1 border-l-2 border-primary/60 pl-3 text-sm">
                    <p className="font-semibold">Consignes {words.of} {selectedTeam.number}</p>
                    <p className="whitespace-pre-wrap break-words text-muted-foreground">{selectedTeam.briefing}</p>
                  </div>
                )}
              </>
            )}
            {item === "mealTicketGiven" && <WelcomeSchedule slot={slot} phases={["meal"]} />}
            {complete && <p className="flex items-center gap-1.5 text-sm font-medium text-primary"><Check className="size-4" aria-hidden /> Déjà confirmé</p>}
          </section>
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-3.5 sm:p-5">
              <h3 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
                {items.length ? "Vérifier avant d’enregistrer" : "Confirmer l’arrivée"}
              </h3>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                {slot?.name ?? "Sans créneau"}{type !== "staff" && (selectedTeam ? ` · ${words.name} ${selectedTeam.number}` : ` · Sans ${words.noun}`)}
              </p>
              {keepTeamForGroup && fitsGroup && (
                <p className="mt-1 text-sm text-muted-foreground">{words.name} proposée aux {groupSize} personnes de ce créneau.</p>
              )}
            </div>
            {type === "staff" && <WelcomeSchedule slot={slot} phases={timeSlotPhases} notesOnly />}
            <OtherWelcomeNote slot={slot} />
            {summary}
            {items.length > 0 && (
              <ul aria-label="Étapes de l’accueil" className="divide-y divide-border rounded-lg border border-border">
                {items.map((key, position) => {
                  const confirmed = details.checklist[key];
                  const status = confirmed ? "Confirmé" : key === "mapGiven" ? "Facultatif" : "À faire";
                  return (
                    <li key={key}>
                      <button type="button" disabled={saving} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:outline-primary"
                        aria-label={`${key === "squadExplained" ? `Présenter ${words.article}` : instructions[key].title} ${status}`}
                        onClick={() => { setEditing(true); setIndex(position); }}>
                        <span className="font-medium">{key === "squadExplained" ? `Présenter ${words.article}` : instructions[key].title}</span>
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
        {allowCapacityOverride && selectedTeam && needsOverride && (!stage || item === "squadExplained") && (
          <label className="flex items-start gap-2 rounded-lg border border-amber-500/50 p-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={overflowConfirmed}
              onChange={event => setOverflowTeamId(event.target.checked ? selectedTeam.id : undefined)} />
            <span>Confirmer le dépassement · {selectedTeam.members + seats} / {selectedTeam.maxMembers} affectés</span>
          </label>
        )}
        {(teamUnavailable || groupUnavailable) && (!stage || item === "squadExplained") && !(allowCapacityOverride && needsOverride) && (
          <p role="alert" className="text-sm text-destructive">
            {teamUnavailable ? `Cette ${words.noun} n’a plus de place ou n’est plus disponible. Choisissez une autre ${words.noun}.`
              : `Choisissez une ${words.noun} avec assez de place pour tout le groupe ou poursuivez individuellement.`}
          </p>
        )}
        {error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            {onReload && <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onReload}>Actualiser la fiche</Button>}
          </div>
        )}
        {stage && item ? (
          <>
            {item === "squadExplained" && !sharedArrival && groupSize > 1 && (fitsGroup || keepTeamForGroup) && (
              <label className="flex min-h-11 items-center gap-2.5 rounded-lg bg-muted/45 px-3 py-2 text-sm font-medium">
                <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={keepTeamForGroup}
                  onChange={event => setKeepTeamForGroup(event.target.checked)} />
                Proposer cette {words.noun} aux {groupSize} personnes
              </label>
            )}
            <Button type="button" className="w-full" disabled={item === "squadExplained" && (teamUnavailable || groupUnavailable || mustChooseSquad)} onClick={() => {
              if (squadOnly) {
                onSave({ ...details, checklist: { ...details.checklist, squadExplained: canConfirm } },
                  keepTeamForGroup && fitsGroup, needsOverride && overflowConfirmed);
              } else if (complete || !canConfirm) next();
              else mark(item, true);
            }}>
              {item === "squadExplained"
                ? mustChooseSquad || (squadOnly && canConfirm) ? `Confirmer ${words.article}`
                  : complete ? "Continuer" : canConfirm ? `${words.name} présentée` : `Continuer sans ${words.noun}`
                : complete ? "Continuer" : item === "mapGiven" ? "Carte remise" : zombieChecklist[item]} <ArrowRight />
            </Button>
            {!squadOnly && (index > 0 || editing || canConfirm || complete) && (
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
          <Button type="submit" className="w-full whitespace-normal" disabled={teamUnavailable || groupUnavailable} loading={saving}>
            {saving ? "Enregistrement…" : saveLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
