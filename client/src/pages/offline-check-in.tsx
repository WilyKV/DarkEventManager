import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, LockKeyhole, RefreshCw, Trash2, Upload, UserPlus, WifiOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WelcomeDialog } from "@/components/welcome-dialog";
import { WelcomeGuide } from "@/components/welcome-guide";
import type { OfflineArrival } from "@/components/offline-group-welcome";
import { OfflineSquadRoster } from "@/components/offline-squad-roster";
import { sendOfflineChanges } from "@/db/offline-roster-sync";
import { OfflineAddPlayer } from "@/components/offline-add-player";
import { checkInProfileLabels, checkInProfiles, checkInRoles, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { formatEventDay } from "@shared/event-day";
import { OfflineNavigation } from "@/components/offline-navigation";
import { SheetClose } from "@/components/ui/sheet";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import {
  checkOfflineShell, getOfflineCopy, offlineKey, openOfflineCopy, removeOfflineCopy, storeOfflineCopy,
  type LocalOfflineSession,
} from "@/db/zombie-offline";
import {
  emptyOfflineChecklist, normalizePlayerName, offlineCheckInApi,
  type OfflineParticipant, type OfflineCheckIn, type OfflineSnapshot, type OfflineNewPlayer,
} from "@shared/zombie-offline";

type Copy = NonNullable<Awaited<ReturnType<typeof getOfflineCopy>>>;
type UnlockedCopy = { envelope: Copy; key: CryptoKey; data: LocalOfflineSession };
const apiUrl = offlineCheckInApi;

async function fetchSnapshot(): Promise<OfflineSnapshot> {
  const response = await fetch(apiUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (response.status === 401 || response.status === 403) throw new Error("Connectez-vous avec votre compte d’accueil.");
  if (!response.ok) throw new Error("Impossible de charger la liste depuis le serveur.");
  return response.json();
}

function newLocalSession(snapshot: OfflineSnapshot): LocalOfflineSession {
  return { ...snapshot, preparedAt: new Date().toISOString(), pending: [], conflicts: {} };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "OperationError") return "Phrase de déverrouillage incorrecte ou copie locale illisible.";
    if (error instanceof TypeError || error.name === "TimeoutError") return "Serveur inaccessible. Réessayez au retour du réseau.";
    const response = /^(\d+): (.*)$/.exec(error.message);
    if (response) {
      if (response[1] === "401") return "Reconnectez-vous au serveur. Vos modifications sont conservées sur cet appareil.";
      try { return JSON.parse(response[2]).message ?? "Le serveur a refusé l’envoi."; }
      catch { return "Le serveur a refusé l’envoi."; }
    }
    return error.message;
  }
  return "L’opération a échoué.";
}

