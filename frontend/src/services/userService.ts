import { apiClient } from './api';
import type { User } from '../types';

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'developer' | 'tester' | 'designer';
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: 'admin' | 'manager' | 'developer' | 'tester' | 'designer';
}

export interface UserFilters {
  role?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UserStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  totalHours: number;
  avgTasksPerDay: number;
}

export const userService = {
  async getUsers(filters: UserFilters = {}): Promise<{ users: User[], total: number, pagination: any }> {
    const response = await apiClient.get<{ users: User[], total: number, pagination: any }>('/users', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch users');
    }
    
    return response.data;
  },

  async getUserById(id: number): Promise<User> {
    const response = await apiClient.get<User>(`/users/${id}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch user');
    }
    
    return response.data;
  },

  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await apiClient.post<User>('/users', userData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create user');
    }
    
    return response.data;
  },

  async updateUser(id: number, userData: UpdateUserRequest): Promise<User> {
    const response = await apiClient.put<User>(`/users/${id}`, userData);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update user');
    }
    
    return response.data;
  },

  async deleteUser(id: number): Promise<void> {
    const response = await apiClient.delete(`/users/${id}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete user');
    }
  },

  async reactivateUser(id: number): Promise<User> {
    const response = await apiClient.put<User>(`/users/${id}/reactivate`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to reactivate user');
    }
    
    return response.data;
  },

  async updateUserRole(id: number, role: string): Promise<User> {
    const response = await apiClient.put<User>(`/users/${id}/role`, { role });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update user role');
    }
    
    return response.data;
  },

  async getUserStats(id: number): Promise<UserStats> {
    const response = await apiClient.get<UserStats>(`/users/${id}/stats`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch user statistics');
    }
    
    return response.data;
  },

  async searchUsers(query: string, filters: Partial<UserFilters> = {}): Promise<User[]> {
    const params = { ...filters, search: query };
    const response = await apiClient.get<{ users: User[] }>('/users', { params });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to search users');
    }
    
    return response.data.users;
  }
};

export default userService;