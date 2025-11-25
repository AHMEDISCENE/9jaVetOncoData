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
import logoImage from "@assets/image_1763987419993.png";

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
        } w-64 bg-white dark:bg-gray-950`}
        initial={{ x: -300 }}
        animate={{ x: isMobileOpen || isDesktop ? 0 : -300 }}
        transition={{ type: "spring", damping: 20, stiffness: 100, duration: 0.4 }}
      >
        
        <div className="relative flex flex-col h-full">
          {/* Logo Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border pl-[0px] pr-[0px] pt-[20px] pb-[20px]">
            <div className="flex items-center gap-2 lg:gap-3 overflow-hidden flex-1">
              {!isCollapsed && (
                <motion.div 
                  className="flex items-center gap-2 lg:gap-3 whitespace-nowrap"
                  animate={{ x: ["0px", "-60px", "0px"] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                >
                  <img 
                    src={logoImage} 
                    alt="VetOncoData Logo"
                    className="h-8 w-8 lg:h-10 lg:w-10 flex-shrink-0 object-contain"
                  />
                  <span 
                    className="text-primary tracking-tight text-lg lg:text-[26px] font-extrabold leading-tight"
                  >
                    9ja VetOncoData
                  </span>
                </motion.div>
              )}
              {isCollapsed && (
                <img 
                  src={logoImage} 
                  alt="VetOncoData Logo"
                  className="h-8 w-8 flex-shrink-0 object-contain ml-[22px] mr-[22px]"
                />
              )}
            </div>
            {/* Mobile Close Button */}
            <button 
              className="lg:hidden flex items-center justify-center h-10 w-10 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/20 text-foreground transition-colors flex-shrink-0 ml-4"
              onClick={toggleMobileSidebar}
              data-testid="button-close-sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Desktop Collapse Toggle */}
          <div className="hidden lg:px-4 lg:flex lg:py-1">
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-md text-foreground/60 hover:text-foreground hover:bg-primary/8 dark:hover:bg-primary/15 transition-colors"
              data-testid="button-toggle-sidebar"
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4 flex-shrink-0" />
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs truncate">Collapse</span>
                </>
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-4 pt-[0px] pb-[0px]">
            {allNavigation.map((item, index) => {
              const Icon = item.icon;
              const itemActive = isActive(item.href);
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3, ease: "easeOut" }}
                >
                  <Link 
                    href={item.href}
                    className={`nav-item group ${itemActive ? "active text-[#126b56]" : "hover:bg-opacity-100"} ${
                      isCollapsed 
                        ? "lg:justify-center lg:p-3 lg:rounded-md lg:w-full" 
                        : "justify-start"
                    }`}
                    data-testid={`link-${item.name.toLowerCase().replace(" ", "-")}`}
                    onClick={() => setIsMobileOpen(false)}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon className={`flex-shrink-0 transition-all duration-200 ${
                      isCollapsed 
                        ? "lg:h-6 lg:w-6 h-5 w-5" 
                        : "h-5 w-5"
                    } ${itemActive ? "text-primary dark:text-primary-foreground" : "group-hover:text-primary dark:group-hover:text-primary"}`} />
                    <span className={`transition-opacity duration-200 text-[#000000] ${isCollapsed ? "lg:hidden" : ""}`}>
                      {item.name}
                    </span>
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* User Profile */}
          <motion.div 
            className="border-t border-border/40 p-3 space-y-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "easeOut" }}
          >
            {isCollapsed ? (
              <div className="flex flex-col items-center space-y-2">
                <motion.div 
                  className="h-10 w-10 bg-gradient-to-br from-primary/90 to-primary/70 rounded-full flex items-center justify-center shadow-md ring-2 ring-primary/20 overflow-hidden flex-shrink-0 relative" 
                  title={user?.name || "Unknown User"}
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  {(user as any)?.image ? (
                    <img 
                      src={`${window.location.origin}${(user as any).image}?t=${Date.now()}`}
                      alt="Profile"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-primary-foreground" data-testid="text-user-initials">
                      {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
                    </span>
                  )}
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <Link 
                    href="/settings"
                    className="block p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary dark:text-primary-foreground dark:hover:text-primary-foreground transition-all duration-200 border border-primary/20 hover:border-primary/40"
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
                    className="w-full px-2 py-1.5 font-semibold shadow-md hover:shadow-lg transition-all duration-200 h-auto" 
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
                <Link 
                  href="/settings"
                  className="flex items-center space-x-2 p-1.5 rounded-lg bg-gray-100 dark:bg-gray-900 border border-border hover:bg-gray-200 dark:hover:bg-gray-800 hover:border-primary/40 transition-all duration-200 cursor-pointer"
                  data-testid="link-user-profile"
                  onClick={() => setIsMobileOpen(false)}
                >
                  <motion.div 
                    className="h-10 w-10 bg-gradient-to-br from-primary/90 to-primary/70 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ring-2 ring-primary/20 overflow-hidden relative"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {(user as any)?.image ? (
                      <img 
                        src={`${window.location.origin}${(user as any).image}?t=${Date.now()}`}
                        alt="Profile"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-primary-foreground" data-testid="text-user-initials">
                        {user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "??"}
                      </span>
                    )}
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate" data-testid="text-user-name">
                      {user?.name || "Unknown User"}
                    </p>
                    <p className="text-xs font-medium text-foreground/60 truncate" data-testid="text-clinic-name">
                      {clinic?.name || "No Clinic"}
                    </p>
                  </div>
                </Link>
                <div className="space-y-1.5">
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <Link 
                      href="/settings"
                      className="nav-item gap-2 font-semibold justify-start py-1.5 px-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary hover:text-primary dark:text-primary-foreground dark:hover:text-primary-foreground transition-all duration-200 border border-primary/20 hover:border-primary/40 text-sm"
                      data-testid="link-settings"
                      onClick={() => setIsMobileOpen(false)}
                    >
                      <Settings className="h-4 w-4 flex-shrink-0" />
                      <span className="text-xs font-semibold">Settings</span>
                    </Link>
                  </motion.div>
                  <motion.div whileHover={{ scale: 1.02 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="w-full font-semibold shadow-md hover:shadow-lg transition-all duration-200 py-1.5 h-auto text-xs" 
                      onClick={handleLogout}
                      data-testid="button-logout"
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1.5" />
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
