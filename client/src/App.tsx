import React from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import LoginPage from "@/pages/login";
import VisitorPage from "@/pages/visitor";
import OverviewPage from "@/pages/overview";
import DashboardPage from "@/pages/dashboard";
import ZombiePage from "@/pages/zombie";
import SurvivantPage from "@/pages/survivant";
import StaffPage from "@/pages/staff";
import BoutiquePage from "@/pages/boutique";
import RepasPage from "@/pages/repas";
import BadgesPage from "@/pages/badges";
import ScanPage from "@/pages/scan";
import AdminPage from "@/pages/admin";
import SetupPage from "@/pages/setup";
import NotFound from "@/pages/not-found";

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

  if (data?.needsSetup === true && location !== "/setup") {
    setLocation("/setup");
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/setup" component={SetupPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/visitor">
        <VisitorPage />
      </Route>

      {/* Root → overview */}
      <Route path="/">
        <Redirect to="/overview" />
      </Route>
      {/* /home → overview (rétro-compat) */}
      <Route path="/home">
        <Redirect to="/overview" />
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

      <Route path="/zombie">
        <RequireAuth>
          <ZombiePage />
        </RequireAuth>
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
        <RequireAuth roles={["admin", "staff"]}>
          <AdminPage />
        </RequireAuth>
      </Route>
      <Route path="/users">
        <Redirect to="/admin" />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <div className="min-h-screen bg-background text-foreground">
            <Toaster />
            <SetupGuard>
              <Router />
            </SetupGuard>
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
