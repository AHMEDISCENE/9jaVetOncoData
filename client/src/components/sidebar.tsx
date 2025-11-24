import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  LogOut,
  LayoutDashboard,
  Stethoscope as CaseIcon,
  BarChart3,
  FileText,
  Upload,
  MessageCircle,
  CalendarDays,
  Stethoscope,
  X,
  Menu,
  Users,
  Gear,
  Home
} from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import doodleImage from "@assets/generated_images/doodle_art_of_dog_cat_breeds_and_vet_materials.png";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, clinic, logout } = useAuth();
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home, description: "Overview" },
    { name: "Cases", href: "/cases", icon: CaseIcon, description: "Patient cases" },
    { name: "Analytics", href: "/analytics", icon: BarChart3, description: "Insights" },
    { name: "Reports", href: "/reports", icon: FileText, description: "Generate reports" },
    { name: "Bulk Upload", href: "/bulk-upload", icon: Upload, description: "Import data" },
    { name: "Feeds", href: "/feeds", icon: MessageCircle, description: "Collaboration" },
    { name: "Calendar", href: "/calendar", icon: CalendarDays, description: "Schedule" },
  ];

  // Admin-only navigation (both ADMIN and SUPER_ADMIN)
  const adminNavigation = (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? [
    { name: "User Management", href: "/admin/users", icon: Users, description: "Manage team" },
  ] : [];

  const allNavigation = [...navigation, ...adminNavigation];

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
        <motion.div 
          className="fixed inset-0 z-40 lg:hidden" 
          onClick={() => setIsMobileOpen(false)}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-foreground/50"></div>
        </motion.div>
      )}
      {/* Sidebar */}
      <motion.div 
        className={`fixed inset-y-0 left-0 z-50 border-r lg:translate-x-0 ${
          isCollapsed ? "lg:w-20" : "lg:w-64"
        } w-64`}
        style={{ backgroundImage: `url(${doodleImage})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
        initial={{ x: -300 }}
        animate={{ x: isMobileOpen || typeof window === 'undefined' || window.innerWidth >= 1024 ? 0 : -300 }}
        transition={{ type: "spring", damping: 20, stiffness: 100, duration: 0.4 }}
      >
        {/* Background overlay for text readability - subtle like header */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/90 to-white/85 dark:from-gray-950/95 dark:via-gray-950/90 dark:to-gray-950/85 pointer-events-none" />
        
        <div className="relative flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-white/10 dark:border-gray-700/20 backdrop-blur-sm">
            <div className="flex items-center space-x-2 overflow-hidden">
              <motion.div 
                className="h-9 w-9 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg"
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Stethoscope className="h-5 w-5 text-primary-foreground" />
              </motion.div>
              {!isCollapsed && (
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-black text-foreground tracking-tight">9ja</span>
                  <span className="text-xs font-semibold text-foreground/70">VetOncoData</span>
                </div>
              )}
            </div>
            <button 
              className="lg:hidden text-muted-foreground hover:text-foreground transition-colors"
              onClick={toggleMobileSidebar}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Desktop Collapse Toggle */}
          <motion.button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center h-10 mx-2 mt-3 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-gray-800/20 dark:hover:bg-gray-800/40 text-foreground/70 hover:text-foreground transition-all duration-200 border border-white/10 dark:border-gray-700/20 backdrop-blur-sm"
            data-testid="button-toggle-sidebar"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-xs font-semibold">Collapse</span>
              </>
            )}
          </motion.button>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
            {allNavigation.map((item, index) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                >
                  <Link 
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden ${
                      active 
                        ? "bg-gradient-to-r from-primary/40 to-primary/20 text-primary dark:text-primary-foreground shadow-md border border-primary/30" 
                        : "text-foreground/70 hover:text-foreground hover:bg-white/20 dark:hover:bg-gray-800/30 border border-transparent hover:border-white/10 dark:hover:border-gray-700/20"
                    }`}
                    data-testid={`link-${item.name.toLowerCase().replace(" ", "-")}`}
                    onClick={() => setIsMobileOpen(false)}
                    title={isCollapsed ? item.name : undefined}
                  >
                    {/* Active indicator bar */}
                    {active && <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-primary/60" />}
                    
                    <div className={`relative flex items-center justify-center rounded-md p-1.5 transition-all duration-200 ${
                      active 
                        ? "bg-primary/20 text-primary dark:text-primary-foreground" 
                        : "bg-white/10 dark:bg-gray-800/20 group-hover:bg-white/20 dark:group-hover:bg-gray-800/40"
                    }`}>
                      <Icon className="h-5 w-5 flex-shrink-0" />
                    </div>
                    
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold leading-tight ${active ? "text-foreground" : ""}`}>
                          {item.name}
                        </p>
                        <p className={`text-xs leading-tight opacity-0 group-hover:opacity-100 transition-opacity ${
                          active ? "text-primary/80" : "text-foreground/50"
                        }`}>
                          {item.description}
                        </p>
                      </div>
                    )}
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* User Profile */}
          <motion.div 
            className="border-t border-white/10 dark:border-gray-700/20 p-4 bg-gradient-to-t from-white/20 via-white/10 to-transparent dark:from-gray-800/20 dark:via-gray-800/10 dark:to-transparent backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center space-y-4">
                <motion.div 
                  className="h-12 w-12 bg-gradient-to-br from-primary/90 to-primary/70 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-primary/30" 
                  title={user?.name || "Unknown User"}
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <span className="text-xs font-bold text-primary-foreground" data-testid="text-user-initials">
                    {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
                  </span>
                </motion.div>
                <motion.div className="flex flex-col gap-2 w-full" whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <Link 
                    href="/settings"
                    className="w-full p-2.5 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-gray-800/30 dark:hover:bg-gray-800/50 text-foreground hover:text-foreground transition-all duration-200 flex items-center justify-center border border-white/10 hover:border-white/20 dark:border-gray-700/20 dark:hover:border-gray-700/40"
                    data-testid="link-settings"
                    onClick={() => setIsMobileOpen(false)}
                    title="Settings"
                  >
                    <Gear className="h-5 w-5" />
                  </Link>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="w-full px-2 font-semibold shadow-md hover:shadow-lg transition-all duration-200" 
                    onClick={handleLogout}
                    data-testid="button-logout"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-3 mb-4 p-3 rounded-lg bg-gradient-to-r from-white/30 to-white/20 dark:from-gray-800/40 dark:to-gray-800/20 backdrop-blur-sm border border-white/20 dark:border-gray-700/30 shadow-sm">
                  <motion.div 
                    className="h-12 w-12 bg-gradient-to-br from-primary/90 to-primary/70 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-primary/30"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    <span className="text-xs font-bold text-primary-foreground" data-testid="text-user-initials">
                      {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
                    </span>
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate" data-testid="text-user-name">
                      {user?.name || "Unknown User"}
                    </p>
                    <p className="text-xs font-semibold text-primary/90 truncate" data-testid="text-clinic-name">
                      {clinic?.name || "No Clinic"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <Link 
                      href="/settings"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/20 hover:bg-white/30 dark:bg-gray-800/30 dark:hover:bg-gray-800/50 text-foreground transition-all duration-200 border border-white/10 hover:border-white/20 dark:border-gray-700/20 dark:hover:border-gray-700/40 group"
                      data-testid="link-settings"
                      onClick={() => setIsMobileOpen(false)}
                    >
                      <div className="flex items-center justify-center rounded-md bg-white/10 dark:bg-gray-700/30 p-1.5 group-hover:bg-white/20 dark:group-hover:bg-gray-700/50 transition-all">
                        <Gear className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-semibold">Settings</span>
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full font-semibold shadow-md hover:shadow-lg transition-all duration-200 gap-2" 
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </Button>
                  </motion.div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </motion.div>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-30 p-2 rounded-md glass hover:text-foreground ml-[0px] mr-[0px] text-[#91bfb4]"
        onClick={toggleMobileSidebar}
        data-testid="button-open-sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>
    </>
  );
}
