export interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'developer';
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  managerId: number;
  manager?: User;
  createdAt: string;
  updatedAt: string;
  teamMembers?: User[];
  tasks?: Task[];
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: number;
  assigneeId?: number;
  assignee?: User;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  createdAt: string;
  updatedAt: string;
  project?: Project;
  comments?: Comment[];
  timeEntries?: TimeEntry[];
}

export interface Comment {
  id: number;
  content: string;
  taskId: number;
  userId: number;
  user?: User;
  createdAt: string;
  updatedAt: string;
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
  task?: Task;
  user?: User;
}

export interface Activity {
  id: number;
  action: string;
  entityType: 'user' | 'project' | 'task' | 'comment';
  entityId: number;
  userId: number;
  user?: User;
  details?: string;
  createdAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'manager' | 'developer';
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  startDate: string;
  endDate?: string;
  managerId: number;
  teamMemberIds?: number[];
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status?: 'planning' | 'in-progress' | 'completed' | 'on-hold';
  managerId?: number;
}

export interface CreateTaskRequest {
  title: string;
  description: string;
  projectId: number;
  assigneeId?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  estimatedHours?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: 'todo' | 'in-progress' | 'review' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: number;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  totalUsers: number;
  totalHoursLogged: number;
}

export interface SearchFilters {
  query?: string;
  type?: 'projects' | 'tasks' | 'users';
  status?: string;
  priority?: string;
  assigneeId?: number;
  projectId?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}