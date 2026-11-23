import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Images } from "lucide-react";
import { souvenirSettingsPath, type SouvenirSettingsResponse } from "@shared/participant-card";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SouvenirSettings() {
  const client = useQueryClient();
  const query = useQuery<SouvenirSettingsResponse>({ queryKey: [souvenirSettingsPath], staleTime: 0 });
  const [draft, setDraft] = useState<Partial<Record<"zombies" | "survivors" | "photoUrl", string>>>({});
  const zombies = draft.zombies ?? query.data?.zombies?.toString() ?? "";
  const survivors = draft.survivors ?? query.data?.survivors?.toString() ?? "";
  const photoUrl = draft.photoUrl ?? query.data?.photoUrl ?? "";
  const save = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", souvenirSettingsPath, {
        zombies: zombies === "" ? null : Number(zombies),
        survivors: survivors === "" ? null : Number(survivors),
        photoUrl: photoUrl.trim() || null,
      });
      return await response.json() as SouvenirSettingsResponse;
    },
    onSuccess: data => {
      client.setQueryData([souvenirSettingsPath], data);
      setDraft({});
    },
  });
  const disabled = !query.data || save.isPending;

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><Images className="size-5" aria-hidden /> Espace souvenir</CardTitle>
      <CardDescription>Les présences sont comptées sur toute la soirée. Laissez un effectif vide pour garder le total automatique.</CardDescription>
    </CardHeader>
    <CardContent>
      {query.isError ? <Button type="button" variant="outline" onClick={() => void query.refetch()}>Recharger les réglages</Button> :
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); if (!disabled) save.mutate(); }}>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["zombies", "Zombies présents", zombies], ["survivors", "Survivants présents", survivors]] as const).map(([key, label, value]) => (
              <label key={key} className="grid gap-1 text-sm font-medium">{label}
                <Input type="number" min={0} max={2147483647} step={1} value={value} disabled={disabled}
                  placeholder={query.data ? String(query.data.automatic[key]) : ""}
                  onChange={event => { setDraft(previous => ({ ...previous, [key]: event.target.value })); save.reset(); }} />
                {query.data && <span className="text-xs font-normal text-muted-foreground">Calcul automatique · {query.data.automatic[key]}</span>}
              </label>
            ))}
          </div>
          <label className="grid gap-1 text-sm font-medium">Lien de l’album photo
            <Input type="url" value={photoUrl} maxLength={2048} disabled={disabled} placeholder="https://…"
              onChange={event => { setDraft(previous => ({ ...previous, photoUrl: event.target.value })); save.reset(); }} />
            <span className="text-xs font-normal text-muted-foreground">Laissez vide tant que l’album n’est pas disponible.</span>
          </label>
          <Button type="submit" disabled={disabled || !Object.keys(draft).length} loading={save.isPending}>Enregistrer les réglages</Button>
          {save.isError && <p role="alert" className="text-sm text-destructive">Impossible d’enregistrer. Vérifiez les effectifs et le lien HTTP ou HTTPS.</p>}
          {save.isSuccess && <p role="status" className="text-sm text-muted-foreground">Réglages enregistrés.</p>}
        </form>}
    </CardContent>
  </Card>;
}
