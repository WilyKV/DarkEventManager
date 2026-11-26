import { WelcomeTabletHandoff } from "./welcome-tablet-handoff";
import { makeTabletTransfer, type TabletPresentation, type TabletTransfer } from "./welcome-tablet-transfer";
import type { WelcomeChecklist } from "@shared/welcome-checklist";
import { makeupEstimates } from "@shared/makeup";
import { useId, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Footprints, Paintbrush, Plus, Search, ShieldCheck, Skull, UserCheck, Users } from "lucide-react";
import { checkInProfiles, checkInTypes, type CheckInDetails, type CheckInPlayer, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { normalizePlayerName } from "@shared/zombie-offline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OfflineGroupWelcome, type OfflineArrival } from "./offline-group-welcome";

type Step = "profile" | "count" | "select" | "welcome" | "done";

type WelcomeDialogProps = {
  roster?: CheckInRoster;
  checklist?: { settings: WelcomeChecklist; canEdit: boolean };
  profileTypes?: readonly CheckInType[];
  unavailable?: ReactNode;
  onClose: () => void;
  onReload?: () => Promise<CheckInRoster | undefined>;
} & ({
  onSave: (player: CheckInPlayer, details: CheckInDetails, overflowConfirmed: boolean) => Promise<void>;
  onSaveOfflineGroup?: never;
} | {
  onSave?: never;
  onSaveOfflineGroup: (arrivals: OfflineArrival[]) => Promise<void>;
});

const nameOrder = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
const profileCards = {
  zombie: { Icon: Skull, colors: "border-red-500/40 bg-red-950 text-red-50 hover:bg-red-900" },
  survivant: { Icon: Footprints, colors: "border-blue-500/40 bg-blue-950 text-blue-50 hover:bg-blue-900" },
  staff: { Icon: ShieldCheck, colors: "border-emerald-500/40 bg-emerald-950 text-emerald-50 hover:bg-emerald-900" },
};
const makeupClock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const initial = (name: string) => {
  const letter = normalizePlayerName(name).trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : "#";
};

function readWave(key: string) {
  try { return sessionStorage.getItem(key) ?? undefined; } catch { return undefined; }
}

export function WelcomeDialog(props: WelcomeDialogProps) {
  const { roster, unavailable, onClose } = props;
  if (roster) return <WelcomeSession {...props} roster={roster} />;
  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Accueillir</DialogTitle>
          <DialogDescription>Choisissez des personnes à accueillir.</DialogDescription>
        </DialogHeader>
        {unavailable}
      </DialogContent>
    </Dialog>
  );
}

