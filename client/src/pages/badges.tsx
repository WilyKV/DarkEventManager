import { CardCodeActions } from "@/components/card-code-actions";
import { AdminSouvenirLink } from "@/components/admin-souvenir-link";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, IdCard, Printer } from "lucide-react";
import type { ParticipantWithRelations } from "@shared/schema";
import { calibratedCardSheet, cardPrintFormatLabel, cardsPath, cardSheet, defaultCardPrintLayout, staffSpecializationLabels, staffSpecializations, type CardPrintLayout, type StaffSpecialization } from "@shared/participant-card";
import { checkInProfileLabels, checkInTypes, isCheckInType, type CheckInType } from "@shared/check-in";
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
  const [profiles, setProfiles] = useState<CheckInType[]>([]);
  const [wave, setWave] = useState("");
  const [squad, setSquad] = useState("");
  const [blankProfile, setBlankProfile] = useState<string>();
  const [layout, setLayout] = useState<CardPrintLayout>(defaultCardPrintLayout);
  const [mode, setMode] = useState<PrintMode>("complete");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const roster = useQuery<ParticipantWithRelations[]>({ queryKey: ["/api/participants"] });
  const specialization = useMutation({
    mutationFn: async ({ id, value }: { id: number; value: StaffSpecialization | null }) => {
      await apiRequest("PATCH", `/api/participants/${id}`, { staffSpecialization: value });
    },
    onSuccess: (_, { id, value }) => {
      queryClient.setQueryData<ParticipantWithRelations[]>(["/api/participants"], people =>
        people?.map(person => person.id === id ? { ...person, staffSpecialization: value } : person));
    },
  });
  const allowed = hasAnyRole(["admin"]) ? checkInTypes
    : checkInTypes.filter(type => type !== "staff" && hasAnyRole([`staff_${type}`]));
  const templateProfile = allowed.find(type => type === blankProfile) ?? allowed[0];
  const templateQuery = new URLSearchParams({ layout, origin: window.location.origin });
  if (templateProfile) templateQuery.set("type", templateProfile);
  const people = (roster.data ?? []).filter((person): person is ParticipantWithRelations & { type: CheckInType } =>
    isCheckInType(person.type) && allowed.includes(person.type))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr"));
  const waves = Array.from(new Map(people.flatMap(person => person.timeSlot ? [[person.timeSlot.id, person.timeSlot] as const] : [])).values())
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { numeric: true }));
  const wavePeople = people.filter(person => !wave || (wave === "none" ? person.timeSlotId === null : String(person.timeSlotId) === wave));
  const squads = Array.from(new Map(wavePeople.flatMap(person => person.squad ? [[person.squad.id, {
    ...person.squad, waveName: person.timeSlot?.name,
  }] as const] : [])).values()).sort((a, b) => a.number - b.number || a.id - b.id);
  const searchTerm = normalizePlayerName(search.trim());
  const filtered = wavePeople.filter(person =>
    (!profiles.length || profiles.some(profile => profile === person.type)) &&
    (!squad || (squad === "none" ? person.squadId === null : String(person.squadId) === squad)) &&
    normalizePlayerName(`${person.firstName} ${person.lastName}`).includes(searchTerm));
  const current = people.find(person => person.id === focused);
  const card = usePrintableCard(current?.id);
  const selected = new Set(checked);
  const ids = people.filter(person => selected.has(person.id)).map(person => person.id).sort((a, b) => a - b);
  const hiddenSelectionCount = ids.length - filtered.filter(person => selected.has(person.id)).length;

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("participantId"));
    if (Number.isSafeInteger(id) && id > 0) setFocused(id);
  }, []);

  async function download(idsToPrint: number[]) {
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest("POST", `${cardsPath}/print`, {
        ids: idsToPrint, pdf: mode, layout, origin: window.location.origin,
      });
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `cartes-${mode}-${cardPrintFormatLabel(layout)}.pdf`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Impossible de préparer le PDF. Vérifiez la sélection et la connexion.");
    } finally { setBusy(false); }
  }

  return <ManagementLayout title="Cartes participants" subtitle="Modèle vierge, cartes personnalisées et photos souvenir">
    <Tabs defaultValue="cards" className="space-y-4">
      <TabsList className="workspace-tabs"><TabsTrigger value="cards"><IdCard className="mr-2 size-4" /> Cartes</TabsTrigger><TabsTrigger value="data">Import / export</TabsTrigger></TabsList>
      <TabsContent value="cards" className="space-y-4">
        <section aria-label="Impression des cartes" className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-lg font-semibold tracking-tight">Impression des cartes</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-sm font-medium">Format du papier
              <select value={layout} onChange={event => setLayout(event.target.value as CardPrintLayout)} className="min-h-11 rounded-md border border-input bg-background px-2">
                <option value="a4-calibrated">A4 cartonné · calibré · {calibratedCardSheet.capacity} cartes par feuille</option>
                <option value="a4">A4 standard · {cardSheet.capacity} cartes par feuille</option>
                <option value="card">85 × 55 mm · carte individuelle</option>
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">Profil du modèle vierge
              <select value={templateProfile ?? ""} onChange={event => setBlankProfile(event.target.value)} className="min-h-11 rounded-md border border-input bg-background px-2">
                {allowed.map(type => <option key={type} value={type}>{checkInProfileLabels[type]}</option>)}
              </select>
            </label>
            <Button asChild variant="outline" className="min-h-11"><a href={`${cardsPath}/template?${templateQuery}`} download><Download /> Modèle vierge de secours · {layout === "card" ? "85 × 55 mm" : "A4"}</a></Button>
            <label className="grid gap-1 text-sm font-medium">Faces à imprimer
              <select value={mode} onChange={event => setMode(event.target.value as PrintMode)} className="min-h-11 rounded-md border border-input bg-background px-2">
                <option value="complete">Carte complète recto verso</option>
                <option value="front">Surimpression recto · prénoms, initiales et QR</option>
                <option value="back">Surimpression verso · code</option>
              </select>
            </label>
            <Button type="button" className="min-h-11" disabled={!ids.length || ids.length > 500 || busy || specialization.isPending} onClick={() => void download(ids)}>
              <Printer /> Exporter la sélection ({ids.length})
            </Button>
          </div>
          <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
            <p><strong className="text-foreground">Papier épais ou cartonné</strong> · sélectionnez ce type de papier dans les propriétés de l’imprimante.</p>
            {layout !== "card" ? <>
              <p>A4 portrait, taille réelle (100 %). Pour les cartes complètes et le modèle vierge, choisissez le recto verso sur le bord long si le pilote le permet.</p>
              {layout === "a4-calibrated" && <p>Correction du recto appliquée · 1 mm à gauche et 5 mm vers le haut.</p>}
              <p>Superposez les deux croix par transparence. Leurs graduations sont espacées de 1 mm. Découpez ensuite aux repères des cartes.</p>
            </> : <p>Imprimez à taille réelle (100 %).</p>}
            {mode !== "complete" && <p>Utilisez la même sélection et le même format pour exporter les deux faces.</p>}
          </div>
          {ids.length > 500 && <p role="status" className="text-sm">Sélectionnez jusqu’à 500 cartes par PDF.</p>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          <section aria-label="Participants à imprimer" className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold tracking-tight">Participants à imprimer</h2>
            <Input type="search" className="min-h-11" aria-label="Rechercher un participant" placeholder="Nom ou prénom" value={search}
              onChange={event => setSearch(event.target.value)} />
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Profils</legend>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant={profiles.length ? "outline" : "default"} aria-pressed={!profiles.length}
                  className="min-h-11" onClick={() => setProfiles([])}>Tous les profils</Button>
                {allowed.map(profile => (
                  <Button key={profile} type="button" variant={profiles.includes(profile) ? "default" : "outline"}
                    aria-pressed={profiles.includes(profile)} className="min-h-11"
                    onClick={() => setProfiles(current => current.includes(profile)
                      ? current.filter(item => item !== profile) : [...current, profile])}>
                    {checkInProfileLabels[profile]}
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1 text-sm font-medium">Vague
                <select value={wave} onChange={event => { setWave(event.target.value); setSquad(""); }}
                  className="min-h-11 min-w-0 rounded-md border border-input bg-background px-2">
                  <option value="">Toutes les vagues</option>
                  {waves.map(slot => <option key={slot.id} value={slot.id}>{slot.name}</option>)}
                  {people.some(person => person.timeSlotId === null) && <option value="none">Sans vague</option>}
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-sm font-medium">Squad ou équipe
                <select value={squad} onChange={event => setSquad(event.target.value)}
                  className="min-h-11 min-w-0 rounded-md border border-input bg-background px-2">
                  <option value="">Toutes les squads et équipes</option>
                  {squads.map(team => <option key={team.id} value={team.id}>
                    {team.type === "zombie" ? "Squad" : "Équipe"} {team.number}{!wave && team.waveName ? ` · ${team.waveName}` : ""}
                  </option>)}
                  {wavePeople.some(person => person.squadId === null) && <option value="none">Sans squad ni équipe</option>}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" disabled={!filtered.length}
                onClick={() => setChecked(Array.from(new Set([...checked, ...filtered.map(person => person.id)])))}>Sélectionner les résultats</Button>
              <Button type="button" variant="ghost" size="sm" disabled={!checked.length} onClick={() => setChecked([])}>Effacer la sélection</Button>
            </div>
            {!roster.isLoading && !roster.isError && <p role="status" className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "résultat" : "résultats"} · {ids.length} à imprimer
              {hiddenSelectionCount > 0 && ` (dont ${hiddenSelectionCount} hors des filtres actuels)`}
            </p>}
            {roster.isLoading && <p role="status">Chargement des participants…</p>}
            {roster.isError && <p role="alert">Impossible de charger les participants.</p>}
            {!roster.isLoading && !roster.isError && filtered.length === 0 && <p role="status">Aucun participant trouvé.</p>}
            <ul className="max-h-[65dvh] space-y-2 overflow-y-auto">
              {filtered.map(person => (
                <li key={person.id} className="flex items-center gap-2 rounded-lg border border-border px-2">
                  <input type="checkbox" className="size-5 shrink-0 accent-primary"
                    aria-label={`Inclure ${person.firstName} ${person.lastName}`}
                    checked={selected.has(person.id)}
                    onChange={event => setChecked(event.target.checked ? [...checked, person.id] : checked.filter(id => id !== person.id))} />
                  <button type="button" aria-pressed={focused === person.id} className="min-h-12 flex-1 break-words px-2 text-left font-medium aria-pressed:text-primary"
                    onClick={() => setFocused(person.id)}>
                    <span className="block">{person.firstName} {person.lastName}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {[checkInProfileLabels[person.type],
                        person.timeSlot?.name,
                        person.squad && `${person.type === "zombie" ? "Squad" : "Équipe"} ${person.squad.number}`].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  {hasAnyRole(["admin"]) && <AdminSouvenirLink id={person.id} name={`${person.firstName} ${person.lastName}`} />}
                </li>
              ))}
            </ul>
          </section>
          {current ? <section aria-label="Carte sélectionnée" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Carte de {current.firstName} {current.lastName}</h2>
              <Button type="button" variant="outline" disabled={busy || specialization.isPending} onClick={() => void download([current.id])}><Download /> Exporter cette carte</Button>
            </div>
            {current.type === "staff" && hasAnyRole(["admin"]) && (
              <div className="space-y-2 rounded-xl border border-border bg-card p-3">
                <label className="grid gap-1 text-sm font-medium">Spécialisation
                  <select className="min-h-11 rounded-md border border-input bg-background px-2"
                    value={current.staffSpecialization ?? ""} disabled={busy || specialization.isPending}
                    onChange={event => specialization.mutate({
                      id: current.id, value: staffSpecializations.find(role => role === event.target.value) ?? null,
                    })}>
                    <option value="">Case vierge · à écrire à la main</option>
                    {staffSpecializations.map(role => <option key={role} value={role}>{staffSpecializationLabels[role]}</option>)}
                  </select>
                </label>
                {specialization.isPending && specialization.variables?.id === current.id && <p role="status" className="text-sm">Enregistrement…</p>}
                {specialization.isError && specialization.variables?.id === current.id && <p role="alert" className="text-sm text-destructive">La spécialisation n’a pas été enregistrée.</p>}
              </div>
            )}
            {card.isLoading && <p role="status">Préparation de la carte…</p>}
            {card.isError && <p role="alert">Impossible de charger la carte.</p>}
            {card.data && <><CardCodeActions key={card.data.id} card={card.data} /><ParticipantCard card={{ ...card.data, staffSpecialization: current.staffSpecialization }} /></>}
            <SouvenirPhoto key={current.id} onSave={async photo => { await apiRequest("PATCH", `${cardsPath}/${current.id}/photo`, { photo }); }} />
          </section> : <p className="p-4 text-muted-foreground">Ouvrez un nom dans la liste pour voir sa carte et associer une photo.</p>}
        </div>
      </TabsContent>
      <TabsContent value="data"><DataSyncButton module="all" title="Gestion des données" description="Synchronisez les données vers l’appareil maître" /></TabsContent>
    </Tabs>
  </ManagementLayout>;
}
