import { Task, Project, User, Comment } from '../models/index.js';
import { 
  snakeToCamel, 
  camelToSnake,
  getPaginationSQL,
  formatDateForDB,
  isOverdue 
} from '../utils/helpers.js';

class TaskService {
  /**
   * Get all tasks with pagination and filtering
   * @param {object} options - Query options
   * @param {number} userId - Current user ID for permission filtering
   * @param {string} userRole - Current user role
   * @returns {object} Tasks data with pagination
   */
  async getAllTasks(options = {}, userId, userRole) {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      priority,
      projectId,
      assignedTo,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      overdue
    } = options;

    try {
      // Build filters object
      const filters = {};
      if (status) filters.status = status;
      if (priority) filters.priority = priority;
      if (projectId) filters.projectId = projectId;
      if (assignedTo) filters.assignedTo = assignedTo;
      if (search) filters.search = search;
      if (overdue === 'true') filters.overdue = true;

      let tasks;
      
      // Role-based filtering
      if (userRole === 'developer') {
        // Get tasks from user's projects or assigned to user
        const userProjects = await Project.findByMemberId(userId);
        const projectIds = userProjects.map(p => p.id);
        
        tasks = await Task.findByUserAccess(userId, projectIds, filters);
      } else {
        // Admin and managers can see all tasks
        tasks = await Task.findAll(filters);
      }

      // Apply pagination and sorting
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      
      // Sort tasks
      tasks.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder.toUpperCase() === 'ASC') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      const paginatedTasks = tasks.slice(startIndex, endIndex);
      const totalTasks = tasks.length;

