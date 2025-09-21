import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;

  connect(token?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000', {
          auth: {
            token
          },
          transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
          console.log('Connected to server');
          this.reconnectAttempts = 0;
          resolve(this.socket!);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Disconnected from server:', reason);
          this.handleReconnect();
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.socket?.connect();
      }, this.reconnectInterval * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  }

  on(event: string, callback: (data: any) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (data: any) => void) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  joinRoom(room: string) {
    this.emit('join_room', { room });
  }

  leaveRoom(room: string) {
    this.emit('leave_room', { room });
  }

  // Project-specific events
  joinProject(projectId: number) {
    this.joinRoom(`project_${projectId}`);
  }

  leaveProject(projectId: number) {
    this.leaveRoom(`project_${projectId}`);
  }

  // Task-specific events
  updateTaskStatus(taskId: number, status: string, projectId: number) {
    this.emit('task_status_updated', {
      taskId,
      status,
      projectId,
      timestamp: new Date().toISOString()
    });
  }

  taskAssigned(taskId: number, assigneeId: number, projectId: number) {
    this.emit('task_assigned', {
      taskId,
      assigneeId,
      projectId,
      timestamp: new Date().toISOString()
    });
  }

  // Notification events
  sendNotification(userId: number, message: string, type: 'info' | 'success' | 'warning' | 'error') {
    this.emit('notification', {
      userId,
      message,
      type,
      timestamp: new Date().toISOString()
    });
  }

  // Typing indicators
  startTyping(room: string, userId: number) {
    this.emit('typing_start', { room, userId });
  }

  stopTyping(room: string, userId: number) {
    this.emit('typing_stop', { room, userId });
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketService = new SocketService();