import React from "react";
import { ArrowLeft } from "lucide-react";
import { Switch, Route, Redirect, useLocation, Link } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { PwaProvider } from "@/components/install-prompt";
import { LiveUpdatesProvider } from "@/lib/live-updates";
import { useCanGoBack, useTrackAppHistory } from "@/hooks/use-app-back";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { getOfflineCopy } from "@/db/zombie-offline";
import { souvenirRecoveryPath } from "@shared/participant-card";
import { legacyOfflineCheckInPage, offlineCheckInPage } from "@shared/zombie-offline";

const LoginPage = React.lazy(() => import("@/pages/login"));
const SouvenirPage = React.lazy(() => import("@/pages/souvenir"));
const SouvenirRecoveryPage = React.lazy(() => import("@/pages/souvenir").then(module => ({ default: module.SouvenirRecoveryPage })));
const VisitorPage = React.lazy(() => import("@/pages/visitor"));
const OverviewPage = React.lazy(() => import("@/pages/overview"));
const DashboardPage = React.lazy(() => import("@/pages/dashboard"));
const ZombiePage = React.lazy(() => import("@/pages/zombie"));
const OfflineCheckInPage = React.lazy(() => import("@/pages/offline-check-in"));
const SurvivantPage = React.lazy(() => import("@/pages/survivant"));
const StaffPage = React.lazy(() => import("@/pages/staff"));
const BoutiquePage = React.lazy(() => import("@/pages/boutique"));
const RepasPage = React.lazy(() => import("@/pages/repas"));
const BadgesPage = React.lazy(() => import("@/pages/badges"));
const ScanPage = React.lazy(() => import("@/pages/scan"));
const AdminPage = React.lazy(() => import("@/pages/admin"));
const SetupPage = React.lazy(() => import("@/pages/setup"));
const NotFound = React.lazy(() => import("@/pages/not-found"));

function SetupGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();

  const { data } = useQuery<{ needsSetup: boolean }>({
    queryKey: ["/api/setup/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/setup/status");
        if (!res.ok) return { needsSetup: false };
        return res.json();
      } catch {
        return { needsSetup: false };
      }
    },
    staleTime: 30_000,
    retry: false,
  });

  if (data?.needsSetup === true && location !== "/setup" && location !== offlineCheckInPage && location !== legacyOfflineCheckInPage) {
    setLocation("/setup");
    return null;
  }

  return <>{children}</>;
}

function AppHome() {
  const { user, isLoading } = useAuth();
  const online = useOnlineStatus();
  const [hasOfflineCopy, setHasOfflineCopy] = React.useState<boolean>();
  React.useEffect(() => {
    getOfflineCopy().then(copy => setHasOfflineCopy(Boolean(copy))).catch(() => setHasOfflineCopy(false));
  }, []);
  if (hasOfflineCopy === undefined) return null;
  if (hasOfflineCopy && isLoading && online) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 p-4">
        <p role="status" className="text-sm text-muted-foreground">Connexion au serveur…</p>
        <Link href={offlineCheckInPage} className="rounded-lg border border-border px-4 py-3 font-medium hover:bg-muted">Ouvrir la copie hors ligne</Link>
      </main>
    );
  }
  return <Redirect replace to={hasOfflineCopy && (!online || !user) ? offlineCheckInPage : "/overview"} />;
}

function Router() {
  const [location] = useLocation();
  useTrackAppHistory();
  const canGoBack = useCanGoBack();
  const online = useOnlineStatus();
  const publicPage = ["/login", "/visitor", "/setup"].includes(location) || location.startsWith("/souvenir/");
  React.useLayoutEffect(() => {
    document.documentElement.classList.toggle("dark", publicPage);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", publicPage ? "#121417" : "#d6dae1");
    document.documentElement.dataset.workspace = publicPage ? "" : location.slice(1);
  }, [location, publicPage]);
  if (!online && !location.startsWith("/souvenir/") && ![offlineCheckInPage, legacyOfflineCheckInPage, "/login", "/visitor", "/setup"].includes(location)) {
    return <Redirect replace to={offlineCheckInPage} />;
  }
  return (
    <>
      {publicPage && canGoBack && <div className="px-3 pt-[calc(.5rem+env(safe-area-inset-top))]">
        <Button type="button" variant="ghost" size="icon" className="size-11"
          onClick={() => window.history.back()} aria-label="Retour à la page précédente">
          <ArrowLeft aria-hidden />
        </Button>
      </div>}
      <Switch>
        <Route path="/setup" component={SetupPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/souvenir/admin/:id">
          {params => <RequireAuth roles={["admin"]}><SouvenirPage params={params} /></RequireAuth>}
        </Route>
        <Route path={souvenirRecoveryPath} component={SouvenirRecoveryPage} />
        <Route path="/souvenir/:token" component={SouvenirPage} />
        <Route path="/visitor">
          <VisitorPage />
        </Route>

        <Route path="/" component={AppHome} />
        {/* /home → overview (rétro-compat) */}
        <Route path="/home">
          <Redirect replace to="/overview" />
        </Route>

        {/* Overview — page d'atterrissage */}
        <Route path="/overview">
          <RequireAuth>
            <OverviewPage />
          </RequireAuth>
        </Route>

        {/* Dashboard analytique complet (accessible mais hors menu) */}
        <Route path="/dashboard">
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        </Route>

        <Route path={offlineCheckInPage} component={OfflineCheckInPage} />
        <Route path={legacyOfflineCheckInPage}><Redirect replace to={offlineCheckInPage} /></Route>
        <Route path="/zombie">
          <RequireAuth><ZombiePage /></RequireAuth>
        </Route>
        <Route path="/survivant">
          <RequireAuth>
            <SurvivantPage />
          </RequireAuth>
        </Route>
        <Route path="/staff">
          <RequireAuth>
            <StaffPage />
          </RequireAuth>
        </Route>
        <Route path="/boutique">
          <RequireAuth>
            <BoutiquePage />
          </RequireAuth>
        </Route>
        <Route path="/repas">
          <RequireAuth>
            <RepasPage />
          </RequireAuth>
        </Route>
        <Route path="/badges">
          <RequireAuth>
            <BadgesPage />
          </RequireAuth>
        </Route>
        <Route path="/scan">
          <RequireAuth>
            <ScanPage />
          </RequireAuth>
        </Route>

        {/* Admin only routes */}
        <Route path="/admin">
          <RequireAuth roles={["admin"]}>
            <AdminPage />
          </RequireAuth>
        </Route>
        <Route path="/users">
          <Redirect replace to="/admin" />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LiveUpdatesProvider>
          <PwaProvider>
            <TooltipProvider>
              <div className="min-h-dvh bg-background text-foreground">
                <Toaster />
                <SetupGuard>
                  <React.Suspense fallback={<p role="status" className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Chargement…</p>}>
                    <Router />
                  </React.Suspense>
                </SetupGuard>
              </div>
            </TooltipProvider>
          </PwaProvider>
        </LiveUpdatesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
