import { apiClient } from './api';
import type { Project, Task, User } from '../types';

export interface SearchFilters {
  query: string;
  types?: string[];
  projectIds?: number[];
  assigneeIds?: number[];
  status?: string[];
  priority?: string[];
  dateRange?: {
    start?: string;
    end?: string;
  };
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  type: 'project' | 'task' | 'user' | 'comment';
  id: number;
  title: string;
  description?: string;
  relevanceScore: number;
  highlight?: string;
  data: Project | Task | User | any;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  pagination: any;
  facets?: {
    types: { [key: string]: number };
    projects: { [key: string]: number };
    status: { [key: string]: number };
    priority: { [key: string]: number };
  };
}

export interface SearchSuggestion {
  text: string;
  type: 'project' | 'task' | 'user' | 'tag';
  count: number;
}

export const searchService = {
  async unifiedSearch(filters: SearchFilters): Promise<SearchResponse> {
    const response = await apiClient.get<SearchResponse>('/search', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Search failed');
    }
    
    return response.data;
  },

  async searchProjects(query: string, filters: Partial<SearchFilters> = {}): Promise<{ projects: Project[], total: number }> {
    const params = { ...filters, query, types: ['projects'] };
    const response = await apiClient.get<{ projects: Project[], total: number }>('/search/projects', { params });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Project search failed');
    }
    
    return response.data;
  },

  async searchTasks(query: string, filters: Partial<SearchFilters> = {}): Promise<{ tasks: Task[], total: number }> {
    const params = { ...filters, query, types: ['tasks'] };
    const response = await apiClient.get<{ tasks: Task[], total: number }>('/search/tasks', { params });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Task search failed');
    }
    
    return response.data;
  },

  async searchUsers(query: string, filters: Partial<SearchFilters> = {}): Promise<{ users: User[], total: number }> {
    const params = { ...filters, query, types: ['users'] };
    const response = await apiClient.get<{ users: User[], total: number }>('/search/users', { params });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'User search failed');
    }
    
    return response.data;
  },

  async searchComments(query: string, filters: Partial<SearchFilters> = {}): Promise<{ comments: any[], total: number }> {
    const params = { ...filters, query, types: ['comments'] };
    const response = await apiClient.get<{ comments: any[], total: number }>('/search/comments', { params });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Comment search failed');
    }
    
    return response.data;
  },

  async getSearchSuggestions(query: string, limit: number = 10): Promise<SearchSuggestion[]> {
    const response = await apiClient.get<SearchSuggestion[]>('/search/suggestions', { params: { query, limit } });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get search suggestions');
    }
    
    return response.data;
  },

  async advancedSearch(filters: SearchFilters): Promise<SearchResponse> {
    const response = await apiClient.post<SearchResponse>('/search/advanced', filters);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Advanced search failed');
    }
    
    return response.data;
  },

  async getSearchHistory(limit: number = 20): Promise<string[]> {
    const response = await apiClient.get<string[]>('/search/history', { params: { limit } });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get search history');
    }
    
    return response.data;
  },

  async saveSearch(query: string, filters: SearchFilters, name: string): Promise<any> {
    const response = await apiClient.post('/search/saved', { query, filters, name });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to save search');
    }
    
    return response.data;
  },

  async getSavedSearches(): Promise<any[]> {
    const response = await apiClient.get<any[]>('/search/saved');
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get saved searches');
    }
    
    return response.data;
  },

  async deleteSavedSearch(id: number): Promise<void> {
    const response = await apiClient.delete(`/search/saved/${id}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete saved search');
    }
  }
};

export default searchService;