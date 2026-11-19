import { useId, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Search, UserCheck } from "lucide-react";
import { checkInChecklistComplete, checkInProfiles, checkInTypes, type CheckInDetails, type CheckInPlayer, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { normalizePlayerName, zombieChecklist } from "@shared/zombie-offline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Step = "count" | "select" | "welcome" | "done";

interface WelcomeDialogProps {
  roster?: CheckInRoster;
  unavailable?: ReactNode;
  onClose: () => void;
  onSave: (player: CheckInPlayer, details: CheckInDetails) => Promise<void>;
  onReload?: () => void;
}

const selectClass = "min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm sm:px-3";

export function WelcomeDialog({ roster, unavailable, onClose, onSave, onReload }: WelcomeDialogProps) {
  const countId = useId();
  const [step, setStep] = useState<Step>("count");
  const [quantity, setQuantity] = useState("1");
  const [selection, setSelection] = useState<number[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<CheckInType | "all">("all");
  const [slotFilter, setSlotFilter] = useState("all");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const eligible = useMemo(() => (roster?.players ?? [])
    .filter(player => !player.returned)
    .sort((a, b) => Number(a.arrived) - Number(b.arrived) ||
      a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr")), [roster]);
  const byId = new Map(eligible.map(player => [player.id, player]));
  const slots = new Map(roster?.slots.map(slot => [slot.id, slot]));
  const visibleTypes = checkInTypes.filter(value => eligible.some(player => player.type === value));
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

  async function save(details: CheckInDetails) {
    if (saving || !current) return;
    setSaving(true);
    setError("");
    try {
      await onSave(current, details);
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
                  <div className="relative">
                    <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
                    <Input type="search" aria-label="Rechercher une personne" placeholder="Prénom ou nom"
                      className="min-h-11 pl-9" value={search} onChange={event => setSearch(event.target.value)} />
                  </div>
                  <div className={cn("grid gap-2", visibleTypes.length > 1 && "grid-cols-2")}>
                    {visibleTypes.length > 1 && (
                      <select aria-label="Filtrer par profil" className={selectClass} value={type} onChange={event => {
                        setType(event.target.value as typeof type);
                        setSlotFilter("all");
                      }}>
                        <option value="all">Tous les profils</option>
                        {visibleTypes.map(value => <option key={value} value={value}>{checkInProfiles[value].label}</option>)}
                      </select>
                    )}
                    <select aria-label="Filtrer par créneau" className={selectClass} value={slotFilter}
                      onChange={event => setSlotFilter(event.target.value)}>
                      <option value="all">Tous les créneaux</option>
                      {visibleSlots.map(slot => <option key={slot.id} value={slot.id}>{slot.name}</option>)}
                      {eligible.some(player => player.timeSlotId == null && (type === "all" || player.type === type)) &&
                        <option value="none">Sans créneau</option>}
                    </select>
                  </div>
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
            <WelcomeForm key={`${current.id}:${current.revision}`} player={current} roster={roster}
              last={savedCount + 1 === selection.length} save={save} saving={saving} error={error} onReload={onReload && (() => { setError(""); onReload(); })} />
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

function WelcomeForm({ player, roster, last, save, saving, error, onReload }: {
  player: CheckInPlayer;
  roster: CheckInRoster;
  last: boolean;
  save: (details: CheckInDetails) => Promise<void>;
  saving: boolean;
  error: string;
  onReload?: () => void;
}) {
  const [details, setDetails] = useState(player.details);
  const slot = roster.slots.find(slot => slot.id === player.timeSlotId);
  const teams = roster.teams.filter(team => team.timeSlotId === player.timeSlotId || team.id === player.details.squadId);
  const checklist = checkInProfiles[player.type].checklist;

  return (
    <form className="flex min-h-0 flex-col" onSubmit={event => { event.preventDefault(); void save(details); }}>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain pb-3">
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <p className="font-medium">{slot?.name ?? "Sans créneau"}</p>
          {slot && <p className="text-muted-foreground">Briefing {slot.briefingTime} · Jeu {slot.gameTime}</p>}
          {player.arrived && <p className="text-emerald-300">Arrivée déjà enregistrée</p>}
        </div>
        {player.type !== "staff" && (
          <label className="block space-y-1 text-sm font-medium">Équipe
            <select className={selectClass} value={details.squadId ?? ""} disabled={saving}
              onChange={event => setDetails({ ...details, squadId: event.target.value ? Number(event.target.value) : null })}>
              <option value="">Sans équipe</option>
              {teams.map(team => {
                const full = team.maxMembers != null && team.members >= team.maxMembers && team.id !== player.details.squadId;
                return <option key={team.id} value={team.id} disabled={full}>Équipe {team.number}{full ? " (complète)" : ""}</option>;
              })}
            </select>
          </label>
        )}
        {checklist.length > 0 && (
          <fieldset className="space-y-0.5" disabled={saving}>
            <legend className="text-sm font-semibold">{checkInChecklistComplete(player.type, details) ? "Checklist terminée" : "Checklist"}</legend>
            {checklist.map(item => (
              <label key={item} className="flex min-h-10 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={Boolean(details.checklist[item])}
                  onChange={event => setDetails({ ...details, checklist: { ...details.checklist, [item]: event.target.checked } })} />
                {zombieChecklist[item]}
              </label>
            ))}
          </fieldset>
        )}
        {error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm text-destructive">{error}</p>
            {onReload && <Button type="button" size="sm" variant="outline" onClick={onReload}>Actualiser la fiche</Button>}
          </div>
        )}
      </div>
      <Button type="submit" className="w-full shrink-0" disabled={saving}>
        {saving ? "Enregistrement…" : last ? "Enregistrer et terminer" : "Enregistrer et continuer"}
      </Button>
    </form>
  );
}
