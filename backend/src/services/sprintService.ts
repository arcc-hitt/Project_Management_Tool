import Sprint from '../models/Sprint.js';
import Issue from '../models/Issue.js';
import Project from '../models/Project.js';
import { notifyProjectMembers, notifySprintStarted, notifySprintClosed } from '../utils/notificationUtils.js';
import webhookService from './webhookService.js';
import auditLogService from './auditLogService.js';
import AuditLog from '../models/AuditLog.js';

const createError = (message: string, statusCode: number) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

class SprintService {
  /**
   * Create a new sprint for a project.
   * Validates startDate < endDate if both are provided.
   */
  async createSprint(projectId: string, data: any): Promise<Sprint> {
    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw createError('Invalid startDate or endDate', 400);
      }
      if (start >= end) {
        throw createError('startDate must be strictly before endDate', 400);
      }
    }

    const project = await Project.findById(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    return Sprint.create({
      projectId,
      organizationId: project.organizationId || null,
      name: data.name,
      goal: data.goal,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      state: 'created',
    });
  }

  /**
   * Start a sprint. Enforces single-active-sprint invariant (409 if one already active).
   * Sets startDate to now if not already set. Emits sprint_started notifications.
   */
  async startSprint(sprintId: string, userId: string, req?: any): Promise<Sprint> {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      throw createError('Sprint not found', 404);
    }

    if (sprint.state !== 'created') {
      throw createError(`Cannot start a sprint in '${sprint.state}' state`, 400);
    }

    // Enforce single active sprint per project
    const activeSprint = await Sprint.findActiveByProject(sprint.projectId);
    if (activeSprint) {
      throw createError('A sprint is already active in this project', 409);
    }

    const updateData: any = { state: 'active' };
    if (!sprint.startDate) {
      updateData.startDate = new Date();
    }

    const updated = await Sprint.update(sprintId, updateData);

    // Emit sprint_started notifications to all project members
    try {
      await notifySprintStarted(sprintId, sprint.projectId, sprint.name);
    } catch (notifErr) {
      console.error('Failed to send sprint_started notifications:', notifErr);
    }

    // Dispatch webhook event (Req 10.2)
    webhookService.dispatchEvent('sprint.started', sprint.projectId, { sprint: updated }).catch((err) => {
      console.error('webhook dispatch (sprint.started) error:', err);
    });

    // Audit log: sprint started (Req 11.1)
    auditLogService.log(
      userId,
      AuditLog.ACTIONS.SPRINT_STARTED,
      AuditLog.ENTITY_TYPES.SPRINT,
      sprintId,
      { state: 'created' },
      { state: 'active' },
      req
    ).catch((err) => console.error('auditLog error (sprint.started):', err));

    return updated;
  }

  /**
   * Close a sprint. Sets endDate if unset. Moves incomplete issues to backlog.
   * Records completedStoryPoints and completedIssueCount.
   */
  async closeSprint(sprintId: string, userId: string, req?: any): Promise<Sprint> {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      throw createError('Sprint not found', 404);
    }

    if (sprint.state !== 'active') {
      throw createError(`Cannot close a sprint in '${sprint.state}' state`, 400);
    }

    // Fetch all issues in this sprint
    const sprintIssues = await Issue.findAll({ sprintId });

    // Determine done-category states from project workflow
    let doneStates: Set<string> = new Set(['done']);
    try {
      const project = await Project.findById(sprint.projectId);
      if (project?.workflow?.states) {
        const doneStateNames = project.workflow.states
          .filter((s: any) => s.category === 'done')
          .map((s: any) => s.name);
        if (doneStateNames.length > 0) {
          doneStates = new Set(doneStateNames);
        }
      }
    } catch {
      // fallback: use 'done' as the only done state
    }

    const completedIssues = sprintIssues.filter((i) => doneStates.has(i.status));
    const incompleteIssues = sprintIssues.filter((i) => !doneStates.has(i.status));

    // Move incomplete issues to backlog (clear sprintId)
    await Promise.all(
      incompleteIssues.map((issue) => Issue.update(issue.id, { sprintId: null }))
    );

    // Compute stats
    const completedStoryPoints = completedIssues.reduce(
      (sum, i) => sum + (typeof i.storyPoints === 'number' ? i.storyPoints : 0),
      0
    );
    const completedIssueCount = completedIssues.length;

    const updateData: any = {
      state: 'closed',
      completedStoryPoints,
      completedIssueCount,
    };
    if (!sprint.endDate) {
      updateData.endDate = new Date();
    }

    const updated = await Sprint.update(sprintId, updateData);

    // Emit sprint_closed notifications
    try {
      await notifySprintClosed(sprintId, sprint.projectId, sprint.name, completedIssueCount);
    } catch (notifErr) {
      console.error('Failed to send sprint_closed notifications:', notifErr);
    }

    // Dispatch webhook event (Req 10.2)
    webhookService.dispatchEvent('sprint.closed', sprint.projectId, { sprint: updated }).catch((err) => {
      console.error('webhook dispatch (sprint.closed) error:', err);
    });

    // Audit log: sprint closed (Req 11.1)
    auditLogService.log(
      userId,
      AuditLog.ACTIONS.SPRINT_CLOSED,
      AuditLog.ENTITY_TYPES.SPRINT,
      sprintId,
      { state: 'active' },
      { state: 'closed', completedStoryPoints, completedIssueCount },
      req
    ).catch((err) => console.error('auditLog error (sprint.closed):', err));

    return updated;
  }

  /**
   * Get backlog issues for a project — issues with no sprintId, ordered by position.
   */
  async getBacklog(projectId: string): Promise<any[]> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const issues = await Issue.findAll({
      projectId,
      orderBy: 'position',
      orderDir: 'ASC',
    });

    return issues.filter((i) => !i.sprintId);
  }

  /**
   * Add an issue to a sprint by setting its sprintId.
   */
  async addIssueToSprint(sprintId: string, issueId: string): Promise<any> {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) {
      throw createError('Sprint not found', 404);
    }

    const issue = await Issue.findById(issueId);
    if (!issue) {
      throw createError('Issue not found', 404);
    }

    return Issue.update(issueId, { sprintId });
  }
}

export default new SprintService();
