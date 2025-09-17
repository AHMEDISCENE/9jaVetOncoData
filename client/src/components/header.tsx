import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/cases": "Case Management",
  "/cases/new": "New Case",
  "/bulk-upload": "Bulk Upload",
  "/analytics": "Analytics",
  "/reports": "Reports",
  "/feeds": "Feeds",
  "/calendar": "Calendar",
};

export default function Header() {
  const [location] = useLocation();
  const pageTitle = pageTitles[location] || "9ja VetOncoData";

  return (
    <header className="bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold text-foreground lg:ml-0 ml-12" data-testid="text-page-title">
            {pageTitle}
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Quick Actions */}
          {location !== "/cases/new" && (
            <Button 
              asChild
              className="bg-primary text-primary-foreground hover:bg-primary hover:opacity-90"
              data-testid="button-new-case"
            >
              <a href="/cases/new">
                <i className="fas fa-plus mr-2"></i>New Case
              </a>
            </Button>
          )}
          
          {/* Notifications */}
          <button 
            className="relative text-muted-foreground hover:text-foreground p-2"
            data-testid="button-notifications"
          >
            <i className="fas fa-bell"></i>
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-3 w-3 p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </button>
        </div>
      </div>
    </header>
  );
}
