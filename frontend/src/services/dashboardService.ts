import { apiClient } from './api';

export interface DashboardStats {
  overview: {
    totalProjects: number;
    activeProjects: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    totalUsers: number;
    activeUsers: number;
  };
  productivity: {
    tasksCompletedToday: number;
    tasksCompletedThisWeek: number;
    tasksCompletedThisMonth: number;
    hoursLoggedToday: number;
    hoursLoggedThisWeek: number;
    hoursLoggedThisMonth: number;
    avgTasksPerDay: number;
    avgHoursPerDay: number;
  };
  projects: {
    byStatus: { [key: string]: number };
    byPriority: { [key: string]: number };
    recentlyCreated: any[];
    recentlyUpdated: any[];
    nearingDeadline: any[];
  };
  tasks: {
    byStatus: { [key: string]: number };
    byPriority: { [key: string]: number };
    assignedToMe: number;
    createdByMe: number;
    overdue: any[];
    dueToday: any[];
    dueSoon: any[];
  };
  timeline: {
    projectsCreated: { date: string; count: number }[];
    tasksCreated: { date: string; count: number }[];
    tasksCompleted: { date: string; count: number }[];
    hoursLogged: { date: string; hours: number }[];
  };
  team: {
    mostActiveUsers: any[];
    userWorkload: any[];
    teamProductivity: any[];
  };
}

export interface DashboardFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  projectIds?: number[];
  userIds?: number[];
  includeArchived?: boolean;
}

export const dashboardService = {
  async getDashboardStats(filters: DashboardFilters = {}): Promise<DashboardStats> {
    const response = await apiClient.get<DashboardStats>('/dashboard/stats', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch dashboard statistics');
    }
    
    return response.data;
  },

  async getOverviewStats(filters: DashboardFilters = {}): Promise<DashboardStats['overview']> {
    const response = await apiClient.get<DashboardStats['overview']>('/dashboard/overview', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch overview statistics');
    }
    
    return response.data;
  },

  async getProductivityStats(filters: DashboardFilters = {}): Promise<DashboardStats['productivity']> {
    const response = await apiClient.get<DashboardStats['productivity']>('/dashboard/productivity', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch productivity statistics');
    }
    
    return response.data;
  },

  async getProjectStats(filters: DashboardFilters = {}): Promise<DashboardStats['projects']> {
    const response = await apiClient.get<DashboardStats['projects']>('/dashboard/projects', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch project statistics');
    }
    
    return response.data;
  },

  async getTaskStats(filters: DashboardFilters = {}): Promise<DashboardStats['tasks']> {
    const response = await apiClient.get<DashboardStats['tasks']>('/dashboard/tasks', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch task statistics');
    }
    
    return response.data;
  },

  async getTimelineData(filters: DashboardFilters = {}): Promise<DashboardStats['timeline']> {
    const response = await apiClient.get<DashboardStats['timeline']>('/dashboard/timeline', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch timeline data');
    }
    
    return response.data;
  },

  async getTeamStats(filters: DashboardFilters = {}): Promise<DashboardStats['team']> {
    const response = await apiClient.get<DashboardStats['team']>('/dashboard/team', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch team statistics');
    }
    
    return response.data;
  },

  async getMyTasks(filters: any = {}): Promise<any[]> {
    const response = await apiClient.get<any[]>('/dashboard/my-tasks', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch my tasks');
    }
    
    return response.data;
  },

  async getMyProjects(filters: any = {}): Promise<any[]> {
    const response = await apiClient.get<any[]>('/dashboard/my-projects', { params: filters });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch my projects');
    }
    
    return response.data;
  },

  async getRecentActivity(limit: number = 20): Promise<any[]> {
    const response = await apiClient.get<any[]>('/dashboard/recent-activity', { params: { limit } });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch recent activity');
    }
    
    return response.data;
  },

  async getUpcomingDeadlines(days: number = 7): Promise<any[]> {
    const response = await apiClient.get<any[]>('/dashboard/upcoming-deadlines', { params: { days } });
    
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to fetch upcoming deadlines');
    }
    
    return response.data;
  }
};

export default dashboardService;