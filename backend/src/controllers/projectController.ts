import projectService from '../services/projectService.js';
import { validationResult } from 'express-validator';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

const normalizeProjectPayload = (project) => {
  if (!project || typeof project !== 'object') {
    return project;
  }

  const payload = { ...project };
  if (payload.managerId === undefined && payload.createdBy !== undefined) {
    payload.managerId = payload.createdBy;
  }
  return payload;
};

const normalizeProjectListPayload = (result) => {
  if (!result || !Array.isArray(result.projects)) {
    return result;
  }

  return {
    ...result,
    projects: result.projects.map((p) => normalizeProjectPayload(p && typeof p.toObject === 'function' ? { ...p.toObject(), id: p.id } : p)),
  };
};

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
      const payload = normalizeProjectListPayload(result);

      res.status(200).json(formatApiResponse(payload, 'Projects retrieved successfully'));

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

      const project = await projectService.getProjectById(id, user.id, user.role);

      if (!project) {
        return res.status(404).json(formatErrorResponse('Project not found'));
      }

  const payload = normalizeProjectPayload(project && typeof project.toObject === 'function' ? { ...project.toObject(), id: project.id } : project);
  res.status(200).json(formatApiResponse(payload, 'Project retrieved successfully'));

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
      const payload = normalizeProjectPayload(project && typeof project.toObject === 'function'
        ? { ...project.toObject(), id: project.id }
        : project);
      res.status(201).json(formatApiResponse(payload, 'Project created successfully'));

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

  const project = await projectService.updateProject(id, projectData, user.id, user.role);
  const payload = normalizeProjectPayload(project && typeof project.toObject === 'function' ? { ...project.toObject(), id: project.id } : project);
  res.status(200).json(formatApiResponse(payload, 'Project updated successfully'));

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

      await projectService.deleteProject(id, user.id, user.role);

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
        id, 
        userId, 
        role, 
        user.id, 
        user.role
      );
      const payload = normalizeProjectPayload(project && typeof project.toObject === 'function' ? { ...project.toObject(), id: project.id } : project);
      res.status(200).json(formatApiResponse(payload, 'Team member added successfully'));

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
        id, 
        userId, 
        user.id, 
        user.role
      );
      const payload = normalizeProjectPayload(project && typeof project.toObject === 'function' ? { ...project.toObject(), id: project.id } : project);
      res.status(200).json(formatApiResponse(payload, 'Team member removed successfully'));

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
        id, 
        userId, 
        role, 
        user.id, 
        user.role
      );
      const payload = normalizeProjectPayload(project && typeof project.toObject === 'function' ? { ...project.toObject(), id: project.id } : project);
      res.status(200).json(formatApiResponse(payload, 'Member role updated successfully'));

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

      const payload = {
        projects: (projects || []).map((p) => normalizeProjectPayload(p && typeof p.toObject === 'function' ? { ...p.toObject(), id: p.id } : p)),
      };

      res.status(200).json(formatApiResponse(payload, 'User projects retrieved successfully'));

    } catch (error) {
      console.error('Get user projects error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve user projects', error.message));
    }
  }

  /**
   * Get project members (compat for frontend)
   */
  async getProjectMembers(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;

      const project = await projectService.getProjectById(id, user.id, user.role);
      if (!project) {
        return res.status(404).json(formatErrorResponse('Project not found'));
      }

      const members = project.teamMembers || [];
      return res.status(200).json(formatApiResponse(members, 'Project members retrieved successfully'));
    } catch (error) {
      console.error('Get project members error:', error);
      if (error.message && error.message.includes('Access denied')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      return res.status(500).json(formatErrorResponse('Failed to retrieve project members', error.message));
    }
  }

  /**
   * Get project tasks (compat for frontend)
   */
  async getProjectTasks(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { user } = req;
      const tasks = await projectService.getProjectTasks(id, user.id, user.role);
      return res.status(200).json(formatApiResponse(tasks, 'Project tasks retrieved successfully'));
    } catch (error) {
      console.error('Get project tasks error:', error);
      if (error.message && error.message.includes('Access denied')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      return res.status(500).json(formatErrorResponse('Failed to retrieve project tasks', error.message));
    }
  }

  async duplicateProject(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { id } = req.params;
      const { name } = req.body || {};
      const { user } = req;

      const duplicated = await projectService.duplicateProject(id, name, user.id, user.role);
      const payload = normalizeProjectPayload(duplicated && typeof duplicated.toObject === 'function' ? { ...duplicated.toObject(), id: duplicated.id } : duplicated);
      return res.status(201).json(formatApiResponse(payload, 'Project duplicated successfully'));
    } catch (error) {
      console.error('Duplicate project error:', error);
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      if (error.message && error.message.includes('Access denied')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      return res.status(500).json(formatErrorResponse('Failed to duplicate project', error.message));
    }
  }

  async archiveProject(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const project = await projectService.archiveProject(id, user.id, user.role);
      const payload = normalizeProjectPayload(project && typeof project.toObject === 'function' ? { ...project.toObject(), id: project.id } : project);
      return res.status(200).json(formatApiResponse(payload, 'Project archived successfully'));
    } catch (error) {
      console.error('Archive project error:', error);
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      return res.status(500).json(formatErrorResponse('Failed to archive project', error.message));
    }
  }

  async unarchiveProject(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const project = await projectService.unarchiveProject(id, user.id, user.role);
      const payload = normalizeProjectPayload(project && typeof project.toObject === 'function' ? { ...project.toObject(), id: project.id } : project);
      return res.status(200).json(formatApiResponse(payload, 'Project unarchived successfully'));
    } catch (error) {
      console.error('Unarchive project error:', error);
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      return res.status(500).json(formatErrorResponse('Failed to unarchive project', error.message));
    }
  }

  async getProjectTimeline(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const timeline = await projectService.getProjectTimeline(id, user.id, user.role);
      return res.status(200).json(formatApiResponse(timeline, 'Project timeline retrieved successfully'));
    } catch (error) {
      console.error('Get project timeline error:', error);
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      return res.status(500).json(formatErrorResponse('Failed to retrieve project timeline', error.message));
    }
  }

  async getProjectActivities(req, res) {
    try {
      const { id } = req.params;
      const { user } = req;
      const activities = await projectService.getProjectActivities(id, user.id, user.role);
      return res.status(200).json(formatApiResponse(activities, 'Project activities retrieved successfully'));
    } catch (error) {
      console.error('Get project activities error:', error);
      if (error.message && error.message.includes('not found')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      return res.status(500).json(formatErrorResponse('Failed to retrieve project activities', error.message));
    }
  }
}

export default new ProjectController();