import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setTabIdGetter } from "@workspace/api-client-react";

// Pages
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CharacterCreator from "@/pages/character-creator";
import Session from "@/pages/session";

const queryClient = new QueryClient();

// Generate or retrieve a per-tab identifier stored in sessionStorage.
// This allows multiple browser tabs to each have a distinct logged-in user
// identity even though they share the same session cookie.
function getOrCreateTabId(): string {
  const key = "tavernos_tab_id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
      <Route path="/campaign/:campaignId/create-character" component={CharacterCreator} />
      <Route path="/session/:campaignId/:sessionId" component={Session} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
