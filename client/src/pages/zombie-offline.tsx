import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  checkOfflineShell, getOfflineCopy, offlineKey, openOfflineCopy, removeOfflineCopy, storeOfflineCopy,
  type LocalZombieSession,
} from "@/db/zombie-offline";
import {
  checklistComplete, normalizePlayerName, zombieChecklist,
  type OfflineZombie, type ZombieCheckIn, type ZombieSnapshot, type ZombieSyncResult,
} from "@shared/zombie-offline";

type Copy = NonNullable<Awaited<ReturnType<typeof getOfflineCopy>>>;
type UnlockedCopy = { envelope: Copy; key: CryptoKey; data: LocalZombieSession };
const apiUrl = "/api/zombie-offline";

async function fetchSnapshot(): Promise<ZombieSnapshot> {
  const response = await fetch(apiUrl, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (response.status === 401 || response.status === 403) throw new Error("Connectez-vous avec votre compte d’accueil zombie.");
  if (!response.ok) throw new Error("Impossible de charger la liste depuis le serveur.");
  return response.json();
}

function newLocalSession(snapshot: ZombieSnapshot): LocalZombieSession {
  return { ...snapshot, preparedAt: new Date().toISOString(), pending: [], conflicts: {} };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "OperationError") return "Phrase secrète incorrecte ou copie locale illisible.";
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

export default function ZombieOfflinePage() {
  const { hasAnyRole } = useAuth();
  const [copy, setCopy] = useState<Copy>();
  const [loaded, setLoaded] = useState(false);
  const [unlocked, setUnlocked] = useState<UnlockedCopy>();
  const [passphrase, setPassphrase] = useState("");
  const [confirmPassphrase, setConfirmPassphrase] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number>();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    getOfflineCopy().then(setCopy).catch(error => setError(errorMessage(error))).finally(() => setLoaded(true));
  }, []);

  async function run(operation: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try { await operation(); }
    catch (error) { setError(errorMessage(error)); }
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
          throw new Error("Saisissez deux fois la même phrase secrète, avec au moins 12 caractères.");
        }
        await checkOfflineShell();
        const data = newLocalSession(await fetchSnapshot());
        if (!data.participants.length) throw new Error("Importez la liste zombie avant de préparer cet appareil.");
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

  async function persist(active: UnlockedCopy, data: LocalZombieSession): Promise<UnlockedCopy> {
    const envelope = await storeOfflineCopy(data, active.key, active.envelope.salt, active.envelope);
    const next = { envelope, key: active.key, data };
    setCopy(envelope);
    setUnlocked(next);
    return next;
  }

  async function sync(active: UnlockedCopy) {
    let current = active;
    const pending = new Set(active.data.pending);
    const updates = active.data.participants.filter(player => pending.has(player.id))
      .map(({ id, identity, revision, state }) => ({ id, identity, revision, state }));
    let sent = 0;
    for (let start = 0; start < updates.length; start += 50) {
      const batch = updates.slice(start, start + 50);
      const response = await apiRequest("POST", `${apiUrl}/sync`, { ownerId: current.data.ownerId, updates: batch }, AbortSignal.timeout(20_000));
      const { results } = await response.json() as { results: ZombieSyncResult[] };
      const resultsById = new Map(results.map(result => [result.id, result]));
      if (results.length !== batch.length || batch.some(update => !resultsById.has(update.id))) {
        throw new Error("Réponse du serveur incomplète. Les modifications restent sur cet appareil.");
      }
      const conflicts = { ...current.data.conflicts };
      for (const result of results) {
        if ("error" in result) conflicts[result.id] = result.error;
        else {
          delete conflicts[result.id];
          pending.delete(result.id);
          sent++;
        }
      }
      current = await persist(current, {
        ...current.data, pending: Array.from(pending), conflicts,
        participants: current.data.participants.map(player => {
          const result = resultsById.get(player.id);
          return result && "revision" in result ? { ...player, revision: result.revision } : player;
        }),
      });
      void queryClient.invalidateQueries({ queryKey: ["/api/participants"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/squads/with-participants"] });
    }
    if (pending.size) setError(`${pending.size} fiche(s) à revoir. Les modifications sont conservées sur cet appareil.`);
    if (sent) setNotice(`${sent} fiche(s) confirmée(s) par le serveur.`);
  }

  function restoreFromServer(active: UnlockedCopy, player: OfflineZombie) {
    if (!window.confirm(`Remplacer les modifications locales de ${player.firstName} ${player.lastName} par la fiche du serveur ?`)) return;
    void run(async () => {
      const snapshot = await fetchSnapshot();
      if (snapshot.ownerId !== active.data.ownerId) throw new Error("Reconnectez-vous avec le compte qui a préparé la liste.");
      const live = snapshot.participants.find(p => p.id === player.id);
      const conflicts = { ...active.data.conflicts };
      delete conflicts[player.id];
      await persist(active, {
        ...active.data,
        timeSlots: snapshot.timeSlots,
        squads: snapshot.squads,
        pending: active.data.pending.filter(id => id !== player.id),
        conflicts,
        participants: active.data.participants.flatMap(p => p.id !== player.id ? [p] : live ? [live] : []),
      });
      setSelectedId(undefined);
      setNotice("La fiche locale a été mise à jour.");
    });
  }

  const data = unlocked?.data;
  const participants = data?.participants ?? [];
  const selected = participants.find(player => player.id === selectedId);
  const words = normalizePlayerName(search).trim().split(/\s+/).filter(Boolean);
  const matches = participants.filter(player => {
    const name = normalizePlayerName(`${player.firstName} ${player.lastName}`);
    return words.every(word => name.includes(word));
  }).sort((a, b) => a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr"));
  const slots = new Map(data?.timeSlots.map(slot => [slot.id, slot.name]));
  const teams = new Map(data?.squads.map(team => [team.id, team.number]));
  const pending = new Set(data?.pending);
  const canPrepare = hasAnyRole(["admin", "staff_zombie"]);

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-5 p-4 pb-10 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <Link href="/zombie" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Zombies</Link>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">Accueil zombie hors ligne</h1>
        </div>
        {unlocked && <Button variant="outline" disabled={busy} onClick={() => { setUnlocked(undefined); setSelectedId(undefined); setSearch(""); setNotice(""); setError(""); }}><LockKeyhole /> Verrouiller</Button>}
      </header>

      {notice && <p role="status" className="rounded-lg border border-primary/40 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/60 p-3 text-sm">{error}</p>}
      {!loaded ? <p role="status">Lecture de la copie locale…</p> : unlocked && data ? (
        <>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div>
              <p className="font-medium">{participants.filter(player => player.state.arrived).length} / {participants.length} arrivés</p>
              <p className="text-sm text-muted-foreground">{pending.size ? `${pending.size} fiche(s) à envoyer` : "Aucune fiche à envoyer"}</p>
            </div>
            <Button disabled={busy || !pending.size} onClick={() => run(() => sync(unlocked))}>Envoyer au serveur</Button>
          </section>
          <Input type="search" aria-label="Rechercher un joueur" placeholder="Prénom ou nom" value={search} onChange={event => setSearch(event.target.value)} className="min-h-11" />
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {matches.map(player => (
              <li key={player.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{player.firstName} {player.lastName}</p>
                  <p className="text-sm text-muted-foreground">{slots.get(player.timeSlotId ?? 0) ?? "Sans créneau"}{player.state.squadId && teams.has(player.state.squadId) ? ` · Équipe ${teams.get(player.state.squadId)}` : ""}</p>
                  {data.conflicts[player.id] && <p className="text-sm text-amber-400">{data.conflicts[player.id]}</p>}
                </div>
                <Button variant={player.state.arrived ? "outline" : "default"} disabled={busy || player.returned} onClick={() => setSelectedId(player.id)}
                  aria-label={`${player.state.arrived ? "Revoir" : "Accueillir"} ${player.firstName} ${player.lastName}`}>
                  {player.returned ? "Sorti" : player.state.arrived ? "Arrivé" : "Accueillir"}
                </Button>
              </li>
            ))}
          </ul>
          {matches.length === 0 && <p role="status" className="text-sm text-muted-foreground">Aucun joueur trouvé.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy || pending.size > 0} onClick={() => run(async () => {
              const snapshot = await fetchSnapshot();
              if (snapshot.ownerId !== data.ownerId) throw new Error("Reconnectez-vous avec le compte qui a préparé la liste.");
              await persist(unlocked, newLocalSession(snapshot));
              setNotice("Liste mise à jour sur cet appareil.");
            })}>Actualiser la liste</Button>
            <Button variant="ghost" disabled={busy || pending.size > 0} onClick={() => {
              if (!window.confirm("Supprimer la copie de la liste sur cet appareil ?")) return;
              void run(async () => {
                await removeOfflineCopy(unlocked.envelope);
                setCopy(undefined);
                setUnlocked(undefined);
                setNotice("Copie locale supprimée.");
              });
            }}>Supprimer la copie locale</Button>
          </div>
          {selected && (
            <CheckInDialog key={selected.id} player={selected} data={data} busy={busy} error={error}
              onClose={() => setSelectedId(undefined)} onRestore={() => restoreFromServer(unlocked, selected)}
              onSave={state => run(async () => {
                const changed = JSON.stringify(selected.state) !== JSON.stringify(state);
                if (changed) {
                  await persist(unlocked, {
                    ...data,
                    pending: Array.from(new Set([...data.pending, selected.id])),
                    participants: data.participants.map(player => player.id === selected.id ? { ...player, state } : player),
                  });
                  setNotice(`Fiche de ${selected.firstName} ${selected.lastName} enregistrée sur cet appareil.`);
                }
                setSelectedId(undefined);
              })} />
          )}
        </>
      ) : copy || canPrepare ? (
        <form className="max-w-md space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6" onSubmit={installOrUnlock}>
          <p className="text-sm text-muted-foreground">{copy ? "Saisissez la phrase secrète choisie lors de la préparation." : "Choisissez une phrase secrète propre à cet appareil. Vous en aurez besoin pour rouvrir la liste sans réseau."}</p>
          <label className="block space-y-2 text-sm">Phrase secrète
            <Input type="password" autoComplete={copy ? "current-password" : "new-password"} required value={passphrase} onChange={event => setPassphrase(event.target.value)} />
          </label>
          {!copy && <label className="block space-y-2 text-sm">Confirmer la phrase secrète
            <Input type="password" autoComplete="new-password" required value={confirmPassphrase} onChange={event => setConfirmPassphrase(event.target.value)} />
          </label>}
          <Button type="submit" disabled={busy}>{copy ? "Ouvrir la liste" : "Préparer cet appareil"}</Button>
        </form>
      ) : (
        <div className="space-y-3">
          <p>Connectez-vous avec votre compte d’accueil pour préparer la liste sur cet appareil.</p>
          <Link href="/login" className={buttonVariants()}>Se connecter</Link>
        </div>
      )}
    </main>
  );
}

function CheckInDialog({ player, data, busy, error, onClose, onSave, onRestore }: {
  player: OfflineZombie;
  data: LocalZombieSession;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (state: ZombieCheckIn) => void;
  onRestore: () => void;
}) {
  const [state, setState] = useState(player.state);
  const counts = new Map<number, number>();
  for (const other of data.participants) {
    const id = other.state.squadId;
    if (other.id !== player.id && id != null) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const teams = data.squads.filter(team => team.timeSlotId === player.timeSlotId || team.id === player.state.squadId);
  return (
    <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{player.firstName} {player.lastName}</DialogTitle>
          <DialogDescription>Modifications enregistrées sur cet appareil.</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); onSave(state); }}>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 text-sm font-semibold">
            <input type="checkbox" className="size-5 accent-primary" checked={state.arrived} onChange={event => {
              const arrived = event.target.checked;
              setState({ ...state, arrived, arrivedAt: arrived ? player.state.arrivedAt ?? new Date().toISOString() : null });
            }} /> Arrivé
          </label>
          <label className="block space-y-1 text-sm">Équipe
            <select className="block min-h-11 w-full rounded-md border border-input bg-background px-3" value={state.squadId ?? ""}
              onChange={event => setState({ ...state, squadId: event.target.value ? Number(event.target.value) : null })}>
              <option value="">Sans équipe</option>
              {teams.map(team => {
                const count = counts.get(team.id) ?? 0;
                const full = team.maxMembers != null && count >= team.maxMembers && team.id !== player.state.squadId;
                return <option key={team.id} value={team.id} disabled={full}>Équipe {team.number}{full ? " (complète)" : ""}</option>;
              })}
            </select>
          </label>
          <fieldset className="space-y-1">
            <legend className="text-sm font-semibold">{checklistComplete(state.checklist) ? "Checklist terminée" : "Checklist"}</legend>
            {(Object.keys(zombieChecklist) as Array<keyof typeof zombieChecklist>).map(key => (
              <label key={key} className="flex min-h-10 items-center gap-3 text-sm">
                <input type="checkbox" className="size-5 accent-primary" checked={state.checklist[key]}
                  onChange={event => setState({ ...state, checklist: { ...state.checklist, [key]: event.target.checked } })} />
                {zombieChecklist[key]}
              </label>
            ))}
          </fieldset>
          {data.conflicts[player.id] && (
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-sm text-amber-400">{data.conflicts[player.id]}</p>
              <Button type="button" variant="outline" disabled={busy} onClick={onRestore}>Reprendre la fiche serveur</Button>
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={busy}>Enregistrer sur cet appareil</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