function WelcomeSession({ roster, profileTypes = checkInTypes, unavailable, checklist, onClose, onSave, onReload, onSaveOfflineGroup }: WelcomeDialogProps & { roster: CheckInRoster }) {
  const countId = useId();
  const [step, setStep] = useState<Step>("profile");
  const [quantity, setQuantity] = useState("1");
  const [largeGroup, setLargeGroup] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);
  const [confirmedArrivals, setConfirmedArrivals] = useState<Record<number, string>>({});
  const [tabletTransfer, setTabletTransfer] = useState<TabletTransfer>();
  const [savedSquadNumber, setSavedSquadNumber] = useState<number>();
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [savedSquadId, setSavedSquadId] = useState<number>();
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState("");
  const [type, setType] = useState<CheckInType | null>(null);
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reviewVersion, setReviewVersion] = useState(0);
  const [wave, setWave] = useState<string>();
  const [showWaves, setShowWaves] = useState(false);

  const profilePlayers = roster.players.filter(player => player.type === type && !player.returned);
  const profileSlots = roster.slots.filter(slot => slot.type === type ||
    (!slot.type && profilePlayers.some(player => player.timeSlotId === slot.id)))
    .sort((a, b) => nameOrder.compare(a.briefingTime, b.briefingTime) || nameOrder.compare(a.name, b.name) || a.id - b.id);
  const waveOptions = profileSlots.map(slot => ({ value: String(slot.id), label: slot.name }));
  if (profilePlayers.some(player => player.timeSlotId === null) || !waveOptions.length) {
    waveOptions.push({ value: "none", label: type === "staff" ? "Sans attribution" : "Sans créneau" });
  }
  const waveKey = `welcome-wave:${roster.eventDay ?? "event"}:${type}:${profileSlots.map(slot => slot.id).join(",")}`;
  const preferredWave = wave ?? readWave(waveKey);
  const waveIndex = preferredWave === "finished" ? waveOptions.length : Math.max(0, waveOptions.findIndex(option => option.value === preferredWave));
  const currentWave = waveOptions[waveIndex];
  const wavePlayers = profilePlayers.filter(player => String(player.timeSlotId ?? "none") === currentWave?.value)
    .sort((a, b) => nameOrder.compare(a.lastName, b.lastName) || nameOrder.compare(a.firstName, b.firstName) || a.id - b.id);
  const selected = selection.filter(id => wavePlayers.some(player => player.id === id));
  const total = Number(quantity);
  const validCount = Number.isInteger(total) && total >= 1 && total <= wavePlayers.length;
  const terms = normalizePlayerName(search).trim().split(/\s+/).filter(Boolean);
  const letters = new Set(wavePlayers.map(player => initial(player.lastName)));
  const matches = wavePlayers.filter(player => {
    if (selectedOnly) return selected.includes(player.id);
    if (!terms.length) return initial(player.lastName) === letter;
    const name = normalizePlayerName(`${player.lastName} ${player.firstName}`);
    return terms.every(word => name.includes(word));
  });

  function resetGroup() {
    setQuantity("1");
    setLargeGroup(false);
    setSelection([]);
    setSavedIds([]);
    setTabletTransfer(undefined);
    setSavedSquadNumber(undefined);
    setSavedSquadId(undefined);
    setSearch("");
    setLetter("");
    setSelectedOnly(false);
    setError("");
    setShowWaves(false);
    setStep("count");
  }

  function switchWave(value: string) {
    try { sessionStorage.setItem(waveKey, value); } catch {}
    setWave(value);
    resetGroup();
  }

  async function confirm(arrivals: OfflineArrival[], tablet?: TabletPresentation) {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const transfer = tablet && makeTabletTransfer(tablet);
      if (onSaveOfflineGroup) {
        await onSaveOfflineGroup(arrivals);
        setSavedIds(arrivals.map(({ player }) => player.id));
      } else if (onSave) {
        for (const { player, details, overflowConfirmed } of arrivals) {
          if (savedIds.includes(player.id)) continue;
          await onSave(player, details, overflowConfirmed);
          if (details.squadId !== null && player.type !== "staff") setSavedSquadId(details.squadId);
          setSavedIds(previous => [...previous, player.id]);
        }
      }
      const confirmedAt = new Date().toISOString();
      setConfirmedArrivals(previous => ({
        ...previous, ...Object.fromEntries(arrivals.map(({ player }) => [player.id, player.arrivedAt ?? previous[player.id] ?? confirmedAt])),
      }));
      setTabletTransfer(transfer);
      setSavedSquadNumber(type === "zombie" ? roster.teams.find(team => team.id === arrivals[0]?.details.squadId)?.number : undefined);
      setStep("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer le groupe.");
    } finally {
      setSaving(false);
    }
  }

  const makeupWave = roster.players.filter(player => player.type === "zombie" && String(player.timeSlotId ?? "none") === currentWave?.value)
    .map(player => ({ id: player.id, arrivedAt: player.arrivedAt ?? confirmedArrivals[player.id] }));
  const briefing = roster.slots.find(slot => String(slot.id) === currentWave?.value)?.briefingTime;
  const makeup = step === "done" && type === "zombie" && currentWave && roster
    ? makeupEstimates(makeupWave, briefing, roster.makeupArtists)
    : undefined;
  const title = {
    profile: "Qui accueillez-vous ?",
    count: "Combien de personnes ?",
    select: "Choisir les personnes",
    welcome: "Accueillir le groupe",
    done: "Accueil terminé",
  }[step];
  const waveLabel = currentWave?.label ?? "Toutes les vagues sont terminées";
  const HeaderIcon = type && step !== "profile" ? profileCards[type].Icon : Users;

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="welcome-session flex h-dvh max-h-dvh w-full max-w-none flex-col overflow-hidden rounded-none border-0 p-4 sm:rounded-none sm:p-8 [&>button]:min-h-11 [&>button]:min-w-11 [&>button]:grid [&>button]:place-items-center"
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}>
        <DialogHeader className="flex shrink-0 flex-row items-center gap-3 space-y-0 border-b border-border pb-3 pr-12 text-left sm:gap-4">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl border sm:size-14",
            type && step !== "profile" ? profileCards[type].colors : "border-primary/20 bg-primary/10 text-primary")}>
            <HeaderIcon className="size-6 sm:size-7" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <DialogTitle className="font-display text-xl sm:text-3xl">{title}</DialogTitle>
            <DialogDescription>
              {step === "profile" ? "Choisissez un profil." :
                `${type ? checkInProfiles[type].label : ""} · ${waveLabel}`}
            </DialogDescription>
          </div>
        </DialogHeader>

        {unavailable}

        {step === "profile" && (
          <div className="grid min-h-0 flex-1 auto-rows-fr gap-3 overflow-y-auto sm:grid-cols-3 sm:gap-5">
            {profileTypes.map(value => {
              const { Icon, colors } = profileCards[value];
              return (
                <button key={value} type="button" className={cn("flex min-h-24 items-center justify-center gap-4 rounded-2xl border p-4 text-xl font-bold transition-colors sm:flex-col sm:text-3xl", colors)}
                  onClick={() => { setType(value); setWave(undefined); resetGroup(); }}>
                  <Icon className="size-10 sm:size-20" strokeWidth={1.4} aria-hidden />
                  {checkInProfiles[value].label}
                </button>
              );
            })}
            {!profileTypes.length && <p role="status">Aucun profil disponible pour cet accueil.</p>}
          </div>
        )}

        {step === "count" && (
          <form className="flex min-h-0 flex-1 flex-col gap-3" onSubmit={event => {
            event.preventDefault();
            if (validCount) {
              setSelection(selected.slice(0, total));
              setStep("select");
            }
          }}>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setStep("profile")}><ArrowLeft /> Changer de profil</Button>
              <Button type="button" variant="outline" aria-expanded={showWaves} onClick={() => setShowWaves(!showWaves)}>{type === "staff" ? "Choisir une attribution" : "Choisir une vague"}</Button>
              {type !== "staff" && currentWave && waveIndex < profileSlots.length && <Button type="button" variant="outline"
                onClick={() => switchWave(waveOptions[waveIndex + 1]?.value ?? "finished")}>Clôturer la vague <ArrowRight /></Button>}
            </div>
            {showWaves && (
              <select aria-label={type === "staff" ? "Attribution active" : "Vague active"} className="min-h-11 rounded-lg border bg-background px-3" value={currentWave?.value ?? "finished"}
                onChange={event => switchWave(event.target.value)}>
                {!currentWave && <option value="finished">Vagues terminées</option>}
                {waveOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
            {wavePlayers.length ? (
              <>
                <div role="group" aria-label="Nombre de personnes" className="grid min-h-0 flex-1 grid-cols-4 grid-rows-2 gap-2 sm:gap-4">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(value => (
                    <Button key={value} type="button" className="h-full min-h-10 rounded-xl px-1 text-3xl font-bold sm:rounded-2xl sm:text-6xl"
                      variant={total === value ? "default" : "outline"} aria-pressed={total === value}
                      aria-label={`${value} ${value === 1 ? "personne" : "personnes"}`}
                      disabled={value > wavePlayers.length} onClick={() => { setQuantity(String(value)); setLargeGroup(false); }}>{value}</Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {wavePlayers.length > 8 && <Button type="button" variant="outline" aria-expanded={largeGroup}
                    onClick={() => { setLargeGroup(!largeGroup); setQuantity(largeGroup ? "1" : "9"); }}>
                    <Plus /> Plus de 8
                  </Button>}
                  {largeGroup && <>
                    <label htmlFor={countId} className="sr-only">Nombre de personnes</label>
                    <Input id={countId} type="number" inputMode="numeric" min={9} max={wavePlayers.length} required
                      value={quantity} onChange={event => setQuantity(event.target.value)} className="min-h-11 w-24" />
                  </>}
                  <Button type="submit" className="min-h-12 flex-1" disabled={!validCount}>Choisir les personnes <ArrowRight /></Button>
                </div>
              </>
            ) : <p role="status" className="rounded-xl border p-4 text-muted-foreground">
              {currentWave ? "Aucune personne de ce profil dans cette vague." : "Vous pouvez rouvrir une vague depuis le sélecteur."}
            </p>}
          </form>
        )}

        {step === "select" && (
          <div className="welcome-people flex min-h-0 flex-1 flex-col gap-3">
            <div className="welcome-people-filters shrink-0 space-y-2 rounded-2xl border border-border bg-card p-3">
              <div className="relative">
                <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
                <Input type="search" aria-label="Rechercher une personne" placeholder="Nom ou prénom"
                  className="min-h-11 pl-9" value={search} onChange={event => { setSearch(event.target.value); setSelectedOnly(false); }} />
              </div>
              <div role="group" aria-label="Initiale du nom de famille" className="grid grid-cols-9 gap-1 sm:grid-cols-[repeat(14,minmax(0,1fr))] sm:gap-2">
                {alphabet.map(value => (
                  <Button key={value} type="button" variant={!selectedOnly && !terms.length && letter === value ? "default" : "outline"}
                    aria-pressed={!selectedOnly && !terms.length && letter === value} disabled={!letters.has(value)}
                    className="h-10 px-0 text-base sm:h-12 sm:text-xl" onClick={() => { setLetter(value); setSearch(""); setSelectedOnly(false); }}>{value}</Button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-x-2">
                <p role="status" className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">{selected.length} sur {total} sélectionnées</p>
                <Button type="button" variant="ghost" onClick={() => setSelectedOnly(!selectedOnly)}>
                  {selectedOnly ? "Retour à la recherche" : "Voir ma sélection"}
                </Button>
              </div>
            </div>
            <ul className="welcome-people-list min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain" aria-label="Personnes à accueillir">
              {matches.length === 0 && <li className="p-3 text-sm text-muted-foreground">{selectedOnly ? "Aucune personne sélectionnée." : letter || terms.length ? "Aucun résultat." : "Choisissez une lettre ou recherchez un nom."}</li>}
              {matches.map(player => {
                const active = selected.includes(player.id);
                return (
                  <li key={player.id}>
                    <button type="button" aria-pressed={active} disabled={!active && selected.length >= total}
                      onClick={() => setSelection(active ? selected.filter(id => id !== player.id) : [...selected, player.id])}
                      className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-2 text-left disabled:opacity-50 sm:min-h-16",
                        active ? "border-emerald-500 bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50" : "border-border bg-card hover:border-primary/60")}>
                      {active && <Check className="size-5 shrink-0" aria-hidden />}
                      <span className="min-w-0 break-words text-base font-medium sm:text-lg">
                        <strong>{player.lastName}</strong> {player.firstName}
                        {player.arrived && <span className="ml-2 text-xs opacity-75">Déjà arrivé</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="welcome-people-actions flex shrink-0 gap-2 border-t pt-3">
              <Button type="button" variant="outline" onClick={() => setStep("count")}><ArrowLeft /> Retour</Button>
              <Button type="button" className="min-h-12 flex-1" disabled={!validCount || selected.length !== total} onClick={() => {
                setSelection(selected);
                setStep("welcome");
              }}>Commencer l’accueil <ArrowRight /></Button>
            </div>
          </div>
        )}

        {step === "welcome" && (
          <OfflineGroupWelcome key={reviewVersion} roster={roster} checklist={checklist} ids={selection} saving={saving} error={error}
            savedIds={savedIds} savedSquadId={savedSquadId} onConfirm={confirm}
            onBack={() => setStep("select")}
            onReplan={async () => {
              if (saving) return;
              setSaving(true);
              try {
                await onReload?.();
                setSelection(selection.filter(id => !savedIds.includes(id)));
                setError("");
                setReviewVersion(previous => previous + 1);
              } catch {
                setError("Impossible d’actualiser les fiches. Réessayez.");
              } finally {
                setSaving(false);
              }
            }} />
        )}

        {step === "done" && (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="min-h-0 space-y-4 overflow-y-auto">
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-600/35 bg-emerald-500/10 p-5 sm:p-6">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-emerald-800 text-white">
                  <UserCheck className="size-7" aria-hidden />
                </span>
                <div>
                  <p role="status" className="text-xl font-semibold sm:text-2xl">
                    {savedIds.length} {savedIds.length === 1 ? "personne accueillie" : "personnes accueillies"}.
                  </p>
                  <p className="text-sm text-muted-foreground">{onSaveOfflineGroup ? "Arrivées enregistrées sur cet appareil." : "Arrivées enregistrées."}</p>
                </div>
              </div>
              {tabletTransfer ? <WelcomeTabletHandoff key={tabletTransfer.id} transfer={tabletTransfer} />
                : savedSquadNumber !== undefined && <p className="text-lg font-semibold">Squad {savedSquadNumber}</p>}
              <section className="space-y-3" aria-label={makeup ? "Heures estimées de maquillage" : "Participants accueillis"}>
                {makeup && <div className="space-y-1">
                  <h3 className="flex items-center gap-2 text-lg font-semibold"><Paintbrush className="size-5 text-primary" aria-hidden /> Maquillage · horaires estimés</h3>
                  <p className="text-sm text-muted-foreground">{savedIds.some(id => makeup.has(id))
                    ? "Notez l’heure sur la carte de chaque participant. Si le briefing est déjà passé, vérifiez la disponibilité du stand."
                    : "Renseignez une heure de briefing valide dans le créneau pour obtenir une estimation."}</p>
                </div>}
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {wavePlayers.filter(player => savedIds.includes(player.id)).map(player => {
                    const time = makeup?.get(player.id);
                    return <li key={player.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
                      <span className="min-w-0 break-words font-semibold">{player.firstName} {player.lastName}</span>
                      {makeup && <strong className="rounded-xl bg-primary/10 px-3 py-2 text-primary tabular-nums">
                        {time === undefined ? "Horaire indisponible" : makeupClock.format(time)}
                      </strong>}
                    </li>;
                  })}
                </ul>
              </section>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border pt-3">
              <Button type="button" className="min-h-12" onClick={resetGroup}>Nouveau groupe</Button>
              <Button type="button" variant="outline" className="min-h-12" onClick={onClose}>Quitter l’accueil</Button>
              {type !== "staff" && currentWave && waveIndex < profileSlots.length && <Button type="button" variant="outline" className="min-h-12"
                onClick={() => switchWave(waveOptions[waveIndex + 1]?.value ?? "finished")}>Clôturer la vague <ArrowRight /></Button>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
