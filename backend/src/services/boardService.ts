import Issue from '../models/Issue.js';
import Project from '../models/Project.js';
import database from '../config/database.js';
import workflowService from './workflowService.js';
import { toObjectId } from '../utils/mongo.js';

const createError = (message: string, statusCode: number) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

interface BoardColumn {
  state: string;
  category: 'todo' | 'in_progress' | 'done';
  issues: any[];
}

class BoardService {
  /**
   * Get board columns for a project, optionally filtered by sprint.
   * Groups issues by workflow state and returns columns in workflow order.
   * Requirements: 2.1, 2.7
   */
  async getBoardColumns(projectId: string, sprintId?: string): Promise<BoardColumn[]> {
    const project = await Project.findById(projectId);
    if (!project) {
      throw createError('Project not found', 404);
    }

    const workflow = await workflowService.getWorkflow(projectId);

    const queryOptions: any = { projectId, orderBy: 'position', orderDir: 'ASC' };
    if (sprintId) {
      queryOptions.sprintId = sprintId;
    }

    const issues = await Issue.findAll(queryOptions);

    // Group issues by status, preserving workflow state order
    const columns: BoardColumn[] = workflow.states.map((state) => ({
      state: state.name,
      category: state.category,
      issues: issues
        .filter((issue) => issue.status === state.name)
        .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity)),
    }));

    return columns;
  }

  /**
   * Reorder issues within a column state.
   * Validates the set of IDs is unchanged, then assigns sequential positions.
   * Requirements: 2.3, 2.4, 2.5, 2.9
   */
  async reorderIssues(columnState: string, orderedIssueIds: string[]): Promise<void> {
    if (!Array.isArray(orderedIssueIds) || orderedIssueIds.length === 0) {
      throw createError('orderedIssueIds must be a non-empty array', 400);
    }

    // Fetch current issues in this column state to validate set invariant
    const issues = await database.getCollection('issues');
    const currentDocs = await issues
      .find({ status: columnState })
      .project({ _id: 1 })
      .toArray();

    const currentIds = new Set(currentDocs.map((d) => d._id.toHexString()));
    const incomingIds = new Set(orderedIssueIds);

    // Validate set invariant: same IDs, no additions or removals (Req 2.4, 2.9)
    if (currentIds.size !== incomingIds.size) {
      throw createError(
        'Reorder set invariant violated: incoming IDs count does not match current column issues',
        400
      );
    }
    for (const id of incomingIds) {
      if (!currentIds.has(id)) {
        throw createError(
          `Reorder set invariant violated: issue ${id} is not in column "${columnState}"`,
          400
        );
      }
    }

    // Bulk-update positions with sequential values starting at 0 (Req 2.5)
    const bulkOps = orderedIssueIds.map((id, index) => ({
      updateOne: {
        filter: { _id: toObjectId(id) },
        update: { $set: { position: index, updatedAt: new Date() } },
      },
    }));

    await issues.bulkWrite(bulkOps);
  }

  /**
   * Transition an issue to a new workflow state.
   * Validates the transition via WorkflowService, updates status, and fires webhook event.
   * Requirements: 2.2, 2.8, 6.3, 6.4
   */
  async transitionIssue(issueId: string, targetState: string, userId: string): Promise<any> {
    const issue = await Issue.findById(issueId);
    if (!issue) {
      throw createError('Issue not found', 404);
    }

    // Check project membership (Req 2.8)
    const isMember = await Project.isMember(issue.projectId, userId);
    if (!isMember) {
      throw createError('Access denied: you are not a member of this project', 403);
    }

    // Validate transition via WorkflowService (Req 6.3, 6.4)
    await workflowService.validateTransition(issue.projectId, issue.status, targetState);

    // Update issue status
    const updated = await Issue.update(issueId, { status: targetState });

    // Fire webhook event asynchronously — import lazily to avoid circular deps
    this._dispatchWebhookEvent('issue.transitioned', issue.projectId, {
      issueId,
      fromState: issue.status,
      toState: targetState,
      transitionedBy: userId,
    }).catch((err) => {
      console.error('[BoardService] webhook dispatch failed:', err.message);
    });

    return updated;
  }

  /**
   * Dispatch a webhook event for the given project.
   * Lazy-imports webhookService to avoid circular dependency issues.
   */
  private async _dispatchWebhookEvent(
    event: string,
    projectId: string,
    payload: Record<string, any>
  ): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency at module load time
      const { default: webhookService } = await import('./webhookService.ts').catch(() => ({ default: null }));
      if (webhookService) {
        await webhookService.dispatchEvent(event, projectId, payload);
      }
    } catch {
      // Webhook dispatch is best-effort; errors are logged by the caller
    }
  }
}

export default new BoardService();
