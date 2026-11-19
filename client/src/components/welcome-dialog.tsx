import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Search, UserCheck } from "lucide-react";
import { checkInProfiles, checkInTypes, type CheckInDetails, type CheckInPlayer, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { normalizePlayerName } from "@shared/zombie-offline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WelcomeGuide } from "./welcome-guide";

type Step = "count" | "select" | "welcome" | "done";

interface WelcomeDialogProps {
  roster?: CheckInRoster;
  profileTypes?: readonly CheckInType[];
  unavailable?: ReactNode;
  onClose: () => void;
  onSave: (player: CheckInPlayer, details: CheckInDetails) => Promise<void>;
  onReload?: () => void;
}

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm sm:px-3";
const profileLabels = { zombie: "Zombies", survivant: "Survivants", staff: "Staff" };
const nameOrder = new Intl.Collator("fr", { sensitivity: "base" });

export function WelcomeDialog({ roster, profileTypes = checkInTypes, unavailable, onClose, onSave, onReload }: WelcomeDialogProps) {
  const countId = useId();
  const [step, setStep] = useState<Step>("count");
  const [quantity, setQuantity] = useState("1");
  const [selection, setSelection] = useState<number[]>([]);
  const [plannedTeams, setPlannedTeams] = useState<Map<number, number>>(() => new Map());
  const [savedCount, setSavedCount] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CheckInType | "all">("all");
  const [slotFilter, setSlotFilter] = useState("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const eligible = useMemo(() => (roster?.players ?? [])
    .filter(player => !player.returned)
    .sort((a, b) => nameOrder.compare(a.firstName, b.firstName) || nameOrder.compare(a.lastName, b.lastName)), [roster]);
  const byId = new Map(eligible.map(player => [player.id, player]));
  const slots = new Map(roster?.slots.map(slot => [slot.id, slot]));
  const visibleSlots = roster?.slots.filter(slot => eligible.some(player => player.timeSlotId === slot.id && (type === "all" || player.type === type))) ?? [];
  const total = Number(quantity);
  const validCount = Number.isInteger(total) && total >= 1 && total <= eligible.length;
  const selected = selection.filter(id => byId.has(id));
  const terms = normalizePlayerName(search).trim().split(/\s+/).filter(Boolean);
  const matches = eligible.filter(player => {
    if (selectedOnly) return selection.includes(player.id);
    const name = normalizePlayerName(`${player.firstName} ${player.lastName}`);
    return (type === "all" || player.type === type) &&
      (slotFilter === "all" || String(player.timeSlotId ?? "none") === slotFilter) &&
      terms.every(word => name.includes(word));
  });
  const current = byId.get(selection[savedCount]);
  const groupToPlace = current && current.type !== "staff" && current.timeSlotId !== null
    ? selection.slice(savedCount + 1).filter(id => {
      const player = byId.get(id);
      return player?.type === current.type && player.timeSlotId === current.timeSlotId &&
        player.details.squadId === null && !plannedTeams.has(id);
    })
    : [];

  async function save(details: CheckInDetails, keepTeamForGroup: boolean) {
    if (saving || !current) return;
    setSaving(true);
    setError("");
    try {
      await onSave(current, details);
      const teamId = details.squadId;
      if (keepTeamForGroup && teamId !== null) {
        setPlannedTeams(previous => {
          const planned = new Map(previous);
          for (const id of groupToPlace) planned.set(id, teamId);
          return planned;
        });
      }
      const next = savedCount + 1;
      setSavedCount(next);
      if (next === selection.length) setStep("done");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’enregistrer cette fiche.");
    } finally {
      setSaving(false);
    }
  }

  const title = step === "done" ? "Accueil terminé"
    : step === "welcome" && current ? `${current.firstName} ${current.lastName}` : "Accueillir";
  const description = !roster ? "Choisissez des personnes à accueillir."
    : step === "count" ? "Combien de personnes se présentent ?"
      : step === "select" ? "Sélectionnez les personnes à accueillir ensemble."
        : step === "welcome" ? `Personne ${savedCount + 1} sur ${selection.length}${current ? ` · ${checkInProfiles[current.type].label}` : ""}`
          : `${savedCount} ${savedCount === 1 ? "personne accueillie" : "personnes accueillies"}.`;

  return (
    <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.25rem)] max-w-xl flex-col overflow-hidden rounded-xl p-4 sm:p-6"
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 pr-7 text-left">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!roster ? unavailable : step === "count" ? (
          <form className="space-y-4" onSubmit={event => {
            event.preventDefault();
            if (validCount) {
              setSelection(selected.slice(0, total));
              setStep("select");
            }
          }}>
            {eligible.length > 0 ? (
              <>
                <div className="grid grid-cols-5 gap-1.5" aria-label="Nombre de personnes">
                  {[1, 2, 3, 4, 5].map(value => (
                    <Button key={value} type="button" className="px-1 text-base"
                      variant={total === value ? "default" : "outline"} aria-pressed={total === value}
                      aria-label={`${value} ${value === 1 ? "personne" : "personnes"}`}
                      disabled={value > eligible.length} onClick={() => setQuantity(String(value))}>{value}</Button>
                  ))}
                </div>
                <label className="block text-sm font-medium" htmlFor={countId}>Nombre de personnes</label>
                <Input id={countId} type="number" inputMode="numeric" min={1} max={eligible.length} required
                  value={quantity} onChange={event => setQuantity(event.target.value)} className="min-h-11" />
                <Button type="submit" className="w-full" disabled={!validCount}>Choisir les personnes <ArrowRight /></Button>
              </>
            ) : (
              <p role="status" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
                Aucune personne disponible dans les listes d’accueil.
              </p>
            )}
          </form>
        ) : step === "select" ? (
          <>
            <div className="shrink-0 space-y-2">
              {!selectedOnly && (
                <>
                  {profileTypes.length > 1 && (
                    <div role="group" aria-label="Filtrer par profil" className="grid grid-flow-col auto-cols-fr gap-1.5">
                      {profileTypes.map(value => (
                        <Button key={value} type="button" variant={type === value ? "default" : "outline"}
                          aria-pressed={type === value} className="px-1.5" onClick={() => {
                            setType(type === value ? "all" : value);
                            setSlotFilter("all");
                          }}>{profileLabels[value]}</Button>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
                    <Input type="search" aria-label="Rechercher une personne" placeholder="Prénom ou nom"
                      className="min-h-11 pl-9" value={search} onChange={event => setSearch(event.target.value)} />
                  </div>
                  <select aria-label="Filtrer par créneau" className={selectClass} value={slotFilter}
                    onChange={event => setSlotFilter(event.target.value)}>
                    <option value="all">Tous les créneaux</option>
                    {visibleSlots.map(slot => <option key={slot.id} value={slot.id}>{slot.name}</option>)}
                    {eligible.some(player => player.timeSlotId == null && (type === "all" || player.type === type)) &&
                      <option value="none">Sans créneau</option>}
                  </select>
                </>
              )}
              <div className="flex flex-wrap items-center justify-between gap-x-2">
                <p role="status" className="text-sm font-semibold">{selected.length} sur {total} sélectionnées</p>
                <Button type="button" variant="ghost" size="sm"
                  onClick={() => setSelectedOnly(!selectedOnly)}>{selectedOnly ? "Voir toute la liste" : "Voir ma sélection"}</Button>
              </div>
            </div>
            <ul className="min-h-0 space-y-1.5 overflow-y-auto overscroll-contain" aria-label="Personnes à accueillir">
              {matches.length === 0 && <li className="p-3 text-sm text-muted-foreground">{selectedOnly ? "Aucune personne sélectionnée." : "Aucun résultat."}</li>}
              {matches.map(player => {
                const active = selection.includes(player.id);
                return (
                  <li key={player.id}>
                    <button type="button" aria-pressed={active} disabled={!active && selected.length >= total}
                      onClick={() => setSelection(active ? selected.filter(id => id !== player.id) : [...selected, player.id])}
                      className={cn("flex min-h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left disabled:opacity-55",
                        active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/60")}>
                      <span className={cn("grid size-5 shrink-0 place-items-center rounded border", active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground")}>
                        {active && <Check className="size-4" aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-sm font-medium">{player.firstName} {player.lastName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {checkInProfiles[player.type].label} · {slots.get(player.timeSlotId ?? 0)?.name ?? "Sans créneau"}
                          {player.arrived ? " · Déjà arrivé" : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex shrink-0 flex-wrap gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" onClick={() => setStep("count")}><ArrowLeft /> Retour</Button>
              <Button type="button" className="flex-1" disabled={!validCount || selected.length !== total} onClick={() => {
                setSelection(selected);
                setStep("welcome");
              }}>Commencer l’accueil <ArrowRight /></Button>
            </div>
          </>
        ) : step === "welcome" ? (
          current ? (
            <WelcomeGuide key={`${current.id}:${current.revision}`} type={current.type} initialDetails={current.details}
              slot={slots.get(current.timeSlotId ?? 0)}
              teams={roster.teams.filter(team => team.id === current.details.squadId ||
                (team.timeSlotId === current.timeSlotId && (!team.type || team.type === current.type)))}
              groupSize={groupToPlace.length + 1}
              plannedTeamId={current.details.squadId === null ? plannedTeams.get(current.id) : undefined}
              summary={current.arrived && <p className="text-sm font-medium text-primary">Arrivée déjà enregistrée</p>}
              onSave={(details, keepTeamForGroup) => { void save(details, keepTeamForGroup); }} saving={saving} error={error}
              saveLabel={savedCount + 1 === selection.length ? "Enregistrer et terminer" : "Enregistrer et continuer"}
              onReload={onReload && (() => { setError(""); onReload(); })} />
          ) : (
            <p role="alert" className="text-sm text-muted-foreground">
              Cette fiche n’est plus disponible. Les arrivées déjà enregistrées sont conservées.
            </p>
          )
        ) : (
          <div className="space-y-4">
            <p className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 p-3 text-sm"><UserCheck className="size-5" aria-hidden /> Les arrivées ont été enregistrées.</p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setStep("count");
                setQuantity("1");
                setSelection([]);
                setPlannedTeams(new Map());
                setSavedCount(0);
                setSearch("");
                setType("all");
                setSlotFilter("all");
                setSelectedOnly(false);
              }}>Nouveau groupe</Button>
              <Button type="button" onClick={onClose}>Terminer</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
