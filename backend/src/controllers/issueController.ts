import Issue from '../models/Issue.js';
import Project from '../models/Project.js';
import boardService from '../services/boardService.js';
import webhookService from '../services/webhookService.js';
import { formatApiResponse, formatErrorResponse, getPaginationData } from '../utils/helpers.js';
import { notifyIssueAssigned } from '../utils/notificationUtils.js';

class IssueController {
  async listIssues(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 100);
      const offset = (page - 1) * limit;

      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.priority) filters.priority = req.query.priority;
      if (req.query.projectId) filters.projectId = req.query.projectId;
      if (req.query.assignedTo) filters.assignedTo = req.query.assignedTo;
      if (req.query.issueType) filters.issueType = req.query.issueType;
      if (req.query.sprintId) filters.sprintId = req.query.sprintId;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.overdue) filters.overdue = req.query.overdue === 'true';

      const [issues, total] = await Promise.all([
        Issue.findAll({ ...filters, limit, offset }),
        Issue.count(filters),
      ]);

      const pagination = getPaginationData(total, page, limit);
      return res.status(200).json(formatApiResponse({ issues, pagination }, 'Issues retrieved successfully'));
    } catch (error) {
      console.error('listIssues error:', error);
      return res.status(error.statusCode || 500).json(formatErrorResponse('Failed to retrieve issues', error.message));
    }
  }

  async createIssue(req, res) {
    try {
      const data = { ...req.body, createdBy: req.body.createdBy || req.user?.id };
      const errors = Issue.validateCreate(data);
      if (errors.length > 0) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors));
      }

      const { projectId } = data;
      const counter = await Project.incrementIssueCounter(projectId);
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json(formatErrorResponse('Project not found'));
      }

      const issueKey = `${project.projectKey || 'ISSUE'}-${counter}`;
      const issue = await Issue.create({ ...data, issueKey });
      // Notify assignee if set at creation (Req 4.1)
      if (issue.assignedTo && issue.assignedTo !== issue.createdBy) {
        notifyIssueAssigned(issue.id, issue.assignedTo, issue.createdBy).catch((err) => {
          console.error('notifyIssueAssigned (create) error:', err);
        });
      }
      // Dispatch webhook event (Req 10.2)
      webhookService.dispatchEvent('issue.created', issue.projectId, { issue }).catch((err) => {
        console.error('webhook dispatch (issue.created) error:', err);
      });
      return res.status(201).json(formatApiResponse(issue, 'Issue created successfully'));
    } catch (error) {
      console.error('createIssue error:', error);
      return res.status(error.statusCode || 500).json(formatErrorResponse('Failed to create issue', error.message));
    }
  }

  async getIssue(req, res) {
    try {
      const issue = await Issue.findById(req.params.id);
      if (!issue) {
        return res.status(404).json(formatErrorResponse('Issue not found'));
      }
      return res.status(200).json(formatApiResponse(issue, 'Issue retrieved successfully'));
    } catch (error) {
      console.error('getIssue error:', error);
      return res.status(error.statusCode || 500).json(formatErrorResponse('Failed to retrieve issue', error.message));
    }
  }

  async updateIssue(req, res) {
    try {
      const errors = Issue.validateUpdate(req.body);
      if (errors.length > 0) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors));
      }

      // Capture previous assignee before update
      const existingIssue = await Issue.findById(req.params.id);
      if (!existingIssue) {
        return res.status(404).json(formatErrorResponse('Issue not found'));
      }

      const issue = await Issue.update(req.params.id, req.body);
      if (!issue) {
        return res.status(404).json(formatErrorResponse('Issue not found'));
      }

      // Notify new assignee if assignee changed (Req 4.1)
      const newAssignee = req.body.assignedTo || req.body.assigned_to;
      if (newAssignee && newAssignee !== existingIssue.assignedTo) {
        const actorId = req.user?.id;
        notifyIssueAssigned(req.params.id, newAssignee, actorId).catch((err) => {
          console.error('notifyIssueAssigned error:', err);
        });
      }

      // Dispatch webhook event (Req 10.2)
      webhookService.dispatchEvent('issue.updated', issue.projectId, { issue }).catch((err) => {
        console.error('webhook dispatch (issue.updated) error:', err);
      });

      return res.status(200).json(formatApiResponse(issue, 'Issue updated successfully'));
    } catch (error) {
      console.error('updateIssue error:', error);
      return res.status(error.statusCode || 500).json(formatErrorResponse('Failed to update issue', error.message));
    }
  }

  async deleteIssue(req, res) {
    try {
      const existing = await Issue.findById(req.params.id);
      const deleted = await Issue.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json(formatErrorResponse('Issue not found'));
      }
      // Dispatch webhook event (Req 10.2)
      if (existing) {
        webhookService.dispatchEvent('issue.deleted', existing.projectId, { issueId: req.params.id }).catch((err) => {
          console.error('webhook dispatch (issue.deleted) error:', err);
        });
      }
      return res.status(200).json(formatApiResponse(null, 'Issue deleted successfully'));
    } catch (error) {
      console.error('deleteIssue error:', error);
      return res.status(error.statusCode || 500).json(formatErrorResponse('Failed to delete issue', error.message));
    }
  }

  async transitionIssue(req, res) {
    try {
      const { targetState } = req.body;
      const userId = req.user?.id;
      const issue = await boardService.transitionIssue(req.params.id, targetState, userId);
      // Dispatch webhook event (Req 10.2)
      webhookService.dispatchEvent('issue.transitioned', issue.projectId, { issue, targetState }).catch((err) => {
        console.error('webhook dispatch (issue.transitioned) error:', err);
      });
      return res.status(200).json(formatApiResponse(issue, 'Issue transitioned successfully'));
    } catch (error) {
      console.error('transitionIssue error:', error);
      const status = error.statusCode === 403 || error.statusCode === 404 || error.statusCode === 422
        ? error.statusCode
        : error.statusCode || 500;
      return res.status(status).json(formatErrorResponse(error.message));
    }
  }

  async reorderIssues(req, res) {
    try {
      const { columnState, orderedIssueIds } = req.body;
      await boardService.reorderIssues(columnState, orderedIssueIds);
      return res.status(200).json(formatApiResponse(null, 'Issues reordered successfully'));
    } catch (error) {
      console.error('reorderIssues error:', error);
      return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
    }
  }
}

export default new IssueController();
