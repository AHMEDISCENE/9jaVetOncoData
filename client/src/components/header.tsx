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

  const unreadCount = unreadData?.count || 0;

  return (
    <header className="glass border-b">
      <div className="flex items-center justify-between h-16 px-6 sm:px-8 md:px-10">
        <div className="flex items-center space-x-3 sm:space-x-2 min-w-0 flex-1">
          <h1 className="flex-1 text-center sm:text-left sm:flex-none sm:text-base md:text-xl text-foreground text-[18px] font-extrabold ml-12 sm:ml-4" data-testid="text-page-title">
            {pageTitle}
          </h1>
        </div>
        
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Quick Actions - New Case */}
          {location !== "/cases/new" && (
            <motion.div
              animate={newCaseAnimating ? { scale: [1, 0.95, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              <Button 
                asChild
                className="bg-primary text-primary-foreground hover:bg-primary hover:opacity-90 rounded-full px-3 sm:px-4 transition-transform"
                data-testid="button-new-case"
                onClick={handleNewCaseClick}
              >
                <a href="/cases/new" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 pl-[10px] pr-[10px] pt-[0px] pb-[0px] ml-[0px] mr-[0px] text-left font-semibold">
                  <i className="fas fa-plus mr-1.5 sm:mr-2"></i>
                  <span className="text-sm sm:text-base">New Case</span>
                </a>
              </Button>
            </motion.div>
          )}
          
          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <motion.button 
                className="relative text-muted-foreground hover:text-foreground p-1.5 sm:p-2"
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
                        className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                          !notification.isRead ? "bg-muted/30" : ""
                        }`}
                        onClick={() => {
                          if (!notification.isRead) {
                            markAsReadMutation.mutate(notification.id);
                          }
                          if (notification.linkUrl) {
                            window.location.href = notification.linkUrl;
                          }
                        }}
                        data-testid={`notification-${notification.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm mb-1">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mb-1">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          {!notification.isRead && (
                            <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                          )}
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
            {isDark ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          </motion.button>
        </div>
      </div>
    </header>
  );
}
