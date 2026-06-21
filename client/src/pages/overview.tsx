import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ManagementLayout } from "@/components/management-layout";
import { DashboardAnalytics } from "@/components/dashboard-analytics";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Users, TrendingUp, CheckCircle } from "lucide-react";

interface DashboardStats {
  participants: {
    total: number;
    zombies: number;
    survivors: number;
    arrived: number;
    pending: number;
    arrivalRate: number;
  };
  checklist: {
    totalCompleted: number;
    totalParticipants: number;
    completionRate: number;
  };
  stock: {
    shopItems: { name: string; stock: number; category: string }[];
    mealItems: { name: string; stock: number; category: string }[];
  };
  squads: {
    name: string;
    type: string;
    currentMembers: number;
    maxMembers: number;
  }[];
}

const EMERALD = "#10b981";
const BLUE    = "#3b82f6";
const ORANGE  = "#f97316";

interface KeyMetricProps {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  icon: React.ElementType;
}

function KeyMetric({ label, value, sub, color, icon: Icon }: KeyMetricProps) {
  return (
    <Card
      className="relative overflow-hidden border border-border/50"
      style={{ boxShadow: `0 4px 24px ${color}18` }}
    >
      {/* Accent top bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />
      <CardContent className="pt-6 pb-5 px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
              {label}
            </p>
            <p
              className="text-4xl font-bold tabular-nums leading-none"
              style={{ color }}
            >
              {value}
            </p>
            {sub && (
              <p className="text-xs text-muted-foreground mt-2 leading-snug">{sub}</p>
            )}
          </div>
          <div
            className="flex-shrink-0 p-2.5 rounded-xl"
            style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewPage() {
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 10_000,
  });

  return (
    <ManagementLayout title="Vue d'ensemble" subtitle="Zomb'in The Dark">
      <div className="space-y-10">
        {/* === HERO === */}
        <section className="flex flex-col items-center text-center gap-6 py-6">
          <img
            src="https://zombinthedark.fr/wp-content/uploads/2020/11/Logo_ZITD_plat_blanc-1-300x105.png"
            alt="Zomb'in The Dark"
            className="w-[220px] sm:w-[280px] h-auto"
          />
          <div className="space-y-2">
            <p className="text-base sm:text-lg text-muted-foreground font-light tracking-wide">
              Système de gestion d'événement
            </p>
            <div className="flex justify-center">
              <ConnectionIndicator />
            </div>
          </div>
        </section>

        {/* === CHIFFRES CLÉS === */}
        <section>
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-4"
            style={{ color: EMERALD }}
          >
            Chiffres clés
          </h2>

          {isLoading || !stats ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 bg-muted rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KeyMetric
                label="Participants"
                value={stats.participants.total}
                sub={`${stats.participants.zombies} zombies · ${stats.participants.survivors} survivants`}
                color={EMERALD}
                icon={Users}
              />
              <KeyMetric
                label="Check-in"
                value={`${stats.participants.arrivalRate}%`}
                sub={`${stats.participants.arrived} arrivés sur ${stats.participants.total}`}
                color={BLUE}
                icon={TrendingUp}
              />
              <KeyMetric
                label="Checklist"
                value={`${stats.checklist.completionRate}%`}
                sub={`${stats.checklist.totalCompleted} / ${stats.checklist.totalParticipants} terminés`}
                color={ORANGE}
                icon={CheckCircle}
              />
            </div>
          )}
        </section>

        {/* === ANALYSES DÉTAILLÉES (dépliables) === */}
        <section>
          <Button
            variant="outline"
            className="w-full flex items-center justify-between gap-2 border-border/60 hover:border-primary/40"
            onClick={() => setAnalyticsOpen((v) => !v)}
          >
            <span className="font-medium">Analyses détaillées</span>
            {analyticsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>

          {analyticsOpen && (
            <div className="mt-6">
              <DashboardAnalytics refetchInterval={5000} />
            </div>
          )}
        </section>
      </div>
    </ManagementLayout>
  );
}
