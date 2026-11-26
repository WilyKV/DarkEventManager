import { welcomeTabletPage } from "@/components/welcome-tablet-transfer";
import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Link } from "wouter";
import { ManagementLayout } from "@/components/management-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { InstallAppButton } from "@/components/install-prompt";
import { useManagementNav } from "@/lib/management-nav";

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
  const modules = useManagementNav();
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
      <Link href={welcomeTabletPage} className="inline-flex min-h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium hover:bg-muted">Ouvrir l’écran d’accueil tablette</Link>
      <div className="space-y-6">
        {modules.length > 0 && (
          <section aria-labelledby="workspace-modules">
            <h2 id="workspace-modules" className="mb-3 text-lg font-semibold tracking-tight">Accès aux modules</h2>
            <div className="workspace-card-grid">
              {modules.map(({ icon: Icon, label, path, tone, description }) => (
                <Link key={path} href={path} className="workspace-link">
                  <span className="workspace-icon size-11" data-tone={tone}><Icon className="size-5" aria-hidden /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{label}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        )}

        <section aria-label="Chiffres clés">
          <h2 className="mb-3 text-lg font-semibold tracking-tight">Chiffres clés</h2>
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
