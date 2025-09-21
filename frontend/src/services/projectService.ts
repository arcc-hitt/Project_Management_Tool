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
  search?: string;
  page?: number;
  limit?: number;
}

export const projectService = {
  async getProjects(filters: ProjectFilters = {}): Promise<{ projects: Project[], total: number }> {
    const response = await apiClient.get<{ projects: Project[], total: number }>('/projects', { params: filters });
    
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

  async addProjectMember(projectId: number, userId: number): Promise<void> {
    const response = await apiClient.post(`/projects/${projectId}/members`, { userId });
    
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

  async getProjectTasks(id: number): Promise<Task[]> {
    const response = await apiClient.get<Task[]>(`/projects/${id}/tasks`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project tasks');
    }
    
    return response.data;
  }
};