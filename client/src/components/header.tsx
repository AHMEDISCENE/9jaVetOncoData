import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { Moon, Sun, Menu } from "lucide-react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useNotifications } from "@/hooks/use-notifications";
import doodleHeaderImage from "@assets/generated_images/doodle_art_of_dog_cat_breeds_and_vet_materials.png";

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
  const [isDark, setIsDark] = useState(false);
  const [newCaseAnimating, setNewCaseAnimating] = useState(false);
  const [notificationAnimating, setNotificationAnimating] = useState(false);
  const [themeAnimating, setThemeAnimating] = useState(false);
  const pageTitle = pageTitles[location] || "9ja VetOncoData";
  const queryClient = useQueryClient();
  const { isMobileOpen, setIsMobileOpen } = useSidebar();
  
  // Initialize real-time notifications
  useNotifications();

  const handleNewCaseClick = () => {
    setNewCaseAnimating(true);
    setTimeout(() => setNewCaseAnimating(false), 600);
  };

  const handleNotificationClick = () => {
    setNotificationAnimating(true);
    setTimeout(() => setNotificationAnimating(false), 600);
  };

  const handleThemeToggle = () => {
    setThemeAnimating(true);
    setTimeout(() => setThemeAnimating(false), 600);
  };

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    handleThemeToggle();
    const isDarkMode = document.documentElement.classList.contains("dark");
    if (isDarkMode) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  };

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/${id}/mark-read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/mark-all-read"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'CASE_UPDATED':
        return '📋';
      case 'CASE_CREATED':
        return '✨';
      case 'FEED_COMMENT':
        return '💬';
      default:
        return '🔔';
    }
  };

  const unreadCount = unreadData?.count || 0;

  return (
    <header className="sticky top-0 z-30 border-b" style={{ backgroundImage: `url(${doodleHeaderImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/90 to-white/85 dark:from-gray-950/95 dark:via-gray-950/90 dark:to-gray-950/85 pointer-events-none" />
      
      <div className="relative flex items-center justify-between h-14 sm:h-16 md:h-20 px-3 sm:px-6 md:px-10 bg-[#0000001c]">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            className="lg:hidden text-foreground p-2 rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 hover:border-white/40 transition-all duration-200 hover:shadow-md"
            data-testid="button-toggle-mobile-menu"
            title="Toggle navigation"
          >
            <Menu className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
          <h1 className="flex-1 text-center sm:text-left sm:flex-none text-sm sm:text-base md:text-lg lg:text-xl text-foreground font-extrabold" data-testid="text-page-title">
            {pageTitle}
          </h1>
        </div>
        
        <div className="flex items-center space-x-0.5 sm:space-x-1 md:space-x-2">
          {/* Quick Actions - New Case */}
          {location !== "/cases/new" && (
            <motion.div
              animate={newCaseAnimating ? { scale: [1, 0.95, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              <Button 
                asChild
                className="bg-primary text-primary-foreground hover:bg-primary hover:opacity-90 rounded-full px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 transition-transform h-auto"
                data-testid="button-new-case"
                onClick={handleNewCaseClick}
              >
                <a href="/cases/new" className="inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap text-xs sm:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 font-semibold">
                  <i className="fas fa-plus text-xs sm:text-sm"></i>
                  <span className="hidden sm:inline text-xs sm:text-sm">New Case</span>
                </a>
              </Button>
            </motion.div>
          )}
          
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <motion.button 
                className="relative text-muted-foreground hover:text-foreground p-2 sm:p-2"
                data-testid="button-notifications"
                onClick={handleNotificationClick}
                animate={notificationAnimating ? { rotate: [-5, 5, -5, 0] } : { rotate: 0 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <i className="fas fa-bell text-sm sm:text-base"></i>
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </motion.button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Notifications</h3>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate()}
                    data-testid="button-mark-all-read"
                  >
                    Mark all as read
                  </Button>
                )}
              </div>
              <ScrollArea className="h-[400px]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <i className="fas fa-bell-slash text-4xl mb-2"></i>
                    <p>No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-muted/50 transition-colors group ${
                          !notification.isRead ? "bg-muted/30" : ""
                        }`}
                        data-testid={`notification-${notification.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => {
                              if (!notification.isRead) {
                                markAsReadMutation.mutate(notification.id);
                              }
                              if (notification.linkUrl) {
                                window.location.href = notification.linkUrl;
                              }
                            }}
                          >
                            <p className="font-medium text-sm mb-1">
                              <span className="mr-2">{getNotificationIcon(notification.type)}</span>
                              {notification.title}
                            </p>
                            <p className="text-sm text-muted-foreground mb-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-start gap-1">
                            {!notification.isRead && (
                              <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotificationMutation.mutate(notification.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity p-1"
                              data-testid={`button-delete-notification-${notification.id}`}
                              title="Delete notification"
                            >
                              <i className="fas fa-times text-sm" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* Theme Toggle */}
          <motion.button 
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground p-1.5 sm:p-2 transition-colors rounded-lg hover:bg-muted/50"
            data-testid="button-toggle-theme"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            animate={themeAnimating ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          >
            {isDark ? <Sun className="h-4 w-4 sm:h-4 md:h-5 md:w-5" /> : <Moon className="h-4 w-4 sm:h-4 md:h-5 md:w-5" />}
          </motion.button>
        </div>
      </div>
    </header>
  );
}
