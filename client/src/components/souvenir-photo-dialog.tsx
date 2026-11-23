import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Camera, Search } from "lucide-react";
import { checkInProfiles, checkInRosterPath, type CheckInRoster, type CheckInType } from "@shared/check-in";
import { cardsPath } from "@shared/participant-card";
import { normalizePlayerName, offlineCheckInPage } from "@shared/zombie-offline";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { SouvenirPhoto } from "./participant-card";

type PhotoPlayer = { id: number; firstName: string; lastName: string; type: CheckInType };
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("");
const nameOrder = new Intl.Collator("fr", { sensitivity: "base" });
function surnameInitial(name: string) {
  const letter = normalizePlayerName(name).trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(letter) ? letter : "#";
}

export function SouvenirPhotoDialog({ players, fallback, pendingPhotos, busy, onClose, onSave, onCancel }: {
  players?: readonly PhotoPlayer[];
  fallback?: React.ReactNode;
  pendingPhotos?: Record<number, string | null>;
  busy?: boolean;
  onClose: () => void;
  onSave: (id: number, photo: string | null) => Promise<void>;
  onCancel?: (id: number) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [letter, setLetter] = useState("");
  const [selectedId, setSelectedId] = useState<number>();
  const sorted = useMemo(() => [...(players ?? [])].sort((a, b) =>
    nameOrder.compare(a.lastName, b.lastName) || nameOrder.compare(a.firstName, b.firstName)), [players]);
  const selected = sorted.find(player => player.id === selectedId);
  const initials = new Set(sorted.map(player => surnameInitial(player.lastName)));
  const words = normalizePlayerName(search).trim().split(/\s+/).filter(Boolean);
  const visible = sorted.filter(player => (!letter || surnameInitial(player.lastName) === letter) &&
    words.every(word => normalizePlayerName(`${player.firstName} ${player.lastName}`).includes(word)));

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="flex h-dvh max-h-dvh w-full max-w-none flex-col gap-4 overflow-hidden rounded-none border-0 p-4 sm:h-[min(780px,calc(100dvh-2rem))] sm:max-w-2xl sm:rounded-2xl sm:border sm:p-6">
      <DialogHeader className="shrink-0 pr-8 text-left">
        <DialogTitle className="flex items-center gap-2 text-2xl"><Camera className="size-6 text-primary" aria-hidden /> Photos souvenir</DialogTitle>
        <DialogDescription>{selected ? `${selected.firstName} ${selected.lastName}` : "Choisissez la personne à photographier."}</DialogDescription>
      </DialogHeader>
      {!players ? fallback : selected ? <div className="space-y-3 overflow-y-auto">
        <Button type="button" variant="outline" disabled={busy} onClick={() => setSelectedId(undefined)}><ArrowLeft /> Liste des participants</Button>
        <SouvenirPhoto key={selected.id} pendingPhoto={pendingPhotos?.[selected.id]} disabled={busy}
          onSave={photo => onSave(selected.id, photo)} onCancelPendingPhoto={onCancel && (() => onCancel(selected.id))} />
      </div> : <>
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden />
          <Input className="min-h-11 pl-9" type="search" aria-label="Rechercher pour une photo" placeholder="Nom ou prénom"
            value={search} onChange={event => { setSearch(event.target.value); setLetter(""); }} />
        </div>
        <div role="group" aria-label="Initiale du nom de famille" className="grid shrink-0 grid-cols-9 gap-1 sm:grid-cols-[repeat(14,minmax(0,1fr))]">
          {alphabet.map(value => <Button key={value} type="button" variant={letter === value ? "default" : "outline"}
            aria-pressed={letter === value} disabled={!initials.has(value)} className="h-10 px-0 text-base"
            onClick={() => { setLetter(letter === value ? "" : value); setSearch(""); }}>{value}</Button>)}
        </div>
        <ul className="min-h-0 space-y-1 overflow-y-auto" aria-label="Participants">
          {visible.map(player => <li key={player.id}>
            <button type="button" className="flex min-h-12 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left hover:bg-muted"
              onClick={() => setSelectedId(player.id)}>
              <span className="min-w-0 break-words font-medium">{player.lastName} {player.firstName}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{checkInProfiles[player.type].label}</span>
            </button>
          </li>)}
          {!visible.length && <li className="py-3 text-sm text-muted-foreground">Aucun participant trouvé.</li>}
        </ul>
      </>}
    </DialogContent>
  </Dialog>;
}

export function OnlineSouvenirPhotoDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const online = useOnlineStatus();
  const query = useQuery<CheckInRoster>({
    queryKey: [checkInRosterPath, user?.id], enabled: online, refetchOnMount: "always",
    queryFn: async ({ signal }) => {
      const response = await fetch(checkInRosterPath, { signal, cache: "no-store" });
      if (!response.ok) throw new Error("Impossible de charger la liste des participants.");
      return response.json();
    },
  });
  return <SouvenirPhotoDialog players={online ? query.data?.players : undefined} onClose={onClose}
    onSave={async (id, photo) => { await apiRequest("PATCH", `${cardsPath}/${id}/photo`, { photo }); }}
    fallback={!online || query.isError ? <div className="space-y-3">
      <p role="status">{online ? "Impossible de charger la liste." : "Vous êtes hors connexion."}</p>
      {online && <Button type="button" variant="outline" onClick={() => void query.refetch()}>Réessayer</Button>}
      <Link href={offlineCheckInPage} className={buttonVariants({ variant: "outline" })}>Ouvrir la copie hors ligne</Link>
    </div> : <p role="status">Chargement…</p>} />;
}
