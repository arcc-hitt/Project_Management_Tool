import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { socketService } from '../services/socketService';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
}

interface TypingUser {
  userId: number;
  userName: string;
  room: string;
  context: 'task' | 'project' | 'comment';
  contextId: string;
  timestamp: number;
}

interface RealTimeContextType {
  isConnected: boolean;
  notifications: Notification[];
  typingUsers: TypingUser[];
  onlineUsers: number[];
  markNotificationAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  sendNotification: (userId: number, message: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  joinProject: (projectId: number) => void;
  leaveProject: (projectId: number) => void;
  startTyping: (room: string) => void;
  stopTyping: (room: string) => void;
  updateTaskStatus: (taskId: number, status: string, projectId: number) => void;
}

const RealTimeContext = createContext<RealTimeContextType | undefined>(undefined);

export const useRealTime = () => {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error('useRealTime must be used within a RealTimeProvider');
  }
  return context;
};

interface RealTimeProviderProps {
  children: ReactNode;
}

export const RealTimeProvider: React.FC<RealTimeProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const { user } = useAuth();
  const token = localStorage.getItem('accessToken');

  useEffect(() => {
    if (user && token) {
      initializeSocket();
    }

    return () => {
      socketService.disconnect();
    };
  }, [user, token]);

  const initializeSocket = async () => {
    try {
      await socketService.connect(token || undefined);
      setIsConnected(true);
      setupEventListeners();
    } catch (error) {
      console.error('Failed to connect to socket:', error);
      setIsConnected(false);
    }
  };

  const setupEventListeners = () => {
    // Connection events
    socketService.on('connect', () => {
      setIsConnected(true);
      toast.success('Connected to real-time updates');
    });

    socketService.on('disconnect', () => {
      setIsConnected(false);
      toast.error('Disconnected from real-time updates');
    });

    // Notification events
    socketService.on('notification', (data: any) => {
      const notification: Notification = {
        id: Date.now().toString(),
        message: data.message,
        type: data.type,
        timestamp: data.timestamp,
        read: false
      };
      
      setNotifications(prev => [notification, ...prev]);
      
      // Show toast notification
      switch (data.type) {
        case 'success':
          toast.success(data.message);
          break;
        case 'warning':
          toast.warning(data.message);
          break;
        case 'error':
          toast.error(data.message);
          break;
        default:
          toast.info(data.message);
      }
    });

    // Task events
    socketService.on('task_status_updated', (data: any) => {
      toast.info(`Task status updated to ${data.status}`);
      // Trigger a refresh of task data in components
      window.dispatchEvent(new CustomEvent('taskUpdated', { detail: data }));
    });

    socketService.on('task_assigned', (data: any) => {
      toast.info('New task assigned to you');
      window.dispatchEvent(new CustomEvent('taskAssigned', { detail: data }));
    });

    socketService.on('project_updated', (data: any) => {
      toast.info(`Project "${data.projectName}" has been updated`);
      window.dispatchEvent(new CustomEvent('projectUpdated', { detail: data }));
    });

    // Typing events
    socketService.on('typing_start', (data: { 
      userId: number; 
      userName: string; 
      room: string; 
      context: 'task' | 'project' | 'comment';
      contextId: string;
    }) => {
      setTypingUsers(prev => {
        const exists = prev.find(user => user.userId === data.userId && user.room === data.room);
        if (!exists) {
          return [...prev, {
            ...data,
            timestamp: Date.now()
          }];
        }
        return prev;
      });
    });

    socketService.on('typing_stop', (data: { userId: number; room: string }) => {
      setTypingUsers(prev => 
        prev.filter(user => !(user.userId === data.userId && user.room === data.room))
      );
    });

    // User presence events
    socketService.on('user_online', (data: { userId: number }) => {
      setOnlineUsers(prev => [...new Set([...prev, data.userId])]);
    });

    socketService.on('user_offline', (data: { userId: number }) => {
      setOnlineUsers(prev => prev.filter(id => id !== data.userId));
    });

    socketService.on('online_users', (data: { users: number[] }) => {
      setOnlineUsers(data.users);
    });
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const sendNotification = (userId: number, message: string, type: 'info' | 'success' | 'warning' | 'error') => {
    socketService.sendNotification(userId, message, type);
  };

  const joinProject = (projectId: number) => {
    socketService.joinProject(projectId);
  };

  const leaveProject = (projectId: number) => {
    socketService.leaveProject(projectId);
  };

  const startTyping = (room: string) => {
    if (user) {
      socketService.startTyping(room, user.id);
    }
  };

  const stopTyping = (room: string) => {
    if (user) {
      socketService.stopTyping(room, user.id);
    }
  };

  const updateTaskStatus = (taskId: number, status: string, projectId: number) => {
    socketService.updateTaskStatus(taskId, status, projectId);
  };

  const value: RealTimeContextType = {
    isConnected,
    notifications,
    typingUsers,
    onlineUsers,
    markNotificationAsRead,
    clearAllNotifications,
    sendNotification,
    joinProject,
    leaveProject,
    startTyping,
    stopTyping,
    updateTaskStatus
  };

  return (
    <RealTimeContext.Provider value={value}>
      {children}
    </RealTimeContext.Provider>
  );
};