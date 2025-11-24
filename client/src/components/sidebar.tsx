import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { 
  ChevronLeft, 
  ChevronRight, 
  LogOut,
  LayoutDashboard,
  ClipboardList,
  TrendingUp,
  BarChart4,
  Upload,
  MessageSquare,
  Calendar,
  Stethoscope,
  X,
  Menu,
  Users,
  Settings
} from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import doodleImage from "@assets/generated_images/doodle_art_of_dog_cat_breeds_and_vet_materials.png";

export default function Sidebar() {
  const [location] = useLocation();
  const { user, clinic, logout } = useAuth();
  const { isCollapsed, setIsCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();
  const [isDesktop, setIsDesktop] = useState(typeof window !== 'undefined' && window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Cases", href: "/cases", icon: ClipboardList },
    { name: "Analytics", href: "/analytics", icon: TrendingUp },
    { name: "Reports", href: "/reports", icon: BarChart4 },
    { name: "Bulk Upload", href: "/bulk-upload", icon: Upload },
    { name: "Feeds", href: "/feeds", icon: MessageSquare },
    { name: "Calendar", href: "/calendar", icon: Calendar },
  ];

  // Admin-only navigation (both ADMIN and SUPER_ADMIN)
  const adminNavigation = (user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") ? [
    { name: "User Management", href: "/admin/users", icon: Users },
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
        animate={{ x: isMobileOpen || isDesktop ? 0 : -300 }}
        transition={{ type: "spring", damping: 20, stiffness: 100, duration: 0.4 }}
      >
        {/* Background overlay for text readability - subtle like header */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/95 via-white/90 to-white/85 dark:from-gray-950/95 dark:via-gray-950/90 dark:to-gray-950/85 pointer-events-none" />
        
        <div className="relative flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <div className="flex items-center space-x-2 overflow-hidden">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                <Stethoscope className="h-4 w-4 text-primary-foreground" />
              </div>
              {!isCollapsed && (
                <span className="text-lg font-bold text-foreground whitespace-nowrap">9ja VetOncoData</span>
              )}
            </div>
            <button 
              className="lg:hidden text-muted-foreground hover:text-foreground"
              onClick={toggleMobileSidebar}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center h-10 mx-2 mt-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-toggle-sidebar"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4 mr-2" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {allNavigation.map((item, index) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                >
                  <Link 
                    href={item.href}
                    className={`nav-item ${isActive(item.href) ? "active" : ""} ${isCollapsed ? "lg:justify-center lg:px-3" : ""}`}
                    data-testid={`link-${item.name.toLowerCase().replace(" ", "-")}`}
                    onClick={() => setIsMobileOpen(false)}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className={`${isCollapsed ? "lg:hidden" : ""}`}>{item.name}</span>
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* User Profile */}
          <motion.div 
            className="border-t border-border/40 p-4 bg-gradient-to-t from-primary/5 via-white/40 to-white/30 dark:from-primary/10 dark:via-gray-900/40 dark:to-gray-900/30 backdrop-blur-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center space-y-3">
                <motion.div 
                  className="h-12 w-12 bg-gradient-to-br from-primary/90 to-primary/70 rounded-full flex items-center justify-center shadow-lg ring-2 ring-primary/20" 
                  title={user?.name || "Unknown User"}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <span className="text-xs font-bold text-primary-foreground" data-testid="text-user-initials">
                    {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
                  </span>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <Link 
                    href="/settings"
                    className="w-full px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary dark:text-primary-foreground dark:hover:text-primary-foreground transition-all duration-200 flex items-center justify-center border border-primary/20 hover:border-primary/40"
                    data-testid="link-settings"
                    onClick={() => setIsMobileOpen(false)}
                    title="Settings"
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                </motion.div>
                <motion.div className="w-full" whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
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
                <div className="flex items-center space-x-3 mb-4 p-2 rounded-lg bg-white/40 dark:bg-gray-800/40 backdrop-blur-sm border border-white/20 dark:border-gray-700/20">
                  <motion.div 
                    className="h-12 w-12 bg-gradient-to-br from-primary/90 to-primary/70 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-primary/20"
                    whileHover={{ scale: 1.05 }}
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
                    <p className="text-xs font-medium text-foreground/70 truncate" data-testid="text-clinic-name">
                      {clinic?.name || "No Clinic"}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <Link 
                      href="/settings"
                      className="nav-item gap-2 font-semibold justify-start py-2 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary dark:text-primary-foreground dark:hover:text-primary-foreground transition-all duration-200 border border-primary/20 hover:border-primary/40"
                      data-testid="link-settings"
                      onClick={() => setIsMobileOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      <span className="text-sm font-semibold">Settings</span>
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full font-semibold shadow-md hover:shadow-lg transition-all duration-200" 
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
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
