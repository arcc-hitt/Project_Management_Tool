import database from '../config/database.js';
import { formatDateForDB } from '../utils/helpers.js';

class Task {
  constructor(data = {}) {
    this.id = data.id;
    this.projectId = data.projectId;
    this.userStoryId = data.userStoryId;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status || 'todo';
    this.priority = data.priority || 'medium';
    this.assignedTo = data.assignedTo;
    this.createdBy = data.createdBy;
    this.estimatedHours = data.estimatedHours;
    this.actualHours = data.actualHours || 0;
    this.dueDate = data.dueDate;
    this.startDate = data.startDate;
    this.completedAt = data.completedAt;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Static methods for database operations
  static async create(taskData) {
    try {
      const query = `
        INSERT INTO tasks (projectId, userStoryId, title, description, status, priority, 
                          assignedTo, createdBy, estimatedHours, actualHours, dueDate, 
                          startDate, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const values = [
        taskData.projectId,
        taskData.userStoryId || null,
        taskData.title,
        taskData.description || null,
        taskData.status || 'todo',
        taskData.priority || 'medium',
        taskData.assignedTo || null,
        taskData.createdBy,
        taskData.estimatedHours || null,
        taskData.actualHours || 0,
        taskData.dueDate ? formatDateForDB(taskData.dueDate) : null,
        taskData.startDate ? formatDateForDB(taskData.startDate) : null
      ];

      const [result] = await database.query(query, values);
      
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
               CONCAT(assignee.firstName, ' ', assignee.lastName) as assigneeName,
               assignee.email as assigneeEmail,
               CONCAT(creator.firstName, ' ', creator.lastName) as createdByName,
               creator.email as createdByEmail,
               us.title as userStoryTitle
        FROM tasks t
        LEFT JOIN projects p ON t.projectId = p.id
        LEFT JOIN users assignee ON t.assignedTo = assignee.id
        LEFT JOIN users creator ON t.createdBy = creator.id
        LEFT JOIN user_stories us ON t.userStoryId = us.id
        WHERE t.id = ?
      `;
      
      const [rows] = await database.query(query, [id]);
      
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
               CONCAT(assignee.firstName, ' ', assignee.lastName) as assigneeName,
               assignee.email as assigneeEmail,
               CONCAT(creator.firstName, ' ', creator.lastName) as createdByName,
               creator.email as createdByEmail,
               us.title as userStoryTitle,
               CASE 
                 WHEN t.dueDate < NOW() AND t.status NOT IN ('done') THEN TRUE
                 ELSE FALSE
               END as isOverdue
        FROM tasks t
        LEFT JOIN projects p ON t.projectId = p.id
        LEFT JOIN users assignee ON t.assignedTo = assignee.id
        LEFT JOIN users creator ON t.createdBy = creator.id
        LEFT JOIN user_stories us ON t.userStoryId = us.id
        WHERE 1=1
      `;
      
      const values = [];

      // Add filtering options
      if (options.projectId) {
        query += ' AND t.projectId = ?';
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
        query += ' AND t.assignedTo = ?';
        values.push(options.assignedTo);
      }

      if (options.createdBy) {
        query += ' AND t.createdBy = ?';
        values.push(options.createdBy);
      }

      if (options.userStoryId) {
        query += ' AND t.userStoryId = ?';
        values.push(options.userStoryId);
      }

      if (options.overdue) {
        query += ' AND t.dueDate < NOW() AND t.status NOT IN (\'done\')';
      }

      if (options.search) {
        query += ' AND (t.title LIKE ? OR t.description LIKE ?)';
        const searchTerm = `%${options.search}%`;
        values.push(searchTerm, searchTerm);
      }

      // Add ordering
      const orderBy = options.orderBy || 'createdAt';
      const orderDir = options.orderDir || 'DESC';
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

      const [rows] = await database.query(query, values);
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
        query += ' AND projectId = ?';
        values.push(options.projectId);
      }

      if (options.status) {
        query += ' AND status = ?';
        values.push(options.status);
      }

      if (options.assignedTo) {
        query += ' AND assignedTo = ?';
        values.push(options.assignedTo);
      }

      if (options.overdue) {
        query += ' AND dueDate < NOW() AND status NOT IN (\'done\')';
      }

      const [rows] = await database.query(query, values);
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
          if (key === 'dueDate' || key === 'startDate' || key === 'completedAt') {
            fields.push(`${key} = ?`);
            values.push(updateData[key] ? formatDateForDB(updateData[key]) : null);
          } else {
            fields.push(`${key} = ?`);
            values.push(updateData[key]);
          }
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      // Automatically set completedAt when status changes to 'done'
      if (updateData.status === 'done' && !updateData.completedAt) {
        fields.push('completedAt = NOW()');
      } else if (updateData.status && updateData.status !== 'done') {
        fields.push('completedAt = NULL');
      }

      // Add updated timestamp
      fields.push('updatedAt = NOW()');
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
      const [result] = await database.query(query, [id]);
      
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
               CONCAT(u.firstName, ' ', u.lastName) as userName,
               u.email as userEmail,
               u.avatar as userAvatar
        FROM task_comments tc
        INNER JOIN users u ON tc.userId = u.id
        WHERE tc.taskId = ?
        ORDER BY tc.createdAt ASC
      `;
      
      const [rows] = await database.query(query, [this.id]);
      return rows;
    } catch (error) {
      throw new Error(`Error getting task comments: ${error.message}`);
    }
  }

  async addComment(userId, comment) {
    try {
      const query = `
        INSERT INTO task_comments (taskId, userId, comment, createdAt, updatedAt)
        VALUES (?, ?, ?, NOW(), NOW())
      `;
      
      const [result] = await database.query(query, [this.id, userId, comment]);
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
      userStoryId: this.userStoryId,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      assignedTo: this.assignedTo,
      createdBy: this.createdBy,
      estimatedHours: this.estimatedHours,
      actualHours: this.actualHours,
      dueDate: this.dueDate,
      startDate: this.startDate,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
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