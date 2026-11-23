import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, IdCard, Printer } from "lucide-react";
import type { ParticipantWithRelations } from "@shared/schema";
import { cardsPath } from "@shared/participant-card";
import { checkInTypes } from "@shared/check-in";
import { normalizePlayerName } from "@shared/zombie-offline";
import { ParticipantCard, SouvenirPhoto, usePrintableCard } from "@/components/participant-card";
import { DataSyncButton } from "@/components/data-sync-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManagementLayout } from "@/components/management-layout";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

type PrintMode = "complete" | "front" | "back";

export default function BadgesPage() {
  const { hasAnyRole } = useAuth();
  const [focused, setFocused] = useState<number>();
  const [checked, setChecked] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<PrintMode>("complete");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const roster = useQuery<ParticipantWithRelations[]>({ queryKey: ["/api/participants"] });
  const allowed = hasAnyRole(["admin"]) ? checkInTypes
    : checkInTypes.filter(type => type !== "staff" && hasAnyRole([`staff_${type}`]));
  const people = (roster.data ?? []).filter(person => allowed.some(type => type === person.type))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr"));
  const filtered = people.filter(person =>
    normalizePlayerName(`${person.firstName} ${person.lastName}`).includes(normalizePlayerName(search.trim())));
  const current = people.find(person => person.id === focused);
  const card = usePrintableCard(current?.id);
  const ids = people.filter(person => checked.includes(person.id)).map(person => person.id).sort((a, b) => a - b);

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("participantId"));
    if (Number.isSafeInteger(id) && id > 0) setFocused(id);
  }, []);

  async function download(idsToPrint: number[]) {
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("POST", `${cardsPath}/print`, {
        ids: idsToPrint, pdf: mode, origin: window.location.origin,
      });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `cartes-${mode}-85x55.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Impossible de préparer le PDF. Vérifiez la sélection et la connexion.");
    } finally { setBusy(false); }
  }

  return <ManagementLayout title="Cartes participants" subtitle="Modèle vierge, cartes personnalisées et photos souvenir">
    <Tabs defaultValue="cards" className="space-y-4">
      <TabsList><TabsTrigger value="cards"><IdCard className="mr-2 size-4" /> Cartes</TabsTrigger><TabsTrigger value="data">Données</TabsTrigger></TabsList>
      <TabsContent value="cards" className="space-y-4">
        <section aria-label="Impression des cartes" className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Button asChild variant="outline"><a href={`${cardsPath}/template`} download><Download /> Modèle vierge · 85 × 55 mm</a></Button>
            <label className="grid gap-1 text-sm font-medium">Faces à imprimer
              <select value={mode} onChange={event => setMode(event.target.value as PrintMode)} className="min-h-9 rounded-md border border-input bg-background px-2">
                <option value="complete">Carte complète recto verso</option>
                <option value="front">Surimpression recto · noms et QR</option>
                <option value="back">Surimpression verso · code</option>
              </select>
            </label>
            <Button type="button" disabled={!ids.length || ids.length > 500 || busy} onClick={() => void download(ids)}>
              <Printer /> Exporter la sélection ({ids.length})
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">PDF à taille réelle. Pour des cartes préimprimées, exportez le recto puis le verso avec la même sélection. Les deux fichiers conservent le même ordre. Faites un essai à 100 % avec une carte avant le tirage.</p>
          {ids.length > 500 && <p role="status" className="text-sm">Sélectionnez jusqu’à 500 cartes par PDF.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label="Participants à imprimer" className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <Input type="search" aria-label="Rechercher un participant" placeholder="Nom ou prénom" value={search}
              onChange={event => setSearch(event.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!filtered.length}
                onClick={() => setChecked(Array.from(new Set([...checked, ...filtered.map(person => person.id)])))}>Sélectionner les résultats</Button>
              <Button type="button" variant="ghost" size="sm" disabled={!checked.length} onClick={() => setChecked([])}>Effacer la sélection</Button>
            </div>
            {roster.isLoading && <p role="status">Chargement des participants…</p>}
            {roster.isError && <p role="alert">Impossible de charger les participants.</p>}
            {!roster.isLoading && !roster.isError && filtered.length === 0 && <p role="status">Aucun participant trouvé.</p>}
            <ul className="max-h-[65dvh] space-y-2 overflow-y-auto">
              {filtered.map(person => (
                <li key={person.id} className="flex items-center gap-2 rounded-lg border border-border px-2">
                  <input type="checkbox" className="size-5 shrink-0 accent-primary"
                    aria-label={`Inclure ${person.firstName} ${person.lastName}`}
                    checked={checked.includes(person.id)}
                    onChange={event => setChecked(event.target.checked ? [...checked, person.id] : checked.filter(id => id !== person.id))} />
                  <button type="button" aria-pressed={focused === person.id} className="min-h-12 flex-1 break-words px-2 text-left font-medium aria-pressed:text-primary"
                    onClick={() => setFocused(person.id)}>{person.firstName} {person.lastName}</button>
                </li>
              ))}
            </ul>
          </section>
          {current ? <section aria-label="Carte sélectionnée" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Carte de {current.firstName} {current.lastName}</h2>
              <Button type="button" variant="outline" disabled={busy} onClick={() => void download([current.id])}><Download /> Exporter cette carte</Button>
            </div>
            {card.isLoading && <p role="status">Préparation de la carte…</p>}
            {card.isError && <p role="alert">Impossible de charger la carte.</p>}
            {card.data && <ParticipantCard card={card.data} />}
            <SouvenirPhoto key={current.id} onSave={async photo => { await apiRequest("PATCH", `${cardsPath}/${current.id}/photo`, { photo }); }} />
          </section> : <p className="p-4 text-muted-foreground">Ouvrez un nom dans la liste pour voir sa carte et associer une photo.</p>}
        </div>
      </TabsContent>
      <TabsContent value="data"><DataSyncButton module="all" title="Gestion des données" description="Synchronisez les données vers l’appareil maître" /></TabsContent>
    </Tabs>
  </ManagementLayout>;
}
