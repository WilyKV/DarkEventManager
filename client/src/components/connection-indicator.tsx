import { useLiveStatus } from "@/lib/live-updates";
import { cn } from "@/lib/utils";

const states = {
  connecting: ["Connexion au direct…", "bg-muted-foreground"],
  live: ["En direct", "bg-emerald-400"],
  offline: ["Hors connexion", "bg-amber-400"],
  unavailable: ["Direct indisponible", "bg-amber-400"],
};

export function ConnectionIndicator() {
  const [label, color] = states[useLiveStatus()];
  return (
    <span role="status" className="inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground">
      <span className={cn("size-2 shrink-0 rounded-full", color)} aria-hidden />
      {label}
    </span>
  );
}
