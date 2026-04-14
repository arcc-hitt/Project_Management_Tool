import { Project, User, ActivityLog } from '../models/index.js';
import { 
  snakeToCamel, 
  camelToSnake,
  formatDateForDB 
} from '../utils/helpers.js';
import auditLogService from './auditLogService.js';
import AuditLog from '../models/AuditLog.js';

class ProjectService {
  /**
   * Get all projects with pagination and filtering
   * @param {object} options - Query options
   * @param {number} userId - Current user ID for permission filtering
   * @returns {object} Projects data with pagination
   */
  async getAllProjects(options: any = {}, userId: string, userRole: string) {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      priority, 
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    try {
      // Build filters object
      const filters: Record<string, any> = {};
      if (status) filters.status = status;
      if (priority) filters.priority = priority;
      if (search) filters.search = search;

      let projects: any[];
      
      // Role-based filtering
      if (userRole === 'developer') {
        // Get projects where user is a member
        const userProjects = await Project.findByMemberId(userId);
        projects = userProjects;
      } else {
        // Admin and managers can see all projects
        projects = await Project.findAll(filters);
      }

      // Apply pagination and sorting
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      // Sort projects
      projects.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder.toUpperCase() === 'ASC') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      const paginatedProjects = projects.slice(startIndex, endIndex);
      const totalProjects = projects.length;

      return {
        projects: paginatedProjects,
        pagination: {
          totalItems: totalProjects,
          totalPages: Math.ceil(totalProjects / limit),
          currentPage: page,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalProjects / limit),
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get project by ID with team members
   * @param {number} projectId - Project ID
   * @param {number} userId - Current user ID
   * @param {string} userRole - Current user role
   * @returns {object|null} Project data with team members
   */
  async getProjectById(projectId: string, userId: string, userRole: string) {
    try {
      // Get project using model
      const project = await Project.findById(projectId);
      if (!project) {
        return null;
      }

      // Check if user has access to this project
      if (userRole === 'developer') {
        const hasAccess = await Project.isMember(projectId, userId);
        if (!hasAccess) {
          throw new Error('Access denied to this project');
        }
      }

      // Get team members using model
      const teamMembers = await Project.getMembers(projectId);
      project.teamMembers = teamMembers;

      // Get project statistics using model
      const statistics = await Project.getStatistics(projectId);
      project.statistics = statistics;

      return project;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new project
   * @param {object} projectData - Project data
   * @param {number} createdBy - ID of user creating the project
   * @returns {object} Created project data
   */
  async createProject(projectData: any, createdBy: string) {
    const { 
      name,
      description,
      status = 'planning',
      priority = 'medium',
      startDate,
      endDate,
      teamMembers = []
    } = projectData;

    try {
      // Create project using model
      const project = await Project.create({
        name,
        description,
        status,
        priority,
        startDate,
        endDate,
        createdBy
      });

      // Add creator as project manager
      await Project.addMember(project.id, createdBy, 'manager');

      // Add team members if provided
      if (teamMembers.length > 0) {
        for (const member of teamMembers) {
          await Project.addMember(project.id, member.userId, member.role || 'developer');
        }
      }

      // Return created project with full details
      return await this.getProjectById(project.id, createdBy, 'admin');

    } catch (error) {
      throw error;
    }
  }  /**
   * Update project
   * @param {number} projectId - Project ID
   * @param {object} projectData - Updated project data
   * @param {number} updatedBy - ID of user making the update
   * @param {string} userRole - Role of user making the update
   * @returns {object} Updated project data
   */
  async updateProject(projectId, projectData, updatedBy, userRole, req?: any) {
    try {
      // Check if project exists and user has permission
      const existingProject = await this.getProjectById(projectId, updatedBy, userRole);
      if (!existingProject) {
        throw new Error('Project not found or access denied');
      }

      // Capture old values for audit log
      const oldValues: Record<string, any> = {};
      const newValues: Record<string, any> = {};
      for (const key of Object.keys(projectData)) {
        if (existingProject[key] !== undefined) oldValues[key] = existingProject[key];
        newValues[key] = projectData[key];
      }

      // Update project using model
      await Project.update(projectId, projectData);

      // Audit log: project settings update (Req 11.1)
      auditLogService.log(
        updatedBy,
        AuditLog.ACTIONS.PROJECT_SETTINGS_UPDATED,
        AuditLog.ENTITY_TYPES.PROJECT,
        projectId,
        oldValues,
        newValues,
        req
      ).catch((err) => console.error('auditLog error (project.settings_updated):', err));

      // Return updated project
      return await this.getProjectById(projectId, updatedBy, userRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete project
   * @param {number} projectId - Project ID
   * @param {number} deletedBy - ID of user performing deletion
   * @param {string} userRole - Role of user performing deletion
   * @returns {boolean} Success status
   */
  async deleteProject(projectId, deletedBy, userRole) {
    try {
      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, deletedBy, userRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Only allow deletion by admin or project creator
      if (userRole !== 'admin' && project.createdBy !== deletedBy) {
        throw new Error('Only project creator or admin can delete this project');
      }

      // Delete project using model
      await Project.delete(projectId);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Add team member to project
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID to add
   * @param {string} role - Role in project
   * @param {number} addedBy - ID of user adding the member
   * @param {string} addedByRole - Role of user adding the member
   * @returns {object} Updated project data
   */
  async addTeamMember(projectId, userId, role = 'developer', addedBy, addedByRole, req?: any) {
    try {
      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, addedBy, addedByRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Check if user is already a member
      const isAlreadyMember = await Project.isMember(projectId, userId);
      if (isAlreadyMember) {
        throw new Error('User is already a member of this project');
      }

      // Verify user exists
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found or inactive');
      }

      // Add team member using model
      await Project.addMember(projectId, userId, role);

      // Audit log: project member added (Req 11.1)
      auditLogService.log(
        addedBy,
        AuditLog.ACTIONS.PROJECT_MEMBER_ADDED,
        AuditLog.ENTITY_TYPES.PROJECT,
        projectId,
        null,
        { userId, role },
        req
      ).catch((err) => console.error('auditLog error (project.member_added):', err));

      // Return updated project
      return await this.getProjectById(projectId, addedBy, addedByRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Remove team member from project
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID to remove
   * @param {number} removedBy - ID of user removing the member
   * @param {string} removedByRole - Role of user removing the member
   * @returns {object} Updated project data
   */
  async removeTeamMember(projectId, userId, removedBy, removedByRole, req?: any) {
    try {
      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, removedBy, removedByRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Don't allow removing the project creator
      if (project.createdBy === userId) {
        throw new Error('Cannot remove project creator from team');
      }

      // Remove team member using model
      const removed = await Project.removeMember(projectId, userId);
      if (!removed) {
        throw new Error('User is not a member of this project');
      }

      // Audit log: project member removed (Req 11.1)
      auditLogService.log(
        removedBy,
        AuditLog.ACTIONS.PROJECT_MEMBER_REMOVED,
        AuditLog.ENTITY_TYPES.PROJECT,
        projectId,
        { userId },
        null,
        req
      ).catch((err) => console.error('auditLog error (project.member_removed):', err));

      // Return updated project
      return await this.getProjectById(projectId, removedBy, removedByRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update team member role
   * @param {number} projectId - Project ID
   * @param {number} userId - User ID
   * @param {string} newRole - New role
   * @param {number} updatedBy - ID of user making the update
   * @param {string} updatedByRole - Role of user making the update
   * @returns {object} Updated project data
   */
  async updateMemberRole(projectId, userId, newRole, updatedBy, updatedByRole) {
    try {
      // Validate role
      const validRoles = ['manager', 'developer', 'tester', 'designer'];
      if (!validRoles.includes(newRole)) {
        throw new Error('Invalid role specified');
      }

      // Check if project exists and user has permission
      const project = await this.getProjectById(projectId, updatedBy, updatedByRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Update member role using model
      const updated = await Project.updateMemberRole(projectId, userId, newRole);
      if (!updated) {
        throw new Error('User is not a member of this project');
      }

      // Return updated project
      return await this.getProjectById(projectId, updatedBy, updatedByRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get projects where user is a member
   * @param {number} userId - User ID
   * @returns {array} User's projects
   */
  async getUserProjects(userId) {
    try {
      // Use model to get user's projects
      return await Project.findByMemberId(userId);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tasks for a project (compat for frontend)
   */
  async getProjectTasks(projectId, userId, userRole) {
    try {
      // Ensure access
      const project = await this.getProjectById(projectId, userId, userRole);
      if (!project) {
        throw new Error('Project not found or access denied');
      }

      // Use Project model to fetch tasks
      const tasks = await Project.getTasks(projectId);
      return tasks;
    } catch (error) {
      throw error;
    }
  }

  async duplicateProject(projectId, name, requestedBy, userRole) {
    const sourceProject = await this.getProjectById(projectId, requestedBy, userRole);
    if (!sourceProject) {
      throw new Error('Project not found');
    }

    const sourceName = sourceProject.name || 'Project';
    const duplicateName = name || `${sourceName} (Copy)`;

    const teamMembers = (sourceProject.teamMembers || [])
      .map((m) => ({
        userId: m.id || m.userId,
        role: m.project_role || m.role || 'developer',
      }))
      .filter((m) => m.userId && String(m.userId) !== String(requestedBy));

    return this.createProject(
      {
        name: duplicateName,
        description: sourceProject.description,
        status: 'planning',
        priority: sourceProject.priority || 'medium',
        startDate: sourceProject.startDate || null,
        endDate: sourceProject.endDate || null,
        teamMembers,
      },
      requestedBy
    );
  }

  async archiveProject(projectId, userId, userRole) {
    const project = await this.getProjectById(projectId, userId, userRole);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    await Project.update(projectId, { status: 'cancelled' });
    return this.getProjectById(projectId, userId, userRole);
  }

  async unarchiveProject(projectId, userId, userRole) {
    const project = await this.getProjectById(projectId, userId, userRole);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    await Project.update(projectId, { status: 'active' });
    return this.getProjectById(projectId, userId, userRole);
  }

  async getProjectTimeline(projectId, userId, userRole) {
    const project = await this.getProjectById(projectId, userId, userRole);
    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const activities = await ActivityLog.findByEntity('project', projectId, { limit: 100 });
    return activities;
  }

  async getProjectActivities(projectId, userId, userRole) {
    return this.getProjectTimeline(projectId, userId, userRole);
  }
}

export default new ProjectService();