import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setTabIdGetter } from "@workspace/api-client-react";
import { ThemeProvider } from "@/contexts/ThemeContext";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CharacterCreator from "@/pages/character-creator";
import Session from "@/pages/session";
import HeroStudio from "@/pages/hero-studio";

const queryClient = new QueryClient();

// Generate or retrieve a per-tab identifier stored in sessionStorage.
// This allows multiple browser tabs to each have a distinct logged-in user
// identity even though they share the same session cookie.
function getOrCreateTabId(): string {
  const key = "viceos_tab_id";
  const legacyKey = "tavernos_tab_id";
  let id = sessionStorage.getItem(key) ?? sessionStorage.getItem(legacyKey);
  if (!id) {
    id = `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  } else if (!sessionStorage.getItem(key) && sessionStorage.getItem(legacyKey)) {
    sessionStorage.setItem(key, id);
  }
  return id;
}

setTabIdGetter(getOrCreateTabId);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create-character" component={CharacterCreator} />
      <Route path="/campaign/:campaignId/create-character" component={CharacterCreator} />
      <Route path="/session/:campaignId/:sessionId" component={Session} />
      <Route path="/hero/:characterId" component={HeroStudio} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
