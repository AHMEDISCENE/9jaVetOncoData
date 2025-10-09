import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Cases from "@/pages/cases";
import NewCase from "@/pages/new-case";
import BulkUpload from "@/pages/bulk-upload";
import Analytics from "@/pages/analytics";
import Reports from "@/pages/reports";
import Feeds from "@/pages/feeds";
import Calendar from "@/pages/calendar";
import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useAuth } from "@/hooks/use-auth";
import SetupClinic from "@/pages/setup-clinic";
import Settings from "@/pages/settings";
import { SidebarProvider, useSidebar } from "@/contexts/sidebar-context";

function AuthenticatedLayout() {
  const { isCollapsed } = useSidebar();
  
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`transition-all duration-200 ${isCollapsed ? "lg:ml-20" : "lg:ml-64"}`}>
        <Header />
        <main>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/cases" component={Cases} />
            <Route path="/cases/new" component={NewCase} />
            <Route path="/bulk-upload" component={BulkUpload} />
            <Route path="/analytics" component={Analytics} />
            <Route path="/reports" component={Reports} />
            <Route path="/feeds" component={Feeds} />
            <Route path="/calendar" component={Calendar} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function Router() {
  const { user, clinic, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4 mx-auto">
            <i className="fas fa-stethoscope text-primary-foreground text-2xl"></i>
          </div>
          <p className="text-muted-foreground">Loading 9ja VetOncoData...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/*" component={Login} />
      </Switch>
    );
  }

  // Authenticated users: check if they need to complete clinic setup
  const needsClinicSetup = user && !clinic;
  
  if (needsClinicSetup) {
    return (
      <Switch>
        <Route path="/setup-clinic" component={SetupClinic} />
        <Route path="/*">
          {() => {
            // Redirect to setup-clinic if user is authenticated but has no clinic
            window.location.href = "/setup-clinic";
            return null;
          }}
        </Route>
      </Switch>
    );
  }

  return (
    <SidebarProvider>
      <AuthenticatedLayout />
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
