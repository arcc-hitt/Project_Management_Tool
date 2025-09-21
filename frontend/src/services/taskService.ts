import { apiClient } from './api';
import type { Task } from '../types';

export interface CreateTaskRequest {
  title: string;
  description?: string;
  projectId: number;
  assigneeId?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status?: 'todo' | 'in_progress' | 'in_review' | 'done';
  dueDate?: string;
  estimatedHours?: number;
  tags?: string[];
  dependencies?: number[];
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  actualHours?: number;
}

export interface TaskFilters {
  projectId?: number;
  assigneeId?: number;
  createdBy?: number;
  status?: string;
  priority?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dueDate?: string;
  overdue?: boolean;
  tags?: string[];
}

export interface TaskComment {
  id: number;
  content: string;
  userId: number;
  taskId: number;
  createdAt: string;
  updatedAt: string;
  user?: any;
}

export interface TimeEntry {
  id: number;
  taskId: number;
  userId: number;
  hours: number;
  description?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
}

export const taskService = {
  async getTasks(filters: TaskFilters = {}): Promise<{ tasks: Task[], total: number, pagination: any }> {
    const response = await apiClient.get<{ tasks: Task[], total: number, pagination: any }>('/tasks', { params: filters });
    
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

  async unassignTask(id: number): Promise<Task> {
    const response = await apiClient.put<Task>(`/tasks/${id}/unassign`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to unassign task');
    }
    
    return response.data;
  },

  async updateTaskStatus(id: number, status: 'todo' | 'in_progress' | 'in_review' | 'done'): Promise<Task> {
    const response = await apiClient.put<Task>(`/tasks/${id}/status`, { status });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update task status');
    }
    
    return response.data;
  },

  async updateTaskPriority(id: number, priority: 'low' | 'medium' | 'high' | 'critical'): Promise<Task> {
    const response = await apiClient.put<Task>(`/tasks/${id}/priority`, { priority });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update task priority');
    }
    
    return response.data;
  },

  async duplicateTask(id: number, projectId?: number): Promise<Task> {
    const response = await apiClient.post<Task>(`/tasks/${id}/duplicate`, { projectId });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to duplicate task');
    }
    
    return response.data;
  },

  // Comments
  async getTaskComments(id: number): Promise<TaskComment[]> {
    const response = await apiClient.get<TaskComment[]>(`/tasks/${id}/comments`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch task comments');
    }
    
    return response.data;
  },

  async addTaskComment(id: number, content: string): Promise<TaskComment> {
    const response = await apiClient.post<TaskComment>(`/tasks/${id}/comments`, { content });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to add comment');
    }
    
    return response.data;
  },

  async updateTaskComment(taskId: number, commentId: number, content: string): Promise<TaskComment> {
    const response = await apiClient.put<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { content });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update comment');
    }
    
    return response.data;
  },

  async deleteTaskComment(taskId: number, commentId: number): Promise<void> {
    const response = await apiClient.delete(`/tasks/${taskId}/comments/${commentId}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete comment');
    }
  },

  // Time tracking
  async getTaskTimeEntries(id: number): Promise<TimeEntry[]> {
    const response = await apiClient.get<TimeEntry[]>(`/tasks/${id}/time-entries`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch time entries');
    }
    
    return response.data;
  },

  async addTimeEntry(taskId: number, hours: number, description?: string, date?: string): Promise<TimeEntry> {
    const response = await apiClient.post<TimeEntry>(`/tasks/${taskId}/time-entries`, {
      hours,
      description,
      date: date || new Date().toISOString().split('T')[0]
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to add time entry');
    }
    
    return response.data;
  },

  async updateTimeEntry(taskId: number, entryId: number, data: Partial<TimeEntry>): Promise<TimeEntry> {
    const response = await apiClient.put<TimeEntry>(`/tasks/${taskId}/time-entries/${entryId}`, data);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update time entry');
    }
    
    return response.data;
  },

  async deleteTimeEntry(taskId: number, entryId: number): Promise<void> {
    const response = await apiClient.delete(`/tasks/${taskId}/time-entries/${entryId}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete time entry');
    }
  },

  // Dependencies
  async getTaskDependencies(id: number): Promise<Task[]> {
    const response = await apiClient.get<Task[]>(`/tasks/${id}/dependencies`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch task dependencies');
    }
    
    return response.data;
  },

  async addTaskDependency(id: number, dependencyId: number): Promise<void> {
    const response = await apiClient.post(`/tasks/${id}/dependencies`, { dependencyId });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to add task dependency');
    }
  },

  async removeTaskDependency(id: number, dependencyId: number): Promise<void> {
    const response = await apiClient.delete(`/tasks/${id}/dependencies/${dependencyId}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to remove task dependency');
    }
  },

  // Bulk operations
  async bulkUpdateTasks(taskIds: number[], updates: Partial<UpdateTaskRequest>): Promise<Task[]> {
    const response = await apiClient.put<Task[]>('/tasks/bulk', { taskIds, updates });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to bulk update tasks');
    }
    
    return response.data;
  },

  async bulkDeleteTasks(taskIds: number[]): Promise<void> {
    const response = await apiClient.delete('/tasks/bulk', { data: { taskIds } });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to bulk delete tasks');
    }
  }
};