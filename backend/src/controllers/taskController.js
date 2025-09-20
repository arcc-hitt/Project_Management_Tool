import taskService from '../services/taskService.js';
import { validationResult } from 'express-validator';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

class TaskController {
  /**
   * Get all tasks with filtering and pagination
   */
  async getAllTasks(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
        status: req.query.status,
        priority: req.query.priority,
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null,
        assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo) : null,
        search: req.query.search,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        overdue: req.query.overdue
      };

      // Validate pagination limits
      if (options.limit > 100) {
        options.limit = 100;
      }

      const result = await taskService.getAllTasks(options, user.id, user.role);

      res.status(200).json(formatApiResponse(result, 'Tasks retrieved successfully'));

    } catch (error) {
      console.error('Get all tasks error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve tasks', error.message));
    }
  }

  /**
   * Get task by ID
   */
  async getTaskById(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;

      const task = await taskService.getTaskById(parseInt(id), user.id, user.role);

      if (!task) {
        return res.status(404).json(formatErrorResponse('Task not found'));
      }

      res.status(200).json(formatApiResponse(task, 'Task retrieved successfully'));

    } catch (error) {
      console.error('Get task by ID error:', error);
      if (error.message === 'Access denied to this task') {
        return res.status(403).json(formatErrorResponse('Access denied to this task'));
      }
      res.status(500).json(formatErrorResponse('Failed to retrieve task', error.message));
    }
  }

  /**
   * Create new task
   */
  async createTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const taskData = req.body;

      const task = await taskService.createTask(taskData, user.id, user.role);

      res.status(201).json(formatApiResponse(task, 'Task created successfully'));

    } catch (error) {
      console.error('Create task error:', error);
      if (error.message.includes('Access denied')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('not a member')) {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to create task', error.message));
    }
  }

  /**
   * Update task
   */
  async updateTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;
      const taskData = req.body;

      const task = await taskService.updateTask(parseInt(id), taskData, user.id, user.role);

      res.status(200).json(formatApiResponse(task, 'Task updated successfully'));

    } catch (error) {
      console.error('Update task error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message === 'No valid fields to update') {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('not a member')) {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to update task', error.message));
    }
  }

  /**
   * Delete task
   */
  async deleteTask(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;

      await taskService.deleteTask(parseInt(id), user.id, user.role);

      res.status(200).json(formatApiResponse(null, 'Task deleted successfully'));

    } catch (error) {
      console.error('Delete task error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('Only task creator or admin')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to delete task', error.message));
    }
  }

  /**
   * Add comment to task
   */
  async addComment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { content } = req.body;
      const { user } = req;

      const task = await taskService.addComment(parseInt(id), content, user.id, user.role);

      res.status(201).json(formatApiResponse(task, 'Comment added successfully'));

    } catch (error) {
      console.error('Add comment error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to add comment', error.message));
    }
  }

  /**
   * Update comment
   */
  async updateComment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { commentId } = req.params;
      const { content } = req.body;
      const { user } = req;

      const comment = await taskService.updateComment(parseInt(commentId), content, user.id, user.role);

      res.status(200).json(formatApiResponse(comment, 'Comment updated successfully'));

    } catch (error) {
      console.error('Update comment error:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('Only comment owner or admin')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to update comment', error.message));
    }
  }

  /**
   * Delete comment
   */
  async deleteComment(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { commentId } = req.params;
      const { user } = req;

      await taskService.deleteComment(parseInt(commentId), user.id, user.role);

      res.status(200).json(formatApiResponse(null, 'Comment deleted successfully'));

    } catch (error) {
      console.error('Delete comment error:', error);
      if (error.message.includes('not found')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('Only comment owner or admin')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to delete comment', error.message));
    }
  }

  /**
   * Get user's assigned tasks
   */
  async getUserTasks(req, res) {
    try {
      const { user } = req;

      const tasks = await taskService.getUserTasks(user.id);

      res.status(200).json(formatApiResponse({ tasks }, 'User tasks retrieved successfully'));

    } catch (error) {
      console.error('Get user tasks error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve user tasks', error.message));
    }
  }

  /**
   * Get tasks by project
   */
  async getTasksByProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { projectId } = req.params;
      const { user } = req;

      const tasks = await taskService.getTasksByProject(parseInt(projectId), user.id, user.role);

      res.status(200).json(formatApiResponse({ tasks }, 'Project tasks retrieved successfully'));

    } catch (error) {
      console.error('Get tasks by project error:', error);
      if (error.message.includes('Access denied')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to retrieve project tasks', error.message));
    }
  }
}

export default new TaskController();