import { useEffect, useRef, useCallback } from 'react';
import type { Notification } from '@shared/schema';
import { useToast } from './use-toast';
import { queryClient } from '@/lib/queryClient';

interface UseNotificationsOptions {
  onNotification?: (notification: Notification) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { onNotification } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const { toast } = useToast();

  const connect = useCallback(() => {
    // Get userId from session (we'll need to pass this somehow)
    const userId = localStorage.getItem('userId');
    if (!userId) {
      console.warn('[Notifications] No userId found, skipping WebSocket connection');
      return;
    }

    try {
      // Construct WebSocket URL properly handling potential port issues
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.hostname;
      const port = window.location.port || (window.location.protocol === 'https:' ? 443 : 80);
      const wsUrl = `${protocol}//${host}:${port}/ws/notifications?userId=${encodeURIComponent(userId)}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[Notifications] WebSocket connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'notification' && message.data) {
            const notification = message.data as Notification;
            
            // Show toast notification
            toast({
              title: notification.title || 'New Notification',
              description: notification.message,
              duration: 5000,
            });

            // Invalidate notifications query to refetch
            queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
            queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });

            // Call custom handler if provided
            if (onNotification) {
              onNotification(notification);
            }
          }
        } catch (error) {
          console.error('[Notifications] Error parsing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[Notifications] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[Notifications] WebSocket disconnected');
        wsRef.current = null;

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
          console.log(`[Notifications] Reconnecting in ${delay}ms...`);
          setTimeout(() => connect(), delay);
        }
      };
    } catch (error) {
      console.error('[Notifications] Failed to connect WebSocket:', error);
    }
  }, [toast, onNotification]);

  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
}
