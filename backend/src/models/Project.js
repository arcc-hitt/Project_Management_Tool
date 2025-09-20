import database from '../config/database.js';
import { formatDateForDB, snakeToCamel, camelToSnake } from '../utils/helpers.js';

class Project {
  constructor(data = {}) {
    // Accept both camelCase (from services) and snake_case (from database)
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.status = data.status || 'planning';
    this.priority = data.priority || 'medium';
    this.startDate = data.startDate || data.start_date;
    this.endDate = data.endDate || data.end_date;
    this.budget = data.budget;
    this.actualCost = data.actualCost || data.actual_cost;
    this.progressPercentage = data.progressPercentage || data.progress_percentage || 0;
    this.repositoryUrl = data.repositoryUrl || data.repository_url;
    this.tags = data.tags;
    this.createdBy = data.createdBy || data.created_by;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  // Static methods for database operations
  static async create(projectData) {
    try {
      const query = `
        INSERT INTO projects (name, description, status, priority, start_date, end_date, 
                             budget, actual_cost, progress_percentage, repository_url, tags, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const values = [
        projectData.name,
        projectData.description || null,
        projectData.status || 'planning',
        projectData.priority || 'medium',
        projectData.startDate ? formatDateForDB(projectData.startDate) : (projectData.start_date ? formatDateForDB(projectData.start_date) : null),
        projectData.endDate ? formatDateForDB(projectData.endDate) : (projectData.end_date ? formatDateForDB(projectData.end_date) : null),
        projectData.budget || null,
        projectData.actualCost || projectData.actual_cost || null,
        projectData.progressPercentage || projectData.progress_percentage || 0,
        projectData.repositoryUrl || projectData.repository_url || null,
        projectData.tags ? JSON.stringify(projectData.tags) : null,
        projectData.createdBy || projectData.created_by
      ];

      const [result] = await database.query(query, values);
      
      // Fetch and return the created project
      return await Project.findById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating project: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT p.*, 
               CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
               u.email as created_by_email
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE p.id = ?
      `;
      
      const [rows] = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }

      return new Project(rows[0]);
    } catch (error) {
      throw new Error(`Error finding project by ID: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      let query = `
        SELECT p.*, 
               CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
               u.email as created_by_email,
               COUNT(DISTINCT pm.user_id) as member_count,
               COUNT(DISTINCT t.id) as total_tasks,
               COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks
        FROM projects p
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE 1=1
      `;
      
      const values = [];

      // Add filtering options
      if (options.status) {
        query += ' AND p.status = ?';
        values.push(options.status);
      }

      if (options.priority) {
        query += ' AND p.priority = ?';
        values.push(options.priority);
      }

      if (options.created_by) {
        query += ' AND p.created_by = ?';
        values.push(options.created_by);
      }

      if (options.search) {
        query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        const searchTerm = `%${options.search}%`;
        values.push(searchTerm, searchTerm);
      }

      // Group by project
      query += ' GROUP BY p.id, u.first_name, u.last_name, u.email';

      // Add ordering
      query += ' ORDER BY p.created_at DESC';

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
      return rows.map(row => new Project(row));
    } catch (error) {
      throw new Error(`Error finding projects: ${error.message}`);
    }
  }

  static async findByUser(userId, options = {}) {
    try {
      let query = `
        SELECT p.*, 
               pm.role as member_role,
               pm.joined_at,
               CONCAT(u.first_name, ' ', u.last_name) as created_by_name,
               COUNT(DISTINCT t.id) as total_tasks,
               COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        LEFT JOIN users u ON p.created_by = u.id
        LEFT JOIN tasks t ON p.id = t.project_id
        WHERE pm.user_id = ?
      `;
      
      const values = [userId];

      if (options.status) {
        query += ' AND p.status = ?';
        values.push(options.status);
      }

      query += ' GROUP BY p.id, pm.role, pm.joined_at, u.first_name, u.last_name';
      query += ' ORDER BY pm.joined_at DESC';

      const [rows] = await database.query(query, values);
      return rows.map(row => new Project(row));
    } catch (error) {
      throw new Error(`Error finding projects by user: ${error.message}`);
    }
  }

  static async count(options = {}) {
    try {
      let query = 'SELECT COUNT(*) as total FROM projects WHERE 1=1';
      const values = [];

      if (options.status) {
        query += ' AND status = ?';
        values.push(options.status);
      }

      if (options.created_by) {
        query += ' AND created_by = ?';
        values.push(options.created_by);
      }

      const [rows] = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting projects: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];

      // Build dynamic update query
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          if (key === 'startDate' || key === 'endDate') {
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

      // Add updated timestamp
      fields.push('updatedAt = NOW()');
      values.push(id);

      const query = `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`;
      await database.query(query, values);

      return await Project.findById(id);
    } catch (error) {
      throw new Error(`Error updating project: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      // Soft delete - set isActive to false
      const query = 'UPDATE projects SET isActive = FALSE, updatedAt = NOW() WHERE id = ?';
      const [result] = await database.query(query, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting project: ${error.message}`);
    }
  }

  // Instance methods
  async save() {
    try {
      if (this.id) {
        // Update existing project
        return await Project.update(this.id, this.toObject());
      } else {
        // Create new project
        const created = await Project.create(this.toObject());
        this.id = created.id;
        this.createdAt = created.createdAt;
        this.updatedAt = created.updatedAt;
        return this;
      }
    } catch (error) {
      throw new Error(`Error saving project: ${error.message}`);
    }
  }

  async getMembers() {
    try {
      const query = `
        SELECT u.id, u.firstName, u.lastName, u.email, u.avatar, u.role as userRole,
               pm.role as projectRole, pm.joinedAt
        FROM project_members pm
        INNER JOIN users u ON pm.userId = u.id
        WHERE pm.projectId = ? AND u.isActive = TRUE
        ORDER BY pm.joinedAt ASC
      `;
      
      const [rows] = await database.query(query, [this.id]);
      return rows;
    } catch (error) {
      throw new Error(`Error getting project members: ${error.message}`);
    }
  }

  async addMember(userId, role = 'developer') {
    try {
      const query = `
        INSERT INTO project_members (projectId, userId, role, joinedAt)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE role = VALUES(role)
      `;
      
      await database.query(query, [this.id, userId, role]);
      return true;
    } catch (error) {
      throw new Error(`Error adding project member: ${error.message}`);
    }
  }

  async removeMember(userId) {
    try {
      const query = 'DELETE FROM project_members WHERE projectId = ? AND userId = ?';
      const [result] = await database.query(query, [this.id, userId]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error removing project member: ${error.message}`);
    }
  }

  async updateMemberRole(userId, role) {
    try {
      const query = 'UPDATE project_members SET role = ? WHERE projectId = ? AND userId = ?';
      const [result] = await database.query(query, [role, this.id, userId]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error updating member role: ${error.message}`);
    }
  }

  async getTasks(options = {}) {
    try {
      let query = `
        SELECT t.*, 
               CONCAT(assignee.firstName, ' ', assignee.lastName) as assigneeName,
               CONCAT(creator.firstName, ' ', creator.lastName) as createdByName,
               us.title as userStoryTitle
        FROM tasks t
        LEFT JOIN users assignee ON t.assignedTo = assignee.id
        LEFT JOIN users creator ON t.createdBy = creator.id
        LEFT JOIN user_stories us ON t.userStoryId = us.id
        WHERE t.projectId = ?
      `;
      
      const values = [this.id];

      if (options.status) {
        query += ' AND t.status = ?';
        values.push(options.status);
      }

      if (options.assignedTo) {
        query += ' AND t.assignedTo = ?';
        values.push(options.assignedTo);
      }

      query += ' ORDER BY t.createdAt DESC';

      if (options.limit) {
        query += ' LIMIT ?';
        values.push(parseInt(options.limit));
      }

      const [rows] = await database.query(query, values);
      return rows;
    } catch (error) {
      throw new Error(`Error getting project tasks: ${error.message}`);
    }
  }

  async getStatistics() {
    try {
      const query = `
        SELECT 
          COUNT(DISTINCT pm.userId) as memberCount,
          COUNT(DISTINCT t.id) as totalTasks,
          COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completedTasks,
          COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) as activeTasks,
          COUNT(DISTINCT CASE WHEN t.dueDate < NOW() AND t.status NOT IN ('done') THEN t.id END) as overdueTasks,
          SUM(t.actualHours) as totalHoursSpent,
          AVG(CASE WHEN t.status = 'done' AND t.completedAt IS NOT NULL 
               THEN TIMESTAMPDIFF(HOUR, t.startDate, t.completedAt) END) as avgCompletionHours
        FROM projects p
        LEFT JOIN project_members pm ON p.id = pm.projectId
        LEFT JOIN tasks t ON p.id = t.projectId
        WHERE p.id = ?
      `;
      
      const [rows] = await database.query(query, [this.id]);
      return rows[0];
    } catch (error) {
      throw new Error(`Error getting project statistics: ${error.message}`);
    }
  }

  toObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this.status,
      priority: this.priority,
      startDate: this.startDate,
      endDate: this.endDate,
      estimatedHours: this.estimatedHours,
      actualHours: this.actualHours,
      createdBy: this.createdBy,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return this.toObject();
  }

  get progressPercentage() {
    if (!this.totalTasks || this.totalTasks === 0) {
      return 0;
    }
    return Math.round((this.completedTasks / this.totalTasks) * 100);
  }

  get isOverdue() {
    if (!this.endDate) {
      return false;
    }
    return new Date(this.endDate) < new Date() && this.status !== 'completed';
  }

  // Validation methods
  static validateCreate(data) {
    const errors = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (!data.createdBy) {
      errors.push('Created by user ID is required');
    }

    if (data.status && !['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(data.status)) {
      errors.push('Invalid status specified');
    }

    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      errors.push('Invalid priority specified');
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (end <= start) {
        errors.push('End date must be after start date');
      }
    }

    if (data.estimatedHours && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) {
      errors.push('Estimated hours must be a positive number');
    }

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.name !== undefined && data.name.trim().length === 0) {
      errors.push('Project name cannot be empty');
    }

    if (data.status && !['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(data.status)) {
      errors.push('Invalid status specified');
    }

    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      errors.push('Invalid priority specified');
    }

    if ((data.startDate || data.endDate)) {
      // If updating dates, validate them
      const start = data.startDate ? new Date(data.startDate) : null;
      const end = data.endDate ? new Date(data.endDate) : null;
      
      if (start && end && end <= start) {
        errors.push('End date must be after start date');
      }
    }

    if (data.estimatedHours !== undefined && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) {
      errors.push('Estimated hours must be a positive number');
    }

    return errors;
  }
}

export default Project;