import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { checkInProfiles, checkInRosterPath, type ChecklistItem } from "@shared/check-in";
import { defaultWelcomeChecklist, welcomeChecklistLimit, welcomeChecklistPath, type WelcomeChecklist } from "@shared/welcome-checklist";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const zombieWelcomeLabels: Record<ChecklistItem, string> = {
  squadExplained: "Présenter la squad",
  briefingExplained: "Annoncer les horaires",
  mealTicketGiven: "Remettre la carte participant",
  waterBottleGiven: "Donner la bouteille d’eau",
  makeupWaitExplained: "Orienter vers le maquillage",
  mapGiven: "Proposer une carte",
};

export function useWelcomeChecklist(enabled: boolean, cached?: WelcomeChecklist) {
  const online = useOnlineStatus();
  const query = useQuery<WelcomeChecklist>({
    queryKey: [welcomeChecklistPath],
    enabled: enabled && online,
    refetchOnMount: "always",
  });
  return { settings: query.data ?? cached ?? defaultWelcomeChecklist, canEdit: online && query.isSuccess };
}

export function WelcomeChecklistEditor({ settings, canEdit, onClose }: {
  settings: WelcomeChecklist;
  canEdit: boolean;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const cache = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (next: WelcomeChecklist) => {
      const response = await apiRequest("PATCH", welcomeChecklistPath, next);
      return await response.json() as WelcomeChecklist;
    },
    onSuccess: data => {
      cache.setQueryData([welcomeChecklistPath], data);
      void cache.invalidateQueries({ queryKey: [checkInRosterPath] });
      setDraft(data);
      setTitle("");
      setNote("");
      onClose?.();
    },
  });
  const disabled = !canEdit || mutation.isPending;
  const canAdd = Boolean(title.trim()) && draft.extra.length < welcomeChecklistLimit;
  function withNewPoint(): WelcomeChecklist {
    return {
      ...draft,
      extra: [...draft.extra, { id: crypto.randomUUID(), title: title.trim(), note: note.trim() }],
    };
  }

  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <legend className="px-1 font-semibold">Checklist Zombies de l’événement</legend>
      <p className="text-sm text-muted-foreground">Les changements s’appliquent à toutes les vagues de l’événement.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {checkInProfiles.zombie.checklist.map(key => (
          <label key={key} className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 shrink-0 accent-primary" checked={!draft.hidden.includes(key)}
              onChange={event => setDraft({
                ...draft, hidden: event.target.checked ? draft.hidden.filter(item => item !== key) : [...draft.hidden, key],
              })} />
            {zombieWelcomeLabels[key]}
          </label>
        ))}
      </div>
      {draft.extra.length > 0 && <ul className="divide-y divide-border">
        {draft.extra.map(item => (
          <li key={item.id} className="flex items-center justify-between gap-2 py-1 text-sm">
            <div className="min-w-0 break-words"><strong>{item.title}</strong>{item.note && <p className="text-muted-foreground">{item.note}</p>}</div>
            <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Supprimer le point ${item.title}`}
              onClick={() => setDraft({ ...draft, extra: draft.extra.filter(entry => entry.id !== item.id) })}><Trash2 /></Button>
          </li>
        ))}
      </ul>}
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid flex-1 gap-1 text-sm">Nouveau point
          <Input value={title} maxLength={100} onChange={event => setTitle(event.target.value)} />
        </label>
        <label className="grid flex-1 gap-1 text-sm">Détail à rappeler
          <Input value={note} maxLength={500} onChange={event => setNote(event.target.value)} />
        </label>
        <Button type="button" variant="outline" disabled={!canAdd} onClick={() => {
          setDraft(withNewPoint());
          setTitle("");
          setNote("");
        }}><Plus /> Ajouter</Button>
      </div>
      <Button type="button" onClick={() => mutation.mutate(canAdd ? withNewPoint() : draft)}>Enregistrer la checklist</Button>
      {mutation.isError && <p role="alert" className="text-sm text-destructive">La checklist n’a pas été enregistrée. Réessayez.</p>}
      {mutation.isSuccess && !onClose && <p role="status" className="text-sm text-muted-foreground">Checklist enregistrée.</p>}
    </fieldset>
  );
}

export function WelcomeChecklistSettings() {
  const { settings, canEdit } = useWelcomeChecklist(true);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="size-5" /> Checklist d’accueil</CardTitle>
        <CardDescription>Choisissez les consignes à vérifier à la fin de l’accueil des zombies.</CardDescription>
      </CardHeader>
      <CardContent>
        {canEdit ? <WelcomeChecklistEditor settings={settings} canEdit />
          : <p className="text-sm text-muted-foreground">La checklist est modifiable quand le serveur est accessible.</p>}
      </CardContent>
    </Card>
  );
}
