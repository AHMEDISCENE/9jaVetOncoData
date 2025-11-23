import { WebSocket, WebSocketServer } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { Notification, InsertNotification } from '@shared/schema';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

class NotificationManager {
  private wss: WebSocketServer;
  private userConnections: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      if (request.url === '/ws/notifications') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, request: IncomingMessage) => {
      // Extract userId from session/auth header
      const url = new URL(request.url || '', 'http://localhost');
      const userId = url.searchParams.get('userId');

      if (!userId) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      ws.userId = userId;
      ws.isAlive = true;

      // Add to user connections
      if (!this.userConnections.has(userId)) {
        this.userConnections.set(userId, new Set());
      }
      this.userConnections.get(userId)!.add(ws);

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('close', () => {
        const connections = this.userConnections.get(userId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            this.userConnections.delete(userId);
          }
        }
      });

      ws.on('error', (error) => {
        console.error('[WebSocket Error]', error);
      });
    });

    // Heartbeat to detect stale connections
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * Send notification to a specific user
   */
  sendNotification(userId: string, notification: Notification) {
    const connections = this.userConnections.get(userId);
    if (!connections) return;

    const message = JSON.stringify({
      type: 'notification',
      data: notification,
    });

    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Send notification to multiple users
   */
  broadcastToUsers(userIds: string[], notification: Notification) {
    userIds.forEach(userId => this.sendNotification(userId, notification));
  }

  /**
   * Send notification to all users in a clinic
   */
  broadcastToClinic(clinicId: string, notification: Notification, clinicUserIds: string[]) {
    this.broadcastToUsers(clinicUserIds, notification);
  }

  /**
   * Get connection count for debugging
   */
  getConnectionCount(userId?: string): number {
    if (userId) {
      return this.userConnections.get(userId)?.size || 0;
    }
    return this.wss.clients.size;
  }

  /**
   * Close manager
   */
  close() {
    this.wss.close();
    this.userConnections.clear();
  }
}

export { NotificationManager, AuthenticatedWebSocket };
