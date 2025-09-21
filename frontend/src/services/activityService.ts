import { apiClient } from './api';

export interface Activity {
  id: number;
  action: string;
  entityType: 'project' | 'task' | 'user' | 'comment' | 'file' | 'time_entry';
  entityId: number;
  userId: number;
  details: any;
  createdAt: string;
  user?: any;
  entityData?: any;
}

export interface ActivityFilters {
  entityType?: string;
  entityId?: number;
  userId?: number;
  action?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const activityService = {
  async getActivities(filters: ActivityFilters = {}): Promise<{ activities: Activity[], total: number, pagination: any }> {
    const response = await apiClient.get<{ activities: Activity[], total: number, pagination: any }>('/activities', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch activities');
    }
    
    return response.data;
  },

  async getActivityById(id: number): Promise<Activity> {
    const response = await apiClient.get<Activity>(`/activities/${id}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch activity');
    }
    
    return response.data;
  },

  async getEntityActivities(entityType: string, entityId: number, filters: ActivityFilters = {}): Promise<{ activities: Activity[], total: number }> {
    const response = await apiClient.get<{ activities: Activity[], total: number }>(`/activities/entity/${entityType}/${entityId}`, { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch entity activities');
    }
    
    return response.data;
  },

  async getUserActivities(userId: number, filters: ActivityFilters = {}): Promise<{ activities: Activity[], total: number }> {
    const response = await apiClient.get<{ activities: Activity[], total: number }>(`/activities/user/${userId}`, { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch user activities');
    }
    
    return response.data;
  },

  async getProjectActivities(projectId: number, filters: ActivityFilters = {}): Promise<Activity[]> {
    const result = await this.getEntityActivities('project', projectId, filters);
    return result.activities;
  },

  async getTaskActivities(taskId: number, filters: ActivityFilters = {}): Promise<Activity[]> {
    const result = await this.getEntityActivities('task', taskId, filters);
    return result.activities;
  }
};

export default activityService;