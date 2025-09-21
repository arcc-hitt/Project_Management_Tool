import { apiClient } from './api';

export interface TimeEntry {
  id: number;
  taskId: number;
  projectId?: number;
  userId: number;
  hours: number;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  billable?: boolean;
  createdAt: string;
  updatedAt: string;
  task?: any;
  project?: any;
  user?: any;
}

export interface CreateTimeEntryRequest {
  taskId?: number;
  projectId?: number;
  hours: number;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  billable?: boolean;
}

export interface UpdateTimeEntryRequest extends Partial<CreateTimeEntryRequest> {
  id: number;
}

export interface TimeEntryFilters {
  userId?: number;
  taskId?: number;
  projectId?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  billable?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface TimeReport {
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  entriesCount: number;
  byDate: { [date: string]: number };
  byProject: { [projectName: string]: number };
  byTask: { [taskTitle: string]: number };
  byUser: { [userName: string]: number };
}

export const timeTrackingService = {
  async getTimeEntries(filters: TimeEntryFilters = {}): Promise<{ timeEntries: TimeEntry[], total: number, pagination: any }> {
    const response = await apiClient.get<{ timeEntries: TimeEntry[], total: number, pagination: any }>('/time-entries', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch time entries');
    }
    
    return response.data;
  },

  async getTimeEntry(id: number): Promise<TimeEntry> {
    const response = await apiClient.get<TimeEntry>(`/time-entries/${id}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch time entry');
    }
    
    return response.data;
  },

  async createTimeEntry(data: CreateTimeEntryRequest): Promise<TimeEntry> {
    const response = await apiClient.post<TimeEntry>('/time-entries', data);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create time entry');
    }
    
    return response.data;
  },

  async updateTimeEntry(id: number, data: Partial<CreateTimeEntryRequest>): Promise<TimeEntry> {
    const response = await apiClient.put<TimeEntry>(`/time-entries/${id}`, data);
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update time entry');
    }
    
    return response.data;
  },

  async deleteTimeEntry(id: number): Promise<void> {
    const response = await apiClient.delete(`/time-entries/${id}`);
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete time entry');
    }
  },

  async bulkCreateTimeEntries(entries: CreateTimeEntryRequest[]): Promise<TimeEntry[]> {
    const response = await apiClient.post<TimeEntry[]>('/time-entries/bulk', { entries });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create time entries');
    }
    
    return response.data;
  },

  async getMyTimeEntries(filters: TimeEntryFilters = {}): Promise<{ timeEntries: TimeEntry[], total: number }> {
    const response = await apiClient.get<{ timeEntries: TimeEntry[], total: number }>('/time-entries/me', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch my time entries');
    }
    
    return response.data;
  },

  async getTaskTimeEntries(taskId: number, filters: TimeEntryFilters = {}): Promise<TimeEntry[]> {
    const response = await apiClient.get<TimeEntry[]>(`/tasks/${taskId}/time-entries`, { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch task time entries');
    }
    
    return response.data;
  },

  async getProjectTimeEntries(projectId: number, filters: TimeEntryFilters = {}): Promise<TimeEntry[]> {
    const response = await apiClient.get<TimeEntry[]>(`/projects/${projectId}/time-entries`, { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project time entries');
    }
    
    return response.data;
  },

  async getUserTimeEntries(userId: number, filters: TimeEntryFilters = {}): Promise<TimeEntry[]> {
    const response = await apiClient.get<TimeEntry[]>(`/users/${userId}/time-entries`, { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch user time entries');
    }
    
    return response.data;
  },

  async generateTimeReport(filters: TimeEntryFilters): Promise<TimeReport> {
    const response = await apiClient.get<TimeReport>('/time-entries/report', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to generate time report');
    }
    
    return response.data;
  },

  async exportTimeEntries(filters: TimeEntryFilters, format: 'csv' | 'pdf' | 'xlsx' = 'csv'): Promise<Blob> {
    const response = await apiClient.get(`/time-entries/export`, { 
      params: { ...filters, format },
      responseType: 'blob'
    });
    
    if (!response.success) {
      throw new Error('Failed to export time entries');
    }
    
    return response.data as Blob;
  },

  // Timer functionality
  async startTimer(taskId?: number, projectId?: number, description?: string): Promise<any> {
    const response = await apiClient.post('/time-entries/timer/start', { taskId, projectId, description });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to start timer');
    }
    
    return response.data;
  },

  async stopTimer(): Promise<TimeEntry> {
    const response = await apiClient.post<TimeEntry>('/time-entries/timer/stop');
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to stop timer');
    }
    
    return response.data;
  },

  async getActiveTimer(): Promise<any | null> {
    const response = await apiClient.get('/time-entries/timer/active');
    
    if (!response.success) {
      return null;
    }
    
    return response.data;
  },

  async pauseTimer(): Promise<void> {
    const response = await apiClient.post('/time-entries/timer/pause');
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to pause timer');
    }
  },

  async resumeTimer(): Promise<void> {
    const response = await apiClient.post('/time-entries/timer/resume');
    
    if (!response.success) {
      throw new Error(response.message || 'Failed to resume timer');
    }
  }
};

export default timeTrackingService;