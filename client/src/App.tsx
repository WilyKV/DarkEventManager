import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import LoginPage from "@/pages/login";
import VisitorPage from "@/pages/visitor";
import UsersPage from "@/pages/users";
import HomePage from "@/pages/home";
import DashboardPage from "@/pages/dashboard";
import ZombiePage from "@/pages/zombie";
import SurvivantPage from "@/pages/survivant";
import StaffPage from "@/pages/staff";
import BoutiquePage from "@/pages/boutique";
import RepasPage from "@/pages/repas";
import BadgesPage from "@/pages/badges";
import ScanPage from "@/pages/scan";
import AdminPage from "@/pages/admin";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/visitor">
        <VisitorPage />
      </Route>

      {/* Protected routes */}
      <Route path="/">
        <Redirect to="/home" />
      </Route>
      <Route path="/home">
        <RequireAuth>
          <HomePage />
        </RequireAuth>
      </Route>
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
        <RequireAuth roles={["admin"]}>
          <UsersPage />
        </RequireAuth>
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
          <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-gray-900">
            <Toaster />
            <Router />
          </div>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