      const result = {
        tasks: paginatedTasks,
        pagination: {
          totalItems: totalTasks,
          totalPages: Math.ceil(totalTasks / limit),
          currentPage: page,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalTasks / limit),
          hasPrevPage: page > 1
        }
      };

      return result;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get task by ID with comments
   * @param {number} taskId - Task ID
   * @param {number} userId - Current user ID
   * @param {string} userRole - Current user role
   * @returns {object|null} Task data with comments
   */
  async getTaskById(taskId, userId, userRole) {
    try {
      // Get task using model
      const task = await Task.findById(taskId);
      if (!task) {
        return null;
      }

      // Check if user has access to this task
      if (userRole === 'developer') {
        const hasAccess = await Task.hasUserAccess(taskId, userId);
        if (!hasAccess) {
          throw new Error('Access denied to this task');
        }
      }

      // Get task comments using model
      const comments = await Task.getComments(taskId);
      task.comments = comments;

      return task;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new task
   * @param {object} taskData - Task data
   * @param {number} createdBy - ID of user creating the task
   * @param {string} userRole - Role of user creating the task
   * @returns {object} Created task data
   */
  async createTask(taskData, createdBy, userRole) {
    const { 
      title, 
      description, 
      status = 'todo',
      priority = 'medium',
      projectId,
      assignedTo,
      dueDate,
      estimatedHours
    } = taskData;

    try {
      // Verify project exists and user has access
      if (userRole === 'developer') {
        const hasAccess = await Project.isMember(projectId, createdBy);
        if (!hasAccess) {
          throw new Error('Access denied to this project');
        }
      }

      // Verify assignee is a project member if specified
      if (assignedTo) {
        const isAssigneeMember = await Project.isMember(projectId, assignedTo);
        if (!isAssigneeMember) {
          throw new Error('Assignee is not a member of this project');
        }
      }

      // Create task using model
      const task = await Task.create({
        title,
        description,
        status,
        priority,
        projectId,
        assignedTo,
        dueDate,
        estimatedHours,
        createdBy
      });

      // Return created task with full details
      return await this.getTaskById(task.id, createdBy, userRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update task
   * @param {number} taskId - Task ID
   * @param {object} taskData - Updated task data
   * @param {number} updatedBy - ID of user making the update
   * @param {string} userRole - Role of user making the update
   * @returns {object} Updated task data
   */
  async updateTask(taskId, taskData, updatedBy, userRole) {
    try {
      // Check if task exists and user has access
      const existingTask = await this.getTaskById(taskId, updatedBy, userRole);
      if (!existingTask) {
        throw new Error('Task not found or access denied');
      }

      // Verify assignee is a project member if being updated
      if (taskData.assignedTo) {
        const isAssigneeMember = await Project.isMember(existingTask.projectId, taskData.assignedTo);
        if (!isAssigneeMember) {
          throw new Error('Assignee is not a member of this project');
        }
      }

      // Update task using model
      await Task.update(taskId, taskData);

      // Return updated task
      return await this.getTaskById(taskId, updatedBy, userRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete task
   * @param {number} taskId - Task ID
   * @param {number} deletedBy - ID of user performing deletion
   * @param {string} userRole - Role of user performing deletion
   * @returns {boolean} Success status
   */
  async deleteTask(taskId, deletedBy, userRole) {
    try {
      // Check if task exists and user has permission
      const task = await this.getTaskById(taskId, deletedBy, userRole);
      if (!task) {
        throw new Error('Task not found or access denied');
      }

      // Only allow deletion by admin, project creator, or task creator
      if (userRole !== 'admin' && task.createdBy !== deletedBy) {
        throw new Error('Only task creator or admin can delete this task');
      }

      // Delete task using model
      await Task.delete(taskId);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Add comment to task
   * @param {number} taskId - Task ID
   * @param {string} content - Comment content
   * @param {number} userId - User ID adding the comment
   * @param {string} userRole - Role of user adding the comment
   * @returns {object} Updated task data with comments
   */
  async addComment(taskId, content, userId, userRole) {
    try {
      // Ensure task exists
      const existing = await Task.findById(taskId);
      if (!existing) {
        throw new Error('Task not found');
      }

      // Check access for developers
      if (userRole === 'developer') {
        const hasAccess = await Task.hasUserAccess(taskId, userId);
        if (!hasAccess) {
          throw new Error('Access denied to this task');
        }
      }

      // Add comment using model
      await Comment.create({
        taskId,
        userId,
        comment: content
      });

  // Return updated task with comments
  return await this.getTaskById(taskId, userId, userRole);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update comment
   * @param {number} commentId - Comment ID
   * @param {string} content - Updated content
   * @param {number} userId - User ID updating the comment
   * @param {string} userRole - Role of user updating the comment
   * @returns {object} Updated comment data
   */
  async updateComment(commentId, content, userId, userRole) {
    try {
      // Check if comment exists and user owns it
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Only comment owner or admin can update
      if (userRole !== 'admin' && comment.userId !== userId) {
        throw new Error('Only comment owner or admin can update this comment');
      }

      // Update comment using model
  await Comment.update(commentId, { comment: content });

      // Return updated comment
      return await Comment.findById(commentId);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete comment
   * @param {number} commentId - Comment ID
   * @param {number} userId - User ID deleting the comment
   * @param {string} userRole - Role of user deleting the comment
   * @returns {boolean} Success status
   */
  async deleteComment(commentId, userId, userRole) {
    try {
      // Check if comment exists and user owns it
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new Error('Comment not found');
      }

      // Only comment owner or admin can delete
      if (userRole !== 'admin' && comment.userId !== userId) {
        throw new Error('Only comment owner or admin can delete this comment');
      }

      // Delete comment using model
      await Comment.delete(commentId);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's tasks
   * @param {number} userId - User ID
   * @returns {array} User's tasks
   */
  async getUserTasks(userId) {
    try {
      return await Task.findByAssignee(userId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get tasks by project
   * @param {number} projectId - Project ID
   * @param {number} userId - Current user ID
   * @param {string} userRole - Current user role
   * @returns {array} Project tasks
   */
  async getTasksByProject(projectId, userId, userRole) {
    try {
      // Check project access
      if (userRole === 'developer') {
        const hasAccess = await Project.isMember(projectId, userId);
        if (!hasAccess) {
          throw new Error('Access denied to this project');
        }
      }

      return await Task.findByProject(projectId);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get comments for a task (compat route)
   * @param {number} taskId - Task ID
   * @param {number} userId - Current user ID
   * @param {string} userRole - Current user role
   * @returns {array} Task comments
   */
  async getTaskComments(taskId, userId, userRole) {
    try {
      // Ensure task exists
      const existing = await Task.findById(taskId);
      if (!existing) {
        throw new Error('Task not found');
      }

      // Access control for developers
      if (userRole === 'developer') {
        const hasAccess = await Task.hasUserAccess(taskId, userId);
        if (!hasAccess) {
          throw new Error('Access denied to this task');
        }
      }

      return await Comment.findByTaskId(taskId, { orderDir: 'ASC' });
    } catch (error) {
      throw error;
    }
  }
}

export default new TaskService();