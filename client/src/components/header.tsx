import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

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
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/notifications/${id}/mark-read`, {
      method: "POST",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => apiRequest("/api/notifications/mark-all-read", {
      method: "POST",
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <header className="glass border-b">
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
          <Popover>
            <PopoverTrigger asChild>
              <button 
                className="relative text-muted-foreground hover:text-foreground p-2"
                data-testid="button-notifications"
              >
                <i className="fas fa-bell"></i>
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Badge>
                )}
              </button>
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
        </div>
      </div>
    </header>
  );
}
