 import database from '../config/database.js';
import { formatDateForDB, snakeToCamel, camelToSnake } from '../utils/helpers.js';

class Task {
  constructor(data = {}) {
    // Accept both camelCase (from services) and snake_case (from database)
    this.id = data.id;
    this.projectId = data.projectId || data.project_id;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status || 'todo';
    this.priority = data.priority || 'medium';
    this.assignedTo = data.assignedTo || data.assigned_to;
    this.createdBy = data.createdBy || data.created_by;
    this.estimatedHours = data.estimatedHours || data.estimated_hours;
    this.actualHours = data.actualHours || data.actual_hours || 0;
    this.dueDate = data.dueDate || data.due_date;
    this.completedAt = data.completedAt || data.completed_at;
    this.tags = data.tags;
    this.storyPoints = data.storyPoints || data.story_points;
    this.blocked = data.blocked || false;
    this.blockedReason = data.blockedReason || data.blocked_reason;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  // Static methods for database operations
  static async create(taskData) {
    try {
      const query = `
        INSERT INTO tasks (project_id, title, description, status, priority, 
                          assigned_to, created_by, estimated_hours, actual_hours, due_date, 
                          tags, story_points, blocked, blocked_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const values = [
        taskData.projectId || taskData.project_id,
        taskData.title,
        taskData.description || null,
        taskData.status || 'todo',
        taskData.priority || 'medium',
        taskData.assignedTo || taskData.assigned_to || null,
        taskData.createdBy || taskData.created_by,
        taskData.estimatedHours || taskData.estimated_hours || null,
        taskData.actualHours || taskData.actual_hours || 0,
        taskData.dueDate ? formatDateForDB(taskData.dueDate) : (taskData.due_date ? formatDateForDB(taskData.due_date) : null),
        taskData.tags ? JSON.stringify(taskData.tags) : null,
        taskData.storyPoints || taskData.story_points || null,
        taskData.blocked || false,
        taskData.blockedReason || taskData.blocked_reason || null
      ];

  const result = await database.query(query, values);
      
      // Fetch and return the created task
      return await Task.findById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating task: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT t.*, 
               p.name as projectName,
               p.status as projectStatus,
               CONCAT(assignee.first_name, ' ', assignee.last_name) as assigneeName,
               assignee.email as assigneeEmail,
               CONCAT(creator.first_name, ' ', creator.last_name) as createdByName,
               creator.email as createdByEmail
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        LEFT JOIN users creator ON t.created_by = creator.id
        WHERE t.id = ?
      `;
      
      const rows = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }

      return new Task(rows[0]);
    } catch (error) {
      throw new Error(`Error finding task by ID: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      let query = `
        SELECT t.*, 
               p.name as projectName,
               p.status as projectStatus,
               CONCAT(assignee.first_name, ' ', assignee.last_name) as assigneeName,
               assignee.email as assigneeEmail,
               CONCAT(creator.first_name, ' ', creator.last_name) as createdByName,
               creator.email as createdByEmail,
               CASE 
                 WHEN t.due_date < NOW() AND t.status NOT IN ('done') THEN TRUE
                 ELSE FALSE
               END as isOverdue
        FROM tasks t
        LEFT JOIN projects p ON t.project_id = p.id
        LEFT JOIN users assignee ON t.assigned_to = assignee.id
        LEFT JOIN users creator ON t.created_by = creator.id
        WHERE 1=1
      `;
      
      const values = [];

      // Add filtering options
      if (options.projectId) {
        query += ' AND t.project_id = ?';
        values.push(options.projectId);
      }

      if (options.status) {
        query += ' AND t.status = ?';
        values.push(options.status);
      }

      if (options.priority) {
        query += ' AND t.priority = ?';
        values.push(options.priority);
      }

      if (options.assignedTo) {
        query += ' AND t.assigned_to = ?';
        values.push(options.assignedTo);
      }

      if (options.createdBy) {
        query += ' AND t.created_by = ?';
        values.push(options.createdBy);
      }

      if (options.overdue) {
        query += ' AND t.due_date < NOW() AND t.status NOT IN (\'done\')';
      }

      if (options.search) {
        query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        const searchTerm = `%${options.search}%`;
        values.push(searchTerm, searchTerm);
      }

    // Add ordering with sanitization
    const allowedOrderBy = new Set(['created_at', 'updated_at', 'due_date', 'priority', 'status']);
    const orderBy = allowedOrderBy.has(options.orderBy) ? options.orderBy : 'created_at';
    const orderDir = (options.orderDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY t.${orderBy} ${orderDir}`;

      // Add pagination
      if (options.limit) {
        query += ' LIMIT ?';
        values.push(parseInt(options.limit));
        
        if (options.offset) {
          query += ' OFFSET ?';
          values.push(parseInt(options.offset));
        }
      }

  const rows = await database.query(query, values);
      return rows.map(row => new Task(row));
    } catch (error) {
      throw new Error(`Error finding tasks: ${error.message}`);
    }
  }

  static async findByProject(projectId, options = {}) {
    return await Task.findAll({ ...options, projectId });
  }

  static async findByUser(userId, options = {}) {
    return await Task.findAll({ ...options, assignedTo: userId });
  }

  static async count(options = {}) {
    try {
      let query = 'SELECT COUNT(*) as total FROM tasks WHERE 1=1';
      const values = [];

      if (options.projectId) {
        query += ' AND project_id = ?';
        values.push(options.projectId);
      }

      if (options.status) {
        query += ' AND status = ?';
        values.push(options.status);
      }

      if (options.assignedTo) {
        query += ' AND assigned_to = ?';
        values.push(options.assignedTo);
      }

      if (options.overdue) {
        query += ' AND due_date < NOW() AND status NOT IN (\'done\')';
      }
      const rows = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting tasks: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];

      // Build dynamic update query
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          if (key === 'dueDate' || key === 'completedAt') {
            const column = key === 'dueDate' ? 'due_date' : 'completed_at';
            fields.push(`${column} = ?`);
            values.push(updateData[key] ? formatDateForDB(updateData[key]) : null);
          } else if (key === 'tags') {
            fields.push('tags = ?');
            const v = updateData[key];
            values.push(typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : null));
          } else {
            // Map camelCase to snake_case for known fields
            const column =
              key === 'projectId' ? 'project_id' :
              key === 'assignedTo' ? 'assigned_to' :
              key === 'createdBy' ? 'created_by' :
              key === 'estimatedHours' ? 'estimated_hours' :
              key === 'actualHours' ? 'actual_hours' :
              key === 'storyPoints' ? 'story_points' :
              key === 'blockedReason' ? 'blocked_reason' :
              key;
            fields.push(`${column} = ?`);
            values.push(updateData[key]);
          }
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      // Automatically set completedAt when status changes to 'done'
      if (updateData.status === 'done' && !updateData.completedAt) {
        fields.push('completed_at = NOW()');
      } else if (updateData.status && updateData.status !== 'done') {
        fields.push('completed_at = NULL');
      }

      // Add updated timestamp
  fields.push('updated_at = NOW()');
      values.push(id);

      const query = `UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`;
      await database.query(query, values);

      return await Task.findById(id);
    } catch (error) {
      throw new Error(`Error updating task: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
  const query = 'DELETE FROM tasks WHERE id = ?';
  const result = await database.query(query, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting task: ${error.message}`);
    }
  }

  static async updateStatus(id, status) {
    try {
      const updateData = { status };
      
      // Set completedAt when marking as done
      if (status === 'done') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }

      return await Task.update(id, updateData);
    } catch (error) {
      throw new Error(`Error updating task status: ${error.message}`);
    }
  }

  static async assign(id, userId) {
    try {
  return await Task.update(id, { assignedTo: userId });
    } catch (error) {
      throw new Error(`Error assigning task: ${error.message}`);
    }
  }

  // Instance methods
  async save() {
    try {
      if (this.id) {
        // Update existing task
        return await Task.update(this.id, this.toObject());
      } else {
        // Create new task
        const created = await Task.create(this.toObject());
        this.id = created.id;
        this.createdAt = created.createdAt;
        this.updatedAt = created.updatedAt;
        return this;
      }
    } catch (error) {
      throw new Error(`Error saving task: ${error.message}`);
    }
  }

  async getComments() {
    try {
      const query = `
        SELECT tc.*, 
               CONCAT(u.first_name, ' ', u.last_name) as userName,
               u.email as userEmail,
               u.avatar_url as userAvatar
        FROM task_comments tc
        INNER JOIN users u ON tc.user_id = u.id
        WHERE tc.task_id = ?
        ORDER BY tc.created_at ASC
      `;
      
      const rows = await database.query(query, [this.id]);
      return rows;
    } catch (error) {
      throw new Error(`Error getting task comments: ${error.message}`);
    }
  }

  async addComment(userId, comment) {
    try {
      const query = `
        INSERT INTO task_comments (task_id, user_id, comment, created_at)
        VALUES (?, ?, ?, NOW())
      `;
      
      const result = await database.query(query, [this.id, userId, comment]);
      return result.insertId;
    } catch (error) {
      throw new Error(`Error adding task comment: ${error.message}`);
    }
  }

  async getTimeTracking() {
    try {
      if (!this.startDate || !this.completedAt) {
        return null;
      }

      const start = new Date(this.startDate);
      const end = new Date(this.completedAt);
      const diffInHours = (end - start) / (1000 * 60 * 60);

      return {
        startDate: this.startDate,
        completedAt: this.completedAt,
        actualHours: this.actualHours,
        calculatedHours: diffInHours,
        estimatedHours: this.estimatedHours,
        variance: this.estimatedHours ? diffInHours - this.estimatedHours : null
      };
    } catch (error) {
      throw new Error(`Error calculating time tracking: ${error.message}`);
    }
  }

  toObject() {
    return {
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      assignedTo: this.assignedTo,
      createdBy: this.createdBy,
      estimatedHours: this.estimatedHours,
      actualHours: this.actualHours,
      dueDate: this.dueDate,
      completedAt: this.completedAt,
      tags: this.tags,
      storyPoints: this.storyPoints,
      blocked: this.blocked,
      blockedReason: this.blockedReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Static helpers expected by services
  static async getComments(taskId) {
    const query = `
      SELECT tc.*, 
             CONCAT(u.first_name, ' ', u.last_name) as userName,
             u.email as userEmail,
             u.avatar_url as userAvatar
      FROM task_comments tc
      INNER JOIN users u ON tc.user_id = u.id
      WHERE tc.task_id = ?
      ORDER BY tc.created_at ASC
    `;
    return await database.query(query, [taskId]);
  }

  static async hasUserAccess(taskId, userId) {
    const query = `
      SELECT 1
      FROM tasks t
      LEFT JOIN project_members pm ON pm.project_id = t.project_id
      WHERE t.id = ?
        AND (t.assigned_to = ? OR t.created_by = ? OR pm.user_id = ?)
      LIMIT 1
    `;
    const rows = await database.query(query, [taskId, userId, userId, userId]);
    return rows.length > 0;
  }

  static async findByAssignee(userId, options = {}) {
    return await Task.findAll({ ...options, assignedTo: userId });
  }

  static async findByUserAccess(userId, projectIds = [], options = {}) {
    let query = `
      SELECT t.*, 
             p.name as projectName,
             p.status as projectStatus,
             CONCAT(assignee.first_name, ' ', assignee.last_name) as assigneeName,
             CONCAT(creator.first_name, ' ', creator.last_name) as createdByName
      FROM tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE (t.assigned_to = ? OR t.created_by = ?`;
    const params = [userId, userId];

    if (Array.isArray(projectIds) && projectIds.length > 0) {
      const placeholders = projectIds.map(() => '?').join(',');
      query += ` OR t.project_id IN (${placeholders})`;
      params.push(...projectIds);
    }

    query += ')';

    // apply filters similar to findAll
    if (options.status) { query += ' AND t.status = ?'; params.push(options.status); }
    if (options.priority) { query += ' AND t.priority = ?'; params.push(options.priority); }
    if (options.projectId) { query += ' AND t.project_id = ?'; params.push(options.projectId); }
    if (options.assignedTo) { query += ' AND t.assigned_to = ?'; params.push(options.assignedTo); }
    if (options.search) { const s = `%${options.search}%`; query += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(s, s); }
    if (options.overdue) { query += " AND t.due_date < NOW() AND t.status NOT IN ('done')"; }

    const allowedOrderBy = new Set(['created_at', 'updated_at', 'due_date', 'priority', 'status']);
    const orderBy = allowedOrderBy.has(options.orderBy) ? options.orderBy : 'created_at';
    const orderDir = (options.orderDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    query += ` ORDER BY t.${orderBy} ${orderDir}`;

    if (options.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(options.limit));
      if (options.offset) { query += ' OFFSET ?'; params.push(parseInt(options.offset)); }
    }

    const rows = await database.query(query, params);
    return rows.map(row => new Task(row));
  }

  toJSON() {
    return this.toObject();
  }

  get isOverdue() {
    if (!this.dueDate || this.status === 'done') {
      return false;
    }
    return new Date(this.dueDate) < new Date();
  }

  get daysUntilDue() {
    if (!this.dueDate) {
      return null;
    }
    const now = new Date();
    const due = new Date(this.dueDate);
    const diffInDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    return diffInDays;
  }

  get completionTime() {
    if (!this.startDate || !this.completedAt) {
      return null;
    }
    const start = new Date(this.startDate);
    const end = new Date(this.completedAt);
    return (end - start) / (1000 * 60 * 60); // Hours
  }

  // Validation methods
  static validateCreate(data) {
    const errors = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Task title is required');
    }

    if (!data.projectId) {
      errors.push('Project ID is required');
    }

    if (!data.createdBy) {
      errors.push('Created by user ID is required');
    }

    if (data.status && !['todo', 'in_progress', 'in_review', 'done'].includes(data.status)) {
      errors.push('Invalid status specified');
    }

    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      errors.push('Invalid priority specified');
    }

    if (data.estimatedHours && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) {
      errors.push('Estimated hours must be a positive number');
    }

    if (data.actualHours && (isNaN(data.actualHours) || data.actualHours < 0)) {
      errors.push('Actual hours must be a positive number');
    }

    if (data.dueDate && isNaN(new Date(data.dueDate))) {
      errors.push('Invalid due date format');
    }

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.title !== undefined && data.title.trim().length === 0) {
      errors.push('Task title cannot be empty');
    }

    if (data.status && !['todo', 'in_progress', 'in_review', 'done'].includes(data.status)) {
      errors.push('Invalid status specified');
    }

    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      errors.push('Invalid priority specified');
    }

    if (data.estimatedHours !== undefined && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) {
      errors.push('Estimated hours must be a positive number');
    }

    if (data.actualHours !== undefined && (isNaN(data.actualHours) || data.actualHours < 0)) {
      errors.push('Actual hours must be a positive number');
    }

    if (data.dueDate !== undefined && data.dueDate !== null && isNaN(new Date(data.dueDate))) {
      errors.push('Invalid due date format');
    }

    return errors;
  }
}

export default Task;