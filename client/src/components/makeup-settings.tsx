import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paintbrush } from "lucide-react";
import { makeupSettingsPath } from "@shared/makeup";
import { checkInRosterPath } from "@shared/check-in";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function MakeupSettings() {
  const query = useQuery<{ artists: number }>({ queryKey: [makeupSettingsPath] });
  const client = useQueryClient();
  const [draft, setDraft] = useState<string>();
  const value = draft ?? query.data?.artists.toString() ?? "";
  const save = useMutation({
    mutationFn: async () => {
      const result = await apiRequest("PATCH", makeupSettingsPath, { artists: Number(value) });
      return await result.json() as { artists: number };
    },
    onSuccess: data => {
      client.setQueryData([makeupSettingsPath], data);
      void client.invalidateQueries({ queryKey: [checkInRosterPath] });
      setDraft(undefined);
    },
  });
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-base"><Paintbrush className="size-5" aria-hidden /> Maquillage</CardTitle>
      <CardDescription>Les horaires estimés sont affichés à la fin de l’accueil de chaque groupe Zombie.</CardDescription>
    </CardHeader>
    <CardContent>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (query.data && !save.isPending) save.mutate(); }}>
        <label className="grid gap-1 text-sm font-medium">Nombre de maquilleuses
          <Input type="number" min={1} max={50} step={1} required value={value} disabled={!query.data || save.isPending}
            onChange={event => { setDraft(event.target.value); save.reset(); }} />
        </label>
        <Button type="submit" loading={save.isPending} disabled={!query.data || draft === undefined}>Enregistrer l’effectif</Button>
      </form>
      {(query.isError || save.isError) && <p role="alert" className="mt-2 text-sm text-destructive">Impossible d’accéder aux réglages de maquillage.</p>}
      {save.isSuccess && <p role="status" className="mt-2 text-sm text-muted-foreground">Effectif enregistré.</p>}
    </CardContent>
  </Card>;
}
