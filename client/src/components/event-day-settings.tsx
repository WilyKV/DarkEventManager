import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { eventDayPath, formatEventDay } from "@shared/event-day";
import { checkInRosterPath } from "@shared/check-in";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEventDay } from "@/hooks/use-event-day";
import { apiRequest } from "@/lib/queryClient";

export function EventDaySettings() {
  const query = useEventDay();
  const client = useQueryClient();
  const [draft, setDraft] = useState<string>();
  const day = draft ?? query.data?.eventDay ?? "";
  const mutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", eventDayPath, { eventDay: day || null });
      return await response.json() as { eventDay: string | null };
    },
    onSuccess: saved => {
      client.setQueryData([eventDayPath], saved);
      void client.invalidateQueries({ queryKey: [checkInRosterPath] });
      setDraft(undefined);
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="size-5" aria-hidden /> Date de l’événement</CardTitle>
        <CardDescription>Cette date s’applique à tous les créneaux, à l’accueil et aux rappels horaires.</CardDescription>
      </CardHeader>
      <CardContent>
        {query.isError ? <Button variant="outline" onClick={() => void query.refetch()}>Recharger la date</Button> : (
          <form className="space-y-2" onSubmit={event => { event.preventDefault(); mutation.mutate(); }}>
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-sm font-medium">Jour de l’événement
                <Input type="date" value={day} disabled={query.isPending || mutation.isPending}
                  onChange={event => { setDraft(event.target.value); mutation.reset(); }} />
              </label>
              <Button type="submit" disabled={query.isPending || mutation.isPending || draft === undefined || day === (query.data?.eventDay ?? "")}>
                {mutation.isPending ? "Enregistrement…" : "Enregistrer la date"}
              </Button>
            </div>
            {mutation.isError && <p role="alert" className="text-sm text-destructive">Impossible d’enregistrer la date.</p>}
            {mutation.isSuccess && <p role="status" className="text-sm text-muted-foreground">
              {mutation.data.eventDay ? `Date enregistrée · ${formatEventDay(mutation.data.eventDay)}` : "Date effacée."}
            </p>}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
