const arrivalFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "medium",
  timeZone: "Europe/Paris",
});

export function ArrivalTimeOption({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex min-h-10 w-fit items-center gap-2 text-sm text-muted-foreground">
    <input type="checkbox" className="size-4 accent-primary" checked={checked} onChange={event => onChange(event.target.checked)} />
    Afficher la date et l’heure d’arrivée
  </label>;
}

export function ArrivalTime({ value }: { value?: string | Date | null }) {
  const date = value ? new Date(value) : undefined;
  return <span className="text-xs tabular-nums text-muted-foreground">
    {date && Number.isFinite(date.getTime()) ? <>Arrivée le <time dateTime={date.toISOString()}>{arrivalFormat.format(date)}</time></>
      : "Heure d’arrivée non enregistrée"}
  </span>;
}
