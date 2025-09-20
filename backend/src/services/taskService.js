import database from '../config/database.js';
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
      // Build WHERE clause based on user role and filters
      let whereClause = 'WHERE 1=1';
      let queryParams = [];

      // Role-based filtering
      if (userRole === 'developer') {
        // Developers can only see tasks from projects they are assigned to or tasks assigned to them
        whereClause += ` AND (t.project_id IN (
          SELECT project_id FROM project_members WHERE user_id = ?
        ) OR t.assigned_to = ?)`;
        queryParams.push(userId, userId);
      }

      if (projectId) {
        whereClause += ' AND t.project_id = ?';
        queryParams.push(projectId);
      }

      if (status) {
        whereClause += ' AND t.status = ?';
        queryParams.push(status);
      }

      if (priority) {
        whereClause += ' AND t.priority = ?';
        queryParams.push(priority);
      }

      if (assignedTo) {
        whereClause += ' AND t.assigned_to = ?';
        queryParams.push(assignedTo);
      }

      if (search) {
        whereClause += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm);
      }

      if (overdue === 'true') {
        whereClause += ' AND t.due_date < NOW() AND t.status != ?';
        queryParams.push('done');
      }

      // Validate sort column
      const allowedSortColumns = ['id', 'title', 'status', 'priority', 'due_date', 'created_at'];
      const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT t.id) as total 
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        ${userRole === 'developer' ? 'LEFT JOIN project_members pm ON t.project_id = pm.project_id' : ''}
        ${whereClause}
      `;
      const [countResult] = await database.query(countQuery, queryParams);
      const totalTasks = countResult.total;

      // Get paginated tasks with project and assignee info
      const { limit: sqlLimit, offset } = getPaginationSQL(page, limit);
      const tasksQuery = `
        SELECT DISTINCT t.id, t.title, t.description, t.status, t.priority, 
               t.due_date, t.estimated_hours, t.actual_hours, t.project_id, 
               t.assigned_to, t.created_by, t.created_at, t.updated_at,
               p.name as project_name,
               u1.first_name as assignee_first_name, u1.last_name as assignee_last_name,
               u2.first_name as creator_first_name, u2.last_name as creator_last_name,
               (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) as comment_count
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        ${userRole === 'developer' ? 'LEFT JOIN project_members pm ON t.project_id = pm.project_id' : ''}
        ${whereClause}
        ORDER BY t.${sortColumn} ${sortDirection}
        LIMIT ? OFFSET ?
      `;

      const tasks = await database.query(tasksQuery, [...queryParams, sqlLimit, offset]);

      // Add computed fields
      const tasksWithExtras = tasks.map(task => {
        const taskData = snakeToCamel(task);
        taskData.isOverdue = isOverdue(task.due_date) && task.status !== 'done';
        return taskData;
      });

      return {
        tasks: tasksWithExtras,
        pagination: {
          totalItems: totalTasks,
          totalPages: Math.ceil(totalTasks / limit),
          currentPage: page,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalTasks / limit),
          hasPrevPage: page > 1
        }
      };

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
      // Check if user has access to this task
      if (userRole === 'developer') {
        const accessCheck = await database.query(`
          SELECT 1 FROM tasks t
          LEFT JOIN project_members pm ON t.project_id = pm.project_id
          WHERE t.id = ? AND (pm.user_id = ? OR t.assigned_to = ?)
        `, [taskId, userId, userId]);
        
        if (accessCheck.length === 0) {
          throw new Error('Access denied to this task');
        }
      }

      // Get task details
      const taskQuery = `
        SELECT t.id, t.title, t.description, t.status, t.priority, 
               t.due_date, t.estimated_hours, t.actual_hours, t.project_id, 
               t.assigned_to, t.created_by, t.created_at, t.updated_at,
               p.name as project_name, p.status as project_status,
               u1.first_name as assignee_first_name, u1.last_name as assignee_last_name, u1.email as assignee_email,
               u2.first_name as creator_first_name, u2.last_name as creator_last_name, u2.email as creator_email
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.id = ?
      `;
      
      const tasks = await database.query(taskQuery, [taskId]);
      if (tasks.length === 0) {
        return null;
      }

      const task = snakeToCamel(tasks[0]);
      task.isOverdue = isOverdue(tasks[0].due_date) && tasks[0].status !== 'done';

      // Get task comments
      const commentsQuery = `
        SELECT tc.id, tc.content, tc.created_at, tc.updated_at,
               u.first_name, u.last_name, u.email, u.avatar_url
        FROM task_comments tc
        LEFT JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC
      `;

      const comments = await database.query(commentsQuery, [taskId]);
      task.comments = comments.map(comment => snakeToCamel(comment));

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
        const projectAccess = await database.query(
          'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
          [projectId, createdBy]
        );
        if (projectAccess.length === 0) {
          throw new Error('Access denied to this project');
        }
      }

      // Verify assignee is a project member if specified
      if (assignedTo) {
        const assigneeCheck = await database.query(
          'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
          [projectId, assignedTo]
        );
        if (assigneeCheck.length === 0) {
          throw new Error('Assignee is not a member of this project');
        }
      }

      // Insert task
      const insertQuery = `
        INSERT INTO tasks (title, description, status, priority, project_id, assigned_to, due_date, estimated_hours, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const [result] = await database.query(insertQuery, [
        title, 
        description, 
        status, 
        priority,
        projectId,
        assignedTo,
        formatDateForDB(dueDate),
        estimatedHours,
        createdBy
      ]);

      const taskId = result.insertId;

      // Return created task
      return await this.getTaskById(taskId, createdBy, userRole);

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

      // Prepare update data
      const allowedFields = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date', 'estimated_hours', 'actual_hours'];
      const updateData = {};
      
      Object.keys(taskData).forEach(key => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (allowedFields.includes(snakeKey)) {
          if (key === 'dueDate') {
            updateData[snakeKey] = formatDateForDB(taskData[key]);
          } else {
            updateData[snakeKey] = taskData[key];
          }
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      // Verify assignee is a project member if being updated
      if (updateData.assigned_to) {
        const assigneeCheck = await database.query(
          'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
          [existingTask.projectId, updateData.assigned_to]
        );
        if (assigneeCheck.length === 0) {
          throw new Error('Assignee is not a member of this project');
        }
      }

      // Build update query
      const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const updateQuery = `
        UPDATE tasks 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      await database.query(updateQuery, [...Object.values(updateData), taskId]);

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

      // Delete task (cascading deletes will handle comments)
      await database.query('DELETE FROM tasks WHERE id = ?', [taskId]);

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
      // Check if task exists and user has access
      const task = await this.getTaskById(taskId, userId, userRole);
      if (!task) {
        throw new Error('Task not found or access denied');
      }

      // Add comment
      await database.query(
        'INSERT INTO task_comments (task_id, user_id, content) VALUES (?, ?, ?)',
        [taskId, userId, content]
      );

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
      const commentQuery = `
        SELECT tc.*, t.project_id 
        FROM task_comments tc
        LEFT JOIN tasks t ON tc.task_id = t.id
        WHERE tc.id = ?
      `;
      const comments = await database.query(commentQuery, [commentId]);
      
      if (comments.length === 0) {
        throw new Error('Comment not found');
      }

      const comment = comments[0];

      // Only comment owner or admin can update
      if (userRole !== 'admin' && comment.user_id !== userId) {
        throw new Error('Only comment owner or admin can update this comment');
      }

      // Update comment
      await database.query(
        'UPDATE task_comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [content, commentId]
      );

      // Return updated comment
      const updatedComments = await database.query(
        `SELECT tc.id, tc.content, tc.created_at, tc.updated_at,
                u.first_name, u.last_name, u.email, u.avatar_url
         FROM task_comments tc
         LEFT JOIN users u ON tc.user_id = u.id
         WHERE tc.id = ?`,
        [commentId]
      );

      return snakeToCamel(updatedComments[0]);

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
      const comments = await database.query(
        'SELECT user_id FROM task_comments WHERE id = ?',
        [commentId]
      );
      
      if (comments.length === 0) {
        throw new Error('Comment not found');
      }

      const comment = comments[0];

      // Only comment owner or admin can delete
      if (userRole !== 'admin' && comment.user_id !== userId) {
        throw new Error('Only comment owner or admin can delete this comment');
      }

      // Delete comment
      await database.query('DELETE FROM task_comments WHERE id = ?', [commentId]);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user's assigned tasks
   * @param {number} userId - User ID
   * @returns {array} User's assigned tasks
   */
  async getUserTasks(userId) {
    try {
      const query = `
        SELECT t.id, t.title, t.description, t.status, t.priority, 
               t.due_date, t.estimated_hours, t.actual_hours, t.created_at,
               p.name as project_name, p.id as project_id
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        WHERE t.assigned_to = ?
        ORDER BY 
          CASE 
            WHEN t.due_date < NOW() AND t.status != 'done' THEN 1
            ELSE 2
          END,
          t.due_date ASC,
          t.priority DESC
      `;

      const tasks = await database.query(query, [userId]);
      return tasks.map(task => {
        const taskData = snakeToCamel(task);
        taskData.isOverdue = isOverdue(task.due_date) && task.status !== 'done';
        return taskData;
      });

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
      // Check if user has access to project
      if (userRole === 'developer') {
        const projectAccess = await database.query(
          'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
          [projectId, userId]
        );
        if (projectAccess.length === 0) {
          throw new Error('Access denied to this project');
        }
      }

      const query = `
        SELECT t.id, t.title, t.description, t.status, t.priority, 
               t.due_date, t.estimated_hours, t.actual_hours, t.created_at,
               t.assigned_to, t.created_by,
               u1.first_name as assignee_first_name, u1.last_name as assignee_last_name,
               u2.first_name as creator_first_name, u2.last_name as creator_last_name,
               (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) as comment_count
        FROM tasks t
        LEFT JOIN users u1 ON t.assigned_to = u1.id
        LEFT JOIN users u2 ON t.created_by = u2.id
        WHERE t.project_id = ?
        ORDER BY t.status DESC, t.priority DESC, t.created_at DESC
      `;

      const tasks = await database.query(query, [projectId]);
      return tasks.map(task => {
        const taskData = snakeToCamel(task);
        taskData.isOverdue = isOverdue(task.due_date) && task.status !== 'done';
        return taskData;
      });

    } catch (error) {
      throw error;
    }
  }
}

export default new TaskService();