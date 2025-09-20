import projectService from '../services/projectService.js';
import { validationResult } from 'express-validator';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

class ProjectController {
  /**
   * Get all projects with filtering and pagination
   */
  async getAllProjects(req, res) {
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
        search: req.query.search,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder
      };

      // Validate pagination limits
      if (options.limit > 100) {
        options.limit = 100;
      }

      const result = await projectService.getAllProjects(options, user.id, user.role);

      res.status(200).json(formatApiResponse(result, 'Projects retrieved successfully'));

    } catch (error) {
      console.error('Get all projects error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve projects', error.message));
    }
  }

  /**
   * Get project by ID
   */
  async getProjectById(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;

      const project = await projectService.getProjectById(parseInt(id), user.id, user.role);

      if (!project) {
        return res.status(404).json(formatErrorResponse('Project not found'));
      }

      res.status(200).json(formatApiResponse(project, 'Project retrieved successfully'));

    } catch (error) {
      console.error('Get project by ID error:', error);
      if (error.message === 'Access denied to this project') {
        return res.status(403).json(formatErrorResponse('Access denied to this project'));
      }
      res.status(500).json(formatErrorResponse('Failed to retrieve project', error.message));
    }
  }

  /**
   * Create new project
   */
  async createProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const projectData = req.body;

      // Only admin and manager can create projects
      if (user.role === 'developer') {
        return res.status(403).json(formatErrorResponse('Insufficient permissions to create projects'));
      }

      const project = await projectService.createProject(projectData, user.id);

      res.status(201).json(formatApiResponse(project, 'Project created successfully'));

    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json(formatErrorResponse('Failed to create project', error.message));
    }
  }

  /**
   * Update project
   */
  async updateProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;
      const projectData = req.body;

      const project = await projectService.updateProject(parseInt(id), projectData, user.id, user.role);

      res.status(200).json(formatApiResponse(project, 'Project updated successfully'));

    } catch (error) {
      console.error('Update project error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message === 'No valid fields to update') {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to update project', error.message));
    }
  }

  /**
   * Delete project
   */
  async deleteProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;

      await projectService.deleteProject(parseInt(id), user.id, user.role);

      res.status(200).json(formatApiResponse(null, 'Project deleted successfully'));

    } catch (error) {
      console.error('Delete project error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('Only project creator or admin')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to delete project', error.message));
    }
  }

  /**
   * Add team member to project
   */
  async addTeamMember(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { userId, role = 'developer' } = req.body;
      const { user } = req;

      const project = await projectService.addTeamMember(
        parseInt(id), 
        parseInt(userId), 
        role, 
        user.id, 
        user.role
      );

      res.status(200).json(formatApiResponse(project, 'Team member added successfully'));

    } catch (error) {
      console.error('Add team member error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('already a member')) {
        return res.status(409).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('User not found')) {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to add team member', error.message));
    }
  }

  /**
   * Remove team member from project
   */
  async removeTeamMember(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id, userId } = req.params;
      const { user } = req;

      const project = await projectService.removeTeamMember(
        parseInt(id), 
        parseInt(userId), 
        user.id, 
        user.role
      );

      res.status(200).json(formatApiResponse(project, 'Team member removed successfully'));

    } catch (error) {
      console.error('Remove team member error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('Cannot remove project creator')) {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('not a member')) {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to remove team member', error.message));
    }
  }

  /**
   * Update team member role
   */
  async updateMemberRole(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id, userId } = req.params;
      const { role } = req.body;
      const { user } = req;

      const project = await projectService.updateMemberRole(
        parseInt(id), 
        parseInt(userId), 
        role, 
        user.id, 
        user.role
      );

      res.status(200).json(formatApiResponse(project, 'Member role updated successfully'));

    } catch (error) {
      console.error('Update member role error:', error);
      if (error.message.includes('not found') || error.message.includes('access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('Invalid role')) {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      if (error.message.includes('not a member')) {
        return res.status(400).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to update member role', error.message));
    }
  }

  /**
   * Get user's projects
   */
  async getUserProjects(req, res) {
    try {
      const { user } = req;

      const projects = await projectService.getUserProjects(user.id);

      res.status(200).json(formatApiResponse({ projects }, 'User projects retrieved successfully'));

    } catch (error) {
      console.error('Get user projects error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve user projects', error.message));
    }
  }
}

export default new ProjectController();