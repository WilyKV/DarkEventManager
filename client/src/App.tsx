import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import HomePage from "@/pages/home";
import DashboardPage from "@/pages/dashboard";
import ZombiePage from "@/pages/zombie";
import SurvivantPage from "@/pages/survivant";
import BoutiquePage from "@/pages/boutique";
import RepasPage from "@/pages/repas";
import BadgesPage from "@/pages/badges";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/zombie" component={ZombiePage} />
      <Route path="/survivant" component={SurvivantPage} />
      <Route path="/boutique" component={BoutiquePage} />
      <Route path="/repas" component={RepasPage} />
      <Route path="/badges" component={BadgesPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
