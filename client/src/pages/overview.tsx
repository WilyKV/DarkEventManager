import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, Skull, WifiOff } from "lucide-react";
import { Link } from "wouter";
import { ManagementLayout } from "@/components/management-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/install-prompt";
import { useAuth } from "@/lib/auth";

const DashboardAnalytics = lazy(() => import("@/components/dashboard-analytics").then(module => ({ default: module.DashboardAnalytics })));

interface DashboardStats {
  participants: {
    total: number;
    zombies: number;
    survivors: number;
    arrived: number;
    arrivalRate: number;
  };
  checklist: { totalCompleted: number; totalParticipants: number; completionRate: number };
}

export default function OverviewPage() {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const { hasAnyRole } = useAuth();
  const { data: stats, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 10_000,
  });

  const metrics = stats ? [
    { label: "Participants", value: stats.participants.total, detail: `${stats.participants.zombies} zombies · ${stats.participants.survivors} survivants` },
    { label: "Arrivées", value: `${stats.participants.arrivalRate}%`, detail: `${stats.participants.arrived} sur ${stats.participants.total}` },
    { label: "Checklists terminées", value: `${stats.checklist.completionRate}%`, detail: `${stats.checklist.totalCompleted} sur ${stats.checklist.totalParticipants}` },
  ] : [];

  return (
    <ManagementLayout title="Vue d’ensemble" subtitle="Zomb’in The Dark">
      <div className="space-y-6">
        {hasAnyRole(["admin", "staff_zombie"]) && (
          <section aria-label="Accueil zombie" className="grid gap-3 sm:grid-cols-[3fr_2fr]">
            <Link href="/zombie" className="group flex items-center gap-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/15 to-card p-4 transition-colors hover:border-primary/60 sm:p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-emerald-300 sm:size-14">
                <Skull className="size-6" aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-lg font-semibold tracking-tight sm:text-xl">Accueil zombie</span>
                <span className="block text-sm text-muted-foreground">Arrivées, checklist et équipes</span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 text-emerald-300" aria-hidden />
            </Link>
            <Link href="/zombie/hors-ligne" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/50 sm:p-6">
              <WifiOff className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="flex-1">
                <span className="block font-semibold tracking-tight">Accueil hors ligne</span>
                <span className="block text-sm text-muted-foreground">Préparer ou ouvrir la liste sur cet appareil</span>
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </section>
        )}

        <section aria-label="Chiffres clés">
          {isLoading ? (
            <Skeleton className="h-28 rounded-xl" />
          ) : stats ? (
            <dl className="grid divide-y divide-border overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              {metrics.map(({ label, value, detail }) => (
                <div key={label} className="grid grid-cols-[1fr_auto] gap-x-4 px-4 py-3 sm:block sm:p-5">
                  <dt className="self-center text-sm font-medium text-muted-foreground">{label}</dt>
                  <dd className="row-span-2 self-center text-2xl font-semibold tabular-nums sm:my-2 sm:text-3xl">{value}</dd>
                  <dd className="text-xs text-muted-foreground">{detail}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4" role="status">
              <p className="text-sm text-muted-foreground">Les chiffres de l’événement sont indisponibles.</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Réessayer</Button>
            </div>
          )}
        </section>

        <section>
          <Button
            variant="outline"
            className="w-full justify-between"
            aria-expanded={analyticsOpen}
            onClick={() => setAnalyticsOpen((open) => !open)}
          >
            Analyses détaillées
            <ChevronDown className={analyticsOpen ? "rotate-180" : undefined} aria-hidden="true" />
          </Button>
          {analyticsOpen && <div className="mt-4"><Suspense fallback={<Skeleton className="h-28 rounded-xl" />}><DashboardAnalytics refetchInterval={5000} /></Suspense></div>}
        </section>
        <InstallAppButton className="min-h-11" />
      </div>
    </ManagementLayout>
  );
}
