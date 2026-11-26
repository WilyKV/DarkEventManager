import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { staffCompensationPath, type StaffCompensation } from "@shared/staff-compensation";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function StaffBudgetSummary({ participants }: { participants: readonly { id: number }[] }) {
  const { data, isError } = useQuery<StaffCompensation[]>({ queryKey: [staffCompensationPath] });
  if (!data) return isError ? <p role="alert">Budget staff indisponible.</p> : null;
  const ids = new Set(participants.map(person => person.id));
  const rows = data.filter(row => ids.has(row.participantId));
  const paid = rows.filter(row => !row.volunteer);
  const total = paid.reduce((sum, row) => sum + (row.rateCents ?? 0), 0);
  const withoutRate = paid.filter(row => row.rateCents == null).length;
  return <section className="rounded-xl border border-border bg-card p-4" aria-label="Budget staff prévu">
    <h3 className="text-sm font-medium">Budget staff prévu</h3>
    <p className="text-2xl font-semibold tabular-nums">{euro.format(total / 100)}</p>
    <p className="text-sm text-muted-foreground">
      {rows.length - paid.length} bénévole(s) · {withoutRate} non-bénévole(s) sans tarif · {participants.length - rows.length} statut(s) à renseigner
    </p>
  </section>;
}

export function StaffCompensationEditor({ participantId }: { participantId: number }) {
  const { data, isError } = useQuery<StaffCompensation[]>({ queryKey: [staffCompensationPath] });
  if (!data) return <p className="text-sm text-muted-foreground">{isError ? "Tarification indisponible." : "Chargement de la tarification…"}</p>;
  return <StaffCompensationForm participantId={participantId} current={data.find(row => row.participantId === participantId)} />;
}

function StaffCompensationForm({ participantId, current }: { participantId: number; current?: StaffCompensation }) {
  const [status, setStatus] = useState(current ? current.volunteer ? "volunteer" : "paid" : "");
  const [rate, setRate] = useState(current?.rateCents != null ? String(current.rateCents / 100) : "");
  const client = useQueryClient();
  const save = useMutation({
    mutationFn: async (value: Omit<StaffCompensation, "participantId">) => {
      await apiRequest("PATCH", `${staffCompensationPath}/${participantId}`, value);
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [staffCompensationPath] }),
  });
  const amount = rate.trim().replace(",", ".");
  const validRate = /^\d{1,8}(?:\.\d{1,2})?$/.test(amount) && Math.round(Number(amount) * 100) <= 2_147_483_647;
  const invalid = status === "paid" && amount !== "" && !validRate;

  return <form aria-label="Bénévolat et tarif" className="space-y-3 rounded-xl border border-border bg-muted/40 p-3"
    onSubmit={event => {
      event.preventDefault();
      if (invalid || save.isPending) return;
      save.mutate({ volunteer: status === "" ? null : status === "volunteer",
        rateCents: status === "paid" && amount !== "" ? Math.round(Number(amount) * 100) : null });
    }}>
    <label className="grid gap-1 text-sm font-medium">Statut du membre du staff
      <select value={status} onChange={event => { setStatus(event.target.value); save.reset(); }}
        className="min-h-11 w-full rounded-md border border-input bg-background px-2">
        <option value="">Non renseigné</option><option value="volunteer">Bénévole</option><option value="paid">Non-bénévole</option>
      </select>
    </label>
    {status === "paid" && <label className="grid gap-1 text-sm font-medium">Tarif prévu en euros (facultatif)
      <Input inputMode="decimal" value={rate} aria-invalid={invalid}
        onChange={event => { setRate(event.target.value); save.reset(); }} placeholder="Ex. 120,00" />
    </label>}
    {invalid && <p role="alert" className="text-sm text-destructive">Indiquez un montant positif avec au plus deux décimales.</p>}
    <Button type="submit" variant="outline" disabled={invalid || save.isPending}>
      {save.isPending ? "Enregistrement…" : "Enregistrer le statut et le tarif"}
    </Button>
    {save.isSuccess && <p role="status" className="text-sm">Statut et tarif enregistrés.</p>}
    {save.isError && <p role="alert" className="text-sm text-destructive">Impossible d’enregistrer le statut et le tarif.</p>}
  </form>;
}
