import { apiClient } from './api';
import type { Project, Task, User } from '../types';

export interface CreateProjectRequest {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  teamMembers?: number[];
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  status?: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
}

export interface ProjectFilters {
  status?: string;
  priority?: string;
  managerId?: number;
  createdBy?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  startDate?: string;
  endDate?: string;
}

export interface ProjectMember {
  userId: number;
  role: 'manager' | 'developer' | 'tester' | 'designer';
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalHours: number;
  completionPercentage: number;
}

export const projectService = {
  async getProjects(filters: ProjectFilters = {}): Promise<{ projects: Project[], total: number, pagination: any }> {
    const response = await apiClient.get<{ projects: Project[], total: number, pagination: any }>('/projects', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch projects');
    }
    
    return response.data;
  },

  async getProject(id: number): Promise<Project> {
    const response = await apiClient.get<Project>(`/projects/${id}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project');
    }
    
    return response.data;
  },

  async createProject(projectData: CreateProjectRequest): Promise<Project> {
    const response = await apiClient.post<Project>('/projects', projectData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create project');
    }
    
    return response.data;
  },

  async updateProject(id: number, projectData: UpdateProjectRequest): Promise<Project> {
    const response = await apiClient.put<Project>(`/projects/${id}`, projectData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update project');
    }
    
    return response.data;
  },

  async deleteProject(id: number): Promise<void> {
    const response = await apiClient.delete(`/projects/${id}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete project');
    }
  },

  async getProjectMembers(id: number): Promise<User[]> {
    const response = await apiClient.get<User[]>(`/projects/${id}/members`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project members');
    }
    
    return response.data;
  },

  async addProjectMember(projectId: number, userId: number, role: string = 'developer'): Promise<void> {
    const response = await apiClient.post(`/projects/${projectId}/members`, { userId, role });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to add project member');
    }
  },

  async removeProjectMember(projectId: number, userId: number): Promise<void> {
    const response = await apiClient.delete(`/projects/${projectId}/members/${userId}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to remove project member');
    }
  },

  async updateMemberRole(projectId: number, userId: number, role: string): Promise<void> {
    const response = await apiClient.put(`/projects/${projectId}/members/${userId}/role`, { role });
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to update member role');
    }
  },

  async getProjectTasks(id: number, filters: any = {}): Promise<Task[]> {
    const response = await apiClient.get<Task[]>(`/projects/${id}/tasks`, { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project tasks');
    }
    
    return response.data;
  },

  async getProjectStats(id: number): Promise<ProjectStats> {
    const response = await apiClient.get<ProjectStats>(`/projects/${id}/stats`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project statistics');
    }
    
    return response.data;
  },

  async duplicateProject(id: number, name?: string): Promise<Project> {
    const response = await apiClient.post<Project>(`/projects/${id}/duplicate`, { name });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to duplicate project');
    }
    
    return response.data;
  },

  async archiveProject(id: number): Promise<void> {
    const response = await apiClient.put(`/projects/${id}/archive`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to archive project');
    }
  },

  async unarchiveProject(id: number): Promise<void> {
    const response = await apiClient.put(`/projects/${id}/unarchive`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to unarchive project');
    }
  },

  async getProjectTimeline(id: number): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/projects/${id}/timeline`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project timeline');
    }
    
    return response.data;
  },

  async getProjectActivities(id: number, filters: any = {}): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/projects/${id}/activities`, { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project activities');
    }
    
    return response.data;
  }
};