export default function OfflineCheckInPage() {
  const { hasAnyRole, isLoading, user } = useAuth();
  const online = useOnlineStatus();
  const [copy, setCopy] = useState<Copy>();
  const [loaded, setLoaded] = useState(false);
  const [unlocked, setUnlocked] = useState<UnlockedCopy>();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [search, setSearch] = useState("");
  const [profile, setProfile] = useState<CheckInType | "all">("all");
  const [view, setView] = useState<"list" | "squads">("list");
  const [selectedId, setSelectedId] = useState<number>();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getOfflineCopy().then(setCopy).catch(error => setError(errorMessage(error))).finally(() => setLoaded(true));
  }, []);

  async function run(operation: () => Promise<void>) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      return true;
    } catch (error) {
      setError(errorMessage(error));
      return false;
    }
    finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function installOrUnlock(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (!window.isSecureContext || !crypto.subtle) throw new Error("Ouvrez l’application en HTTPS, ou sur 127.0.0.1 pour un essai sur cet ordinateur.");
      if (copy) {
        const key = await offlineKey(passphrase, copy.salt);
        setUnlocked({ envelope: copy, key, data: await openOfflineCopy(copy, key) });
      } else {
        if (passphrase.length < 12 || passphrase !== confirmPassphrase) {
          throw new Error("Saisissez deux fois la même phrase de déverrouillage, avec au moins 12 caractères.");
        }
        await checkOfflineShell();
        const data = newLocalSession(await fetchSnapshot());
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const key = await offlineKey(passphrase, salt);
        const envelope = await storeOfflineCopy(data, key, salt, undefined);
        setCopy(envelope);
        setUnlocked({ envelope, key, data });
        if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {});
        setNotice("Liste prête sur cet appareil. Vous pouvez ouvrir cette page en mode avion.");
      }
      setPassphrase("");
      setConfirmPassphrase("");
    });
  }

  async function persist(active: UnlockedCopy, data: LocalOfflineSession): Promise<UnlockedCopy> {
    const envelope = await storeOfflineCopy(data, active.key, active.envelope.salt, active.envelope);
    const next = { envelope, key: active.key, data };
    setCopy(envelope);
    setUnlocked(next);
    return next;
  }

  async function saveLocalCheckIns(active: UnlockedCopy, changes: {
    player: OfflineParticipant; state: OfflineCheckIn; overflowConfirmed: boolean;
  }[]) {
    const { data } = active;
    const updates = new Map<number, OfflineCheckIn>();
    const capacityOverrides = { ...data.capacityOverrides };
    for (const { player, state, overflowConfirmed } of changes) {
      if (JSON.stringify(player.state) === JSON.stringify(state)) continue;
      updates.set(player.id, state);
      if (overflowConfirmed && state.squadId !== null) capacityOverrides[player.id] = state.squadId;
      else if (state.squadId !== player.state.squadId) delete capacityOverrides[player.id];
    }
    if (!updates.size) return;
    await persist(active, {
      ...data,
      capacityOverrides,
      pending: Array.from(new Set([...data.pending, ...Array.from(updates.keys())])),
      participants: data.participants.map(player => {
        const state = updates.get(player.id);
        return state ? { ...player, state } : player;
      }),
    });
    const player = changes[0].player;
    setNotice(changes.length === 1
      ? `Fiche de ${player.firstName} ${player.lastName} enregistrée sur cet appareil.`
      : `${changes.length} arrivées enregistrées sur cet appareil.`);
  }

  async function saveGroup(active: UnlockedCopy, arrivals: OfflineArrival[]) {
    const saved = await run(async () => {
      const now = new Date().toISOString();
      const byId = new Map(active.data.participants.map(player => [player.id, player]));
      const changes = arrivals.map(({ player, details, overflowConfirmed }) => {
        const local = byId.get(player.id);
        if (!local || local.returned || local.revision !== player.revision) {
          throw new Error("Une fiche a changé. Vérifiez la sélection avant de valider le groupe.");
        }
        return { player: local, overflowConfirmed, state: {
          arrived: true,
          arrivedAt: local.state.arrivedAt ?? now,
          squadId: details.squadId,
          checklist: { ...local.state.checklist, ...details.checklist },
        } };
      });
      await saveLocalCheckIns(active, changes);
    });
    if (!saved) throw new Error("Impossible d’enregistrer la sélection sur cet appareil. Réessayez.");
  }

  async function addPlayer(active: UnlockedCopy, player: OfflineNewPlayer) {
    await run(async () => {
      const id = active.data.participants.reduce((lowest, candidate) => Math.min(lowest, candidate.id), 0) - 1;
      const requestId = crypto.randomUUID();
      const local: OfflineParticipant = {
        ...player, id, identity: requestId, revision: requestId, returned: false,
        state: { arrived: false, arrivedAt: null, squadId: null, checklist: emptyOfflineChecklist },
      };
      await persist(active, {
        ...active.data, participants: [...active.data.participants, local], pending: [...active.data.pending, id],
        additions: { ...active.data.additions, [id]: { requestId } },
      });
      setAddOpen(false);
      setView("list");
      setProfile(player.type);
      setSearch("");
      setSelectedId(id);
      setNotice("Nouvelle fiche enregistrée sur cet appareil.");
    });
  }

  async function archivePlayer(active: UnlockedCopy, player: OfflineParticipant) {
    await run(async () => {
      const addition = active.data.additions?.[player.id];
      if (addition?.started) throw new Error("Terminez l’envoi de cette fiche avant de la retirer.");
      if (!addition && !canArchive) throw new Error("Cette suppression est réservée à l’administration.");
      if (addition) {
        const additions = { ...active.data.additions };
        const conflicts = { ...active.data.conflicts };
        const capacityOverrides = { ...active.data.capacityOverrides };
        delete additions[player.id];
        delete conflicts[player.id];
        delete capacityOverrides[player.id];
        await persist(active, {
          ...active.data, additions, conflicts, capacityOverrides,
          pending: active.data.pending.filter(id => id !== player.id),
          participants: active.data.participants.filter(candidate => candidate.id !== player.id),
        });
      } else {
        await persist(active, { ...active.data, archives: Array.from(new Set([...(active.data.archives ?? []), player.id])) });
      }
      setDeleteId(undefined);
      setNotice(addition ? "Fiche locale supprimée." : "Fiche mise à la corbeille. Vous pouvez annuler avant l’envoi.");
    });
  }

  function undoArchive(active: UnlockedCopy, id: number) {
    void run(async () => {
      if (active.data.archiveAttempts?.includes(id)) throw new Error("Relancez l’envoi pour vérifier l’état de cette suppression.");
      await persist(active, { ...active.data, archives: active.data.archives?.filter(playerId => playerId !== id) });
      setNotice("Fiche remise dans la liste.");
    });
  }

  async function sync(active: UnlockedCopy) {
    let current = active;
    try {
      const { sent, remaining } = await sendOfflineChanges(active.data, async data => {
        current = await persist(current, data);
        return current.data;
      }, errorMessage);
      if (remaining) setError(`${remaining} fiche(s) à revoir. Les modifications sont conservées sur cet appareil.`);
      if (sent) setNotice(`${sent} fiche(s) confirmée(s) par le serveur.`);
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/squads/with-participants"] });
    }
  }

  function restoreFromServer(active: UnlockedCopy, player: OfflineParticipant) {
    if (!window.confirm(`Remplacer les modifications locales de ${player.firstName} ${player.lastName} par la fiche du serveur ?`)) return;
    void run(async () => {
      const snapshot = await fetchSnapshot();
      if (snapshot.ownerId !== active.data.ownerId) throw new Error("Reconnectez-vous avec le compte qui a préparé la liste.");
      const live = snapshot.participants.find(p => p.id === player.id);
      const conflicts = { ...active.data.conflicts };
      const capacityOverrides = { ...active.data.capacityOverrides };
      delete conflicts[player.id];
      delete capacityOverrides[player.id];
      await persist(active, {
        ...active.data,
        eventDay: snapshot.eventDay,
        timeSlots: snapshot.timeSlots,
        squads: snapshot.squads,
        pending: active.data.pending.filter(id => id !== player.id),
        conflicts, capacityOverrides,
        participants: active.data.participants.flatMap(p => p.id !== player.id ? [p] : live ? [live] : []),
      });
      setSelectedId(undefined);
      setNotice("La fiche locale a été mise à jour.");
    });
  }

  const data = unlocked?.data;
  const archived = new Set(data?.archives);
  const participants = data?.participants.filter(player => !archived.has(player.id)) ?? [];
  const toDelete = participants.find(player => player.id === deleteId);
  const canArchive = data?.canDeleteParticipants ?? (user?.id === data?.ownerId && hasAnyRole(["admin"]));
  const selected = participants.find(player => player.id === selectedId);
  const words = normalizePlayerName(search).trim().split(/\s+/).filter(Boolean);
  const visibleProfile = data?.profileTypes.some(type => type === profile) ? profile : "all";
  const matches = participants.filter(player => {
    const name = normalizePlayerName(`${player.firstName} ${player.lastName}`);
    return (visibleProfile === "all" || player.type === visibleProfile) && words.every(word => name.includes(word));
  }).sort((a, b) => a.firstName.localeCompare(b.firstName, "fr") || a.lastName.localeCompare(b.lastName, "fr"));
  const slots = new Map(data?.timeSlots.map(slot => [slot.id, slot.name]));
  const teams = new Map(data?.squads.map(team => [team.id, team.number]));
  const pending = new Set([...(data?.pending ?? []), ...Array.from(archived)]);
  const canPrepare = hasAnyRole(checkInRoles);
  const counts = new Map<number, number>();
  if (welcomeOpen || selected) {
    for (const { state } of participants) {
      if (state.squadId !== null) counts.set(state.squadId, (counts.get(state.squadId) ?? 0) + 1);
    }
  }
  const welcomeTeams = data && (welcomeOpen || selected)
    ? data.squads.map(team => ({ ...team, members: counts.get(team.id) ?? 0 })) : [];
  const welcomeRoster: CheckInRoster | undefined = welcomeOpen && data ? {
    players: participants.map(player => ({
      id: player.id, firstName: player.firstName, lastName: player.lastName, type: player.type,
      timeSlotId: player.timeSlotId, arrived: player.state.arrived, returned: player.returned,
      details: { squadId: player.state.squadId, checklist: player.state.checklist }, revision: player.revision,
    })),
    eventDay: data.eventDay,
    slots: data.timeSlots,
    teams: welcomeTeams,
  } : undefined;

  function refreshList(active: UnlockedCopy) {
    void run(async () => {
      if (active.data.pending.length || active.data.archives?.length) throw new Error("Envoyez les fiches locales avant d’actualiser la liste.");
      const snapshot = await fetchSnapshot();
      if (snapshot.ownerId !== active.data.ownerId) throw new Error("Reconnectez-vous avec le compte qui a préparé la liste.");
      await persist(active, newLocalSession(snapshot));
      setNotice("Liste mise à jour sur cet appareil.");
    });
  }

  function lockList() {
    setUnlocked(undefined);
    setSelectedId(undefined);
    setWelcomeOpen(false);
    setAddOpen(false);
    setDeleteId(undefined);
    setSearch("");
    setProfile("all");
    setView("list");
    setError("");
    setNotice("");
  }

  function deleteLocalCopy(active: UnlockedCopy) {
    if (active.data.pending.length || active.data.archives?.length || !window.confirm("Supprimer la copie de la liste sur cet appareil ?")) return;
    void run(async () => {
      await removeOfflineCopy(active.envelope);
      lockList();
      setCopy(undefined);
      setNotice("Copie locale supprimée.");
    });
  }

  return (
    <main className="mx-auto min-h-dvh max-w-3xl space-y-5 px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Accueil hors ligne</h1>
          {data?.eventDay && <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays className="size-4" aria-hidden /> <time dateTime={data.eventDay} className="capitalize">{formatEventDay(data.eventDay)}</time>
          </p>}
        </div>
        <span className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
          <WifiOff className="size-4" aria-hidden /> Copie locale
        </span>
      </header>

      {notice && <p role="status" className="rounded-lg border border-primary/40 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">{error}</p>}
      {!loaded ? <p role="status">Lecture de la copie locale…</p> : unlocked && data ? (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="font-medium">{participants.filter(player => player.state.arrived).length} / {participants.length} arrivés</p>
              <p className="text-sm text-muted-foreground">{pending.size ? `${pending.size} ${pending.size === 1 ? "fiche à envoyer" : "fiches à envoyer"} · Enregistré sur cet appareil` : "Aucune fiche à envoyer"}</p>
              {!online && <p className="mt-1 text-sm text-amber-300">Hors connexion · Vous pouvez continuer la saisie.</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy || !data.profileTypes.length} onClick={() => setAddOpen(true)}>
                <UserPlus aria-hidden /> Ajouter un joueur
              </Button>
              {online && pending.size > 0 && (!isLoading && !user
                ? <Link href="/login" className={buttonVariants({ variant: "outline" })}>Se reconnecter pour envoyer</Link>
                : <Button variant="outline" disabled={busy || isLoading} onClick={() => run(() => sync(unlocked))}>Envoyer au serveur</Button>)}
            </div>
          </section>
          {hasAnyRole(["admin"]) && data.profileTypes.length < 3 && (
            <p className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Cette copie contient une partie des listes. Utilisez Menu → Actualiser la liste pour récupérer les autres profils.</p>
          )}
          {view === "squads" ? <OfflineSquadRoster {...data} participants={participants} /> : <>
          <section id="offline-roster" aria-label="Liste des participants" className="space-y-2">
            {data.profileTypes.length > 1 && <div role="group" aria-label="Filtrer par profil" className="grid grid-flow-col auto-cols-fr gap-1.5">
              <Button type="button" className="px-1 text-xs sm:text-sm" aria-pressed={visibleProfile === "all"} variant={visibleProfile === "all" ? "default" : "outline"}
                onClick={() => setProfile("all")}>Tous</Button>
              {data.profileTypes.map(type => <Button key={type} type="button" className="px-1 text-xs sm:text-sm" aria-pressed={visibleProfile === type}
                variant={visibleProfile === type ? "default" : "outline"} onClick={() => setProfile(type)}>{checkInProfileLabels[type]}</Button>)}
            </div>}
            <Input type="search" aria-label="Rechercher un participant" placeholder="Prénom ou nom" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11" />
          </section>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {matches.map(player => (
              <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{player.firstName} {player.lastName}</p>
                  <p className="break-words text-sm text-muted-foreground">{checkInProfiles[player.type].label} · {slots.get(player.timeSlotId ?? 0) ?? "Sans créneau"}{player.state.squadId && teams.has(player.state.squadId) ? ` · Équipe ${teams.get(player.state.squadId)}` : ""}</p>
                  {player.id < 0 && <p className="text-xs text-muted-foreground">Créé sur cet appareil</p>}
                  {data.conflicts[player.id] && <p className="text-sm text-amber-400">{data.conflicts[player.id]}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant={player.state.arrived ? "outline" : "default"} disabled={busy || player.returned} onClick={() => setSelectedId(player.id)}
                    aria-label={`${player.state.arrived ? "Revoir" : "Accueillir"} ${player.firstName} ${player.lastName}`}>
                    {player.returned ? "Sorti" : player.state.arrived ? "Arrivé" : "Accueillir"}
                  </Button>
                  {(player.id < 0 || canArchive) && <Button type="button" variant="ghost" size="icon" className="size-11 text-muted-foreground hover:text-destructive"
                    disabled={busy} onClick={() => setDeleteId(player.id)}
                    aria-label={`Supprimer la fiche de ${player.firstName} ${player.lastName}`}>
                    <Trash2 aria-hidden />
                  </Button>}
                </div>
              </li>
            ))}
          </ul>
          {matches.length === 0 && <p role="status" className="text-sm text-muted-foreground">Aucun participant trouvé.</p>}
          </>}
          {archived.size > 0 && (
            <details className="rounded-xl border border-border bg-card p-3">
              <summary className="cursor-pointer font-medium">Corbeille locale ({archived.size})</summary>
              <ul className="mt-2 divide-y divide-border">
                {data.participants.filter(player => archived.has(player.id)).map(player => (
                  <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div>
                      <p>{player.firstName} {player.lastName}</p>
                      {data.conflicts[player.id] && <p className="max-w-md text-amber-400">{data.conflicts[player.id]}</p>}
                      {data.archiveAttempts?.includes(player.id) && <p className="text-muted-foreground">Relancez l’envoi pour vérifier la suppression.</p>}
                    </div>
                    <Button variant="outline" size="sm" disabled={busy || data.archiveAttempts?.includes(player.id)}
                      onClick={() => undoArchive(unlocked, player.id)}>Remettre dans la liste</Button>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {addOpen && <OfflineAddPlayer data={data} busy={busy} error={error} onClose={() => setAddOpen(false)}
            onSave={player => void addPlayer(unlocked, player)} />}
          {toDelete && (
            <Dialog open onOpenChange={open => { if (!open && !busy) setDeleteId(undefined); }}>
              <DialogContent className="w-[calc(100%-1.25rem)] max-w-md rounded-xl">
                <DialogHeader className="pr-6 text-left">
                  <DialogTitle>Supprimer la fiche de {toDelete.firstName} {toDelete.lastName} ?</DialogTitle>
                  <DialogDescription>
                    {data.additions?.[toDelete.id]?.started
                      ? "Terminez son envoi pour vérifier si la fiche existe sur le serveur."
                      : toDelete.id < 0 ? "Cette fiche sera retirée de cet appareil."
                        : "Elle sera retirée de la liste. Vous pourrez annuler dans la corbeille avant l’envoi au serveur."}
                  </DialogDescription>
                </DialogHeader>
                {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => setDeleteId(undefined)}>Annuler</Button>
                  <Button type="button" variant="destructive" loading={busy} disabled={data.additions?.[toDelete.id]?.started}
                    onClick={() => void archivePlayer(unlocked, toDelete)}>Supprimer la fiche</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {welcomeOpen && (
            <WelcomeDialog roster={welcomeRoster} profileTypes={data.profileTypes} onClose={() => setWelcomeOpen(false)}
              onSaveOfflineGroup={arrivals => saveGroup(unlocked, arrivals)} />
          )}
          {selected && (
            <CheckInDialog key={selected.id} player={selected}
              slot={data.timeSlots.find(slot => slot.id === selected.timeSlotId)}
              teams={welcomeTeams.filter(team => team.id === selected.state.squadId ||
                (team.timeSlotId === selected.timeSlotId && team.type === selected.type))}
              conflict={data.conflicts[selected.id]} busy={busy} error={error}
              onClose={() => setSelectedId(undefined)} onRestore={online && selected.id > 0 ? () => restoreFromServer(unlocked, selected) : undefined}
              onSave={(state, overflowConfirmed) => run(async () => {
                await saveLocalCheckIns(unlocked, [{ player: selected, state, overflowConfirmed }]);
                setSelectedId(undefined);
              })} />
          )}
        </>
      ) : copy || (online && canPrepare) ? (
        <form className="max-w-lg space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6" onSubmit={installOrUnlock}>
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-lg font-semibold"><LockKeyhole className="size-4 text-emerald-300" aria-hidden />{copy ? "Déverrouiller la copie locale" : "Préparer cet appareil"}</h2>
            <p className="text-sm text-muted-foreground">
              {copy
                ? "Saisissez la phrase choisie pour la copie locale. Elle fonctionne aussi en mode avion."
                : "La liste sera téléchargée et chiffrée sur cet appareil. Choisissez une phrase d’au moins 12 caractères, différente du mot de passe de votre compte."}
            </p>
          </div>
          {!copy && <p className="text-sm text-muted-foreground">Si vous utilisez l’icône installée pour la séance, préparez la liste depuis cette icône. Gardez la phrase pour rouvrir la liste sur cet appareil.</p>}
          <label className="block space-y-2 text-sm">Phrase de déverrouillage locale
            <Input className="min-h-11" type="password" autoComplete={copy ? "off" : "new-password"} required minLength={copy ? undefined : 12} value={passphrase} onChange={event => setPassphrase(event.target.value)} />
          </label>
          {!copy && <label className="block space-y-2 text-sm">Confirmer la phrase
            <Input className="min-h-11" type="password" autoComplete="new-password" required minLength={12} value={confirmPassphrase} onChange={event => setConfirmPassphrase(event.target.value)} />
          </label>}
          <Button className="min-h-11" type="submit" disabled={busy}>{copy ? "Ouvrir la liste" : "Télécharger la liste chiffrée"}</Button>
        </form>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4" role="status">
          {isLoading ? <p>Vérification du compte…</p> : online ? (
            <>
              <p>Une connexion au serveur et un compte d’accueil sont nécessaires pour télécharger la liste.</p>
              <Link href="/login" className={buttonVariants()}>Se connecter</Link>
            </>
          ) : <p>Aucune copie locale sur cet appareil. Rétablissez la connexion et préparez la liste avant de passer en mode avion.</p>}
        </div>
      )}
      <OfflineNavigation ready={Boolean(unlocked)} busy={busy} view={view}
        onList={() => setView("list")} onSquads={() => setView("squads")}
        onWelcome={() => setWelcomeOpen(true)}>
        {unlocked && <>
          <SheetClose asChild><Button type="button" variant="outline" disabled={busy || !online || !user || !pending.size}
            onClick={() => run(() => sync(unlocked))}><Upload /> Envoyer au serveur</Button></SheetClose>
          <SheetClose asChild><Button type="button" variant="outline" disabled={busy || !online || !user || pending.size > 0}
            onClick={() => refreshList(unlocked)}><RefreshCw /> Actualiser la liste</Button></SheetClose>
          <SheetClose asChild><Button type="button" variant="outline" disabled={busy} onClick={lockList}><LockKeyhole /> Verrouiller</Button></SheetClose>
          <SheetClose asChild><Button type="button" variant="ghost" disabled={busy || pending.size > 0}
            onClick={() => deleteLocalCopy(unlocked)}><Trash2 /> Supprimer la copie locale</Button></SheetClose>
        </>}
        {online && <SheetClose asChild><Link href={user ? "/overview" : "/login"} className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft /> {user ? "Accueil en ligne" : "Se connecter"}
        </Link></SheetClose>}
        {!unlocked && !online && <p className="text-sm text-muted-foreground">Ouvrez la copie locale pour accéder à la liste et à l’accueil.</p>}
      </OfflineNavigation>
    </main>
  );
}

function CheckInDialog({ player, slot, teams, conflict, busy, error, onClose, onSave, onRestore }: {
  player: OfflineParticipant;
  slot?: CheckInRoster["slots"][number];
  teams: CheckInRoster["teams"];
  conflict?: string;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (state: OfflineCheckIn, overflowConfirmed: boolean) => void;
  onRestore?: () => void;
}) {
  const [arrived, setArrived] = useState(true);
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.25rem)] max-w-xl flex-col overflow-hidden rounded-xl p-4 sm:p-6"
        onInteractOutside={event => event.preventDefault()}
        onEscapeKeyDown={event => { if (busy) event.preventDefault(); }}>
        <DialogHeader className="shrink-0 pr-7 text-left">
          <DialogTitle>{player.firstName} {player.lastName}</DialogTitle>
          <DialogDescription>Modifications enregistrées sur cet appareil.</DialogDescription>
        </DialogHeader>
        <WelcomeGuide type={player.type} initialDetails={{ squadId: player.state.squadId, checklist: player.state.checklist }}
          slot={slot} teams={teams} allowCapacityOverride review={player.state.arrived || Boolean(conflict)} saving={busy} error={error}
          saveLabel="Enregistrer sur cet appareil"
          onSave={(details, _, overflowConfirmed) => onSave({
            arrived,
            arrivedAt: arrived ? player.state.arrivedAt ?? new Date().toISOString() : null,
            squadId: details.squadId,
            checklist: { ...player.state.checklist, ...details.checklist },
          }, overflowConfirmed)}
          summary={<>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-sm font-semibold">
              <input type="checkbox" className="size-5 accent-primary" checked={arrived} disabled={busy}
                onChange={event => setArrived(event.target.checked)} /> Arrivé
            </label>
            {conflict && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-sm text-amber-400">{conflict}</p>
                <Button type="button" variant="outline" disabled={busy || !onRestore} onClick={onRestore}>Reprendre la fiche serveur</Button>
              </div>
            )}
          </>}
        />
      </DialogContent>
    </Dialog>
  );
}
