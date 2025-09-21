import { apiClient } from './api';

export interface Notification {
  id: number;
  userId: number;
  type: 'task_assigned' | 'task_updated' | 'task_completed' | 'project_updated' | 'comment_added' | 'deadline_reminder';
  title: string;
  message: string;
  entityType: 'task' | 'project' | 'user_story' | 'comment';
  entityId: number;
  isRead: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface NotificationFilter {
  isRead?: boolean;
  type?: string;
  entityType?: string;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: Record<string, number>;
}

class NotificationService {
  /**
   * Get user's notifications with filtering and pagination
   */
  async getUserNotifications(filters?: NotificationFilter): Promise<{ notifications: Notification[]; total: number }> {
    try {
      const params = new URLSearchParams();
      
      if (filters?.isRead !== undefined) params.append('isRead', filters.isRead.toString());
      if (filters?.type) params.append('type', filters.type);
      if (filters?.entityType) params.append('entityType', filters.entityType);
      if (filters?.since) params.append('since', filters.since);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.offset) params.append('offset', filters.offset.toString());

      const response = await apiClient.get(`/notifications?${params.toString()}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching user notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(id: number): Promise<Notification> {
    try {
      const response = await apiClient.get(`/notifications/${id}`);
      return response.data.data.notification;
    } catch (error) {
      console.error('Error fetching notification:', error);
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(id: number): Promise<void> {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  /**
   * Mark all user notifications as read
   */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.patch('/notifications/mark-all-read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(id: number): Promise<void> {
    try {
      await apiClient.delete(`/notifications/${id}`);
    } catch (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<NotificationStats> {
    try {
      const response = await apiClient.get('/notifications/stats');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching notification stats:', error);
      throw error;
    }
  }

  /**
   * Create task assignment notification
   */
  async createTaskAssignedNotification(taskId: number, assigneeId: number): Promise<Notification> {
    try {
      const response = await apiClient.post('/notifications/task-assigned', {
        taskId,
        assigneeId
      });
      return response.data.data.notification;
    } catch (error) {
      console.error('Error creating task assigned notification:', error);
      throw error;
    }
  }

  /**
   * Create task update notification
   */
  async createTaskUpdatedNotification(taskId: number, changes: any): Promise<Notification> {
    try {
      const response = await apiClient.post('/notifications/task-updated', {
        taskId,
        changes
      });
      return response.data.data.notification;
    } catch (error) {
      console.error('Error creating task updated notification:', error);
      throw error;
    }
  }

  /**
   * Create task completion notification
   */
  async createTaskCompletedNotification(taskId: number): Promise<Notification> {
    try {
      const response = await apiClient.post('/notifications/task-completed', {
        taskId
      });
      return response.data.data.notification;
    } catch (error) {
      console.error('Error creating task completed notification:', error);
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get('/notifications/unread-count');
      return response.data.data.count;
    } catch (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(days: number = 30): Promise<{ deleted: number }> {
    try {
      const response = await apiClient.delete(`/notifications/cleanup?days=${days}`);
      return response.data.data;
    } catch (error) {
      console.error('Error cleaning up old notifications:', error);
      throw error;
    }
  }

  /**
   * Get notification preferences (if user has preferences)
   */
  async getNotificationPreferences(): Promise<any> {
    try {
      const response = await apiClient.get('/notifications/preferences');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      throw error;
    }
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(preferences: any): Promise<any> {
    try {
      const response = await apiClient.put('/notifications/preferences', preferences);
      return response.data.data;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw error;
    }
  }

  /**
   * Subscribe to real-time notifications (WebSocket helper)
   */
  subscribeToNotifications(callback: (notification: Notification) => void): () => void {
    // This would integrate with the real-time context
    // Implementation depends on WebSocket setup
    console.log('Subscribing to real-time notifications');
    
    // Listen for custom events from real-time context
    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent;
      callback(customEvent.detail);
    };

    window.addEventListener('notification', handleNotification);
    
    // Return cleanup function
    return () => {
      window.removeEventListener('notification', handleNotification);
    };
  }

  /**
   * Bulk operations
   */
  async bulkMarkAsRead(notificationIds: number[]): Promise<void> {
    try {
      await apiClient.patch('/notifications/bulk-read', {
        notificationIds
      });
    } catch (error) {
      console.error('Error bulk marking notifications as read:', error);
      throw error;
    }
  }

  async bulkDelete(notificationIds: number[]): Promise<void> {
    try {
      await apiClient.delete('/notifications/bulk-delete', {
        data: { notificationIds }
      });
    } catch (error) {
      console.error('Error bulk deleting notifications:', error);
      throw error;
    }
  }

  /**
   * Export notifications
   */
  async exportNotifications(format: 'json' | 'csv' = 'json', filters?: NotificationFilter): Promise<Blob> {
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      
      if (filters?.isRead !== undefined) params.append('isRead', filters.isRead.toString());
      if (filters?.type) params.append('type', filters.type);
      if (filters?.entityType) params.append('entityType', filters.entityType);
      if (filters?.since) params.append('since', filters.since);

      const response = await apiClient.get(`/notifications/export?${params.toString()}`, {
        responseType: 'blob'
      });
      
      return response.data;
    } catch (error) {
      console.error('Error exporting notifications:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();