import { apiClient } from './api';

export interface Attachment {
  _id: string;
  issueId: string;
  uploadedBy: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: string;
}

export interface Issue {
  _id: string;
  issueKey: string;
  issueType: 'task' | 'bug' | 'epic';
  title: string;
  description?: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  assignee?: { _id: string; firstName: string; lastName: string; email: string };
  createdBy: string;
  projectId: string;
  sprintId?: string;
  epicId?: string;
  childIssueIds?: string[];
  componentId?: string;
  versionId?: string;
  storyPoints?: number;
  bugSeverity?: 'critical' | 'high' | 'medium' | 'low';
  labels?: string[];
  position?: number;
  githubPrUrl?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  state: string;
  category: 'todo' | 'in_progress' | 'done';
  issues: Issue[];
}

export interface Sprint {
  _id: string;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  state: 'created' | 'active' | 'closed';
  projectId: string;
  completedStoryPoints?: number;
  completedIssueCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowState {
  name: string;
  category: 'todo' | 'in_progress' | 'done';
  transitions: string[];
}

export const issueService = {
  async getBoard(projectId: string): Promise<BoardColumn[]> {
    const response = await apiClient.get<BoardColumn[]>(`/projects/${projectId}/board`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch board');
    return response.data;
  },

  async getBacklog(projectId: string): Promise<Issue[]> {
    const response = await apiClient.get<Issue[]>(`/projects/${projectId}/backlog`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch backlog');
    return response.data;
  },

  async getIssue(id: string): Promise<Issue> {
    const response = await apiClient.get<Issue>(`/issues/${id}`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch issue');
    return response.data;
  },

  async createIssue(data: Partial<Issue>): Promise<Issue> {
    const response = await apiClient.post<Issue>('/issues', data);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to create issue');
    return response.data;
  },

  async updateIssue(id: string, data: Partial<Issue>): Promise<Issue> {
    const response = await apiClient.put<Issue>(`/issues/${id}`, data);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to update issue');
    return response.data;
  },

  async transitionIssue(id: string, targetState: string): Promise<Issue> {
    const response = await apiClient.post<Issue>(`/issues/${id}/transition`, { targetState });
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to transition issue');
    return response.data;
  },

  async reorderIssues(columnState: string, orderedIssueIds: string[]): Promise<void> {
    const response = await apiClient.put('/issues/reorder', { columnState, orderedIssueIds });
    if (!response.success) throw new Error(response.message || 'Failed to reorder issues');
  },

  async getComments(issueId: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/issues/${issueId}/comments`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch comments');
    return response.data;
  },

  async addComment(issueId: string, content: string): Promise<any> {
    const response = await apiClient.post(`/issues/${issueId}/comments`, { content });
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to add comment');
    return response.data;
  },

  // ── Attachments ─────────────────────────────────────────────────────────────

  async getAttachments(issueId: string): Promise<Attachment[]> {
    const response = await apiClient.get<Attachment[]>(`/issues/${issueId}/attachments`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch attachments');
    return response.data;
  },

  async uploadAttachment(issueId: string, file: File): Promise<Attachment> {
    const response = await apiClient.uploadFile<Attachment>(`/issues/${issueId}/attachments`, file);
    if (!response.success || !response.data) throw new Error(response.message || 'Upload failed');
    return response.data;
  },

  async deleteAttachment(issueId: string, attachmentId: string): Promise<void> {
    const response = await apiClient.delete(`/issues/${issueId}/attachments/${attachmentId}`);
    if (!response.success) throw new Error(response.message || 'Failed to delete attachment');
  },
};

export const sprintService = {
  async getSprints(projectId: string): Promise<Sprint[]> {
    const response = await apiClient.get<Sprint[]>(`/projects/${projectId}/sprints`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch sprints');
    return response.data;
  },

  async createSprint(projectId: string, data: { name: string; goal?: string; startDate?: string; endDate?: string }): Promise<Sprint> {
    const response = await apiClient.post<Sprint>(`/projects/${projectId}/sprints`, data);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to create sprint');
    return response.data;
  },

  async startSprint(sprintId: string): Promise<Sprint> {
    const response = await apiClient.post<Sprint>(`/sprints/${sprintId}/start`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to start sprint');
    return response.data;
  },

  async closeSprint(sprintId: string): Promise<Sprint> {
    const response = await apiClient.post<Sprint>(`/sprints/${sprintId}/close`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to close sprint');
    return response.data;
  },

  async addIssueToSprint(sprintId: string, issueId: string): Promise<void> {
    const response = await apiClient.post(`/sprints/${sprintId}/issues`, { issueId });
    if (!response.success) throw new Error(response.message || 'Failed to add issue to sprint');
  },
};

// ─── Report types ────────────────────────────────────────────────────────────

export interface BurndownDataPoint {
  date: string;
  remainingStoryPoints: number;
  remainingIssueCount: number;
}

export interface BurndownReport {
  sprintId: string;
  sprintName: string;
  startDate: string;
  endDate: string;
  state: string;
  dataPoints: BurndownDataPoint[];
}

export interface VelocityDataPoint {
  sprintId: string;
  sprintName: string;
  startDate: string | null;
  endDate: string | null;
  completedStoryPoints: number;
  completedIssueCount: number;
}

export interface VelocityReport {
  projectId: string;
  velocityData: VelocityDataPoint[];
}

export interface IssueStatsReport {
  projectId: string;
  total: number;
  byIssueType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  byAssigneeId: Record<string, number>;
}

export const reportService = {
  async getBurndown(projectId: string, sprintId: string): Promise<BurndownReport> {
    const response = await apiClient.get<BurndownReport>(
      `/projects/${projectId}/reports/burndown?sprintId=${sprintId}`
    );
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch burndown');
    return response.data;
  },

  async getVelocity(projectId: string): Promise<VelocityReport> {
    const response = await apiClient.get<VelocityReport>(`/projects/${projectId}/reports/velocity`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch velocity');
    return response.data;
  },

  async getIssueStats(projectId: string): Promise<IssueStatsReport> {
    const response = await apiClient.get<IssueStatsReport>(`/projects/${projectId}/reports/issue-stats`);
    if (!response.success || !response.data) throw new Error(response.message || 'Failed to fetch issue stats');
    return response.data;
  },
};
