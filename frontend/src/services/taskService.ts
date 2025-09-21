import { apiClient } from './api';
import type { Task } from '../types';

export interface CreateTaskRequest {
  title: string;
  description?: string;
  projectId: number;
  assigneeId?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate?: string;
  estimatedHours?: number;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  status?: 'todo' | 'in_progress' | 'review' | 'done';
  actualHours?: number;
}

export interface TaskFilters {
  projectId?: number;
  assigneeId?: number;
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const taskService = {
  async getTasks(filters: TaskFilters = {}): Promise<{ tasks: Task[], total: number }> {
    const response = await apiClient.get<{ tasks: Task[], total: number }>('/tasks', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch tasks');
    }
    
    return response.data;
  },

  async getTask(id: number): Promise<Task> {
    const response = await apiClient.get<Task>(`/tasks/${id}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch task');
    }
    
    return response.data;
  },

  async createTask(taskData: CreateTaskRequest): Promise<Task> {
    const response = await apiClient.post<Task>('/tasks', taskData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create task');
    }
    
    return response.data;
  },

  async updateTask(id: number, taskData: UpdateTaskRequest): Promise<Task> {
    const response = await apiClient.put<Task>(`/tasks/${id}`, taskData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update task');
    }
    
    return response.data;
  },

  async deleteTask(id: number): Promise<void> {
    const response = await apiClient.delete(`/tasks/${id}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete task');
    }
  },

  async assignTask(id: number, assigneeId: number): Promise<Task> {
    const response = await apiClient.put<Task>(`/tasks/${id}/assign`, { assigneeId });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to assign task');
    }
    
    return response.data;
  },

  async updateTaskStatus(id: number, status: 'todo' | 'in_progress' | 'review' | 'done'): Promise<Task> {
    const response = await apiClient.put<Task>(`/tasks/${id}/status`, { status });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update task status');
    }
    
    return response.data;
  },

  async getTaskComments(id: number): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/tasks/${id}/comments`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch task comments');
    }
    
    return response.data;
  },

  async addTaskComment(id: number, content: string): Promise<any> {
    const response = await apiClient.post<any>(`/tasks/${id}/comments`, { content });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to add comment');
    }
    
    return response.data;
  }
};