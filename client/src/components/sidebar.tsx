import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, clinic, logout } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: "fas fa-chart-line" },
    { name: "Cases", href: "/cases", icon: "fas fa-folder-medical" },
    { name: "Analytics", href: "/analytics", icon: "fas fa-chart-bar" },
    { name: "Reports", href: "/reports", icon: "fas fa-file-alt" },
    { name: "Bulk Upload", href: "/bulk-upload", icon: "fas fa-upload" },
    { name: "Feeds", href: "/feeds", icon: "fas fa-rss" },
    { name: "Calendar", href: "/calendar", icon: "fas fa-calendar" },
    { name: "Settings", href: "/settings", icon: "fas fa-cog" },
  ];

  const isActive = (href: string) => {
    if (href === "/dashboard" && (location === "/" || location === "/dashboard")) {
      return true;
    }
    return location.startsWith(href) && href !== "/dashboard";
  };

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 lg:hidden" 
          onClick={() => setIsMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-foreground/50"></div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                <i className="fas fa-stethoscope text-primary-foreground text-sm"></i>
              </div>
              <span className="text-lg font-semibold text-foreground">9ja VetOncoData</span>
            </div>
            <button 
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={toggleMobileSidebar}
              data-testid="button-close-sidebar"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navigation.map((item) => (
              <Link 
                key={item.name} 
                href={item.href}
                className={`nav-item ${isActive(item.href) ? "active" : ""}`}
                data-testid={`link-${item.name.toLowerCase().replace(" ", "-")}`}
                onClick={() => setIsMobileOpen(false)}
              >
                <i className={item.icon}></i>
                {item.name}
              </Link>
            ))}
          </nav>

          {/* User Profile */}
          <div className="border-t border-border p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
                <span className="text-sm font-medium" data-testid="text-user-initials">
                  {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate" data-testid="text-user-name">
                  {user?.name || "Unknown User"}
                </p>
                <p className="text-xs text-muted-foreground truncate" data-testid="text-clinic-name">
                  {clinic?.name || "No Clinic"}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-md bg-card border border-border text-muted-foreground hover:text-foreground"
        onClick={toggleMobileSidebar}
        data-testid="button-open-sidebar"
      >
        <i className="fas fa-bars"></i>
      </button>
    </>
  );
}
