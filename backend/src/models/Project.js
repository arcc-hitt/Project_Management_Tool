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
  // Use a private backing field to avoid clashing with getter below
  this._progressPercentage = data.progressPercentage ?? data.progress_percentage ?? 0;
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

  const result = await database.query(query, values);
      
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
      
  const rows = await database.query(query, [id]);
      
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

  const rows = await database.query(query, values);
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

  const rows = await database.query(query, values);
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

  const rows = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting projects: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];

      // Build dynamic update query mapping camelCase -> snake_case
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          // Map known fields explicitly to avoid [object Object] errors
          const column =
            key === 'startDate' ? 'start_date' :
            key === 'endDate' ? 'end_date' :
            key === 'actualCost' ? 'actual_cost' :
            key === 'progressPercentage' ? 'progress_percentage' :
            key === 'repositoryUrl' ? 'repository_url' :
            key;
          if (column === 'start_date' || column === 'end_date') {
            fields.push(`${column} = ?`);
            values.push(updateData[key] ? formatDateForDB(updateData[key]) : null);
          } else if (column === 'tags') {
            // Ensure tags is stored as JSON
            const v = updateData[key];
            fields.push(`${column} = ?`);
            values.push(typeof v === 'string' ? v : (v != null ? JSON.stringify(v) : null));
          } else {
            fields.push(`${column} = ?`);
            values.push(updateData[key]);
          }
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      // Add updated timestamp
      fields.push('updated_at = NOW()');
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
      // Hard delete to align with schema (no is_active column)
      const query = 'DELETE FROM projects WHERE id = ?';
      const result = await database.query(query, [id]);
      
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
        const created = await Project.create({ ...this.toObject(), createdBy: this.createdBy });
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
      return await Project.getMembers(this.id);
    } catch (error) {
      throw new Error(`Error getting project members: ${error.message}`);
    }
  }

  async addMember(userId, role = 'developer') {
    try {
      return await Project.addMember(this.id, userId, role);
    } catch (error) {
      throw new Error(`Error adding project member: ${error.message}`);
    }
  }

  async removeMember(userId) {
    try {
      return await Project.removeMember(this.id, userId);
    } catch (error) {
      throw new Error(`Error removing project member: ${error.message}`);
    }
  }

  async updateMemberRole(userId, role) {
    try {
      return await Project.updateMemberRole(this.id, userId, role);
    } catch (error) {
      throw new Error(`Error updating member role: ${error.message}`);
    }
  }

  async getTasks(options = {}) {
    try {
      return await Project.getTasks(this.id, options);
    } catch (error) {
      throw new Error(`Error getting project tasks: ${error.message}`);
    }
  }

  async getStatistics() {
    try {
      return await Project.getStatistics(this.id);
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
      budget: this.budget,
      actualCost: this.actualCost,
      progressPercentage: this._progressPercentage,
      repositoryUrl: this.repositoryUrl,
      tags: this.tags,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return this.toObject();
  }

  get progressPercentage() {
    // If aggregated counts are present, compute dynamic percentage; otherwise use stored value
    if (this.totalTasks !== undefined && this.completedTasks !== undefined) {
      if (!this.totalTasks || this.totalTasks === 0) return 0;
      return Math.round((this.completedTasks / this.totalTasks) * 100);
    }
    return this._progressPercentage ?? 0;
  }

  set progressPercentage(value) {
    this._progressPercentage = value;
  }

  get isOverdue() {
    if (!this.endDate) {
      return false;
    }
    return new Date(this.endDate) < new Date() && this.status !== 'completed';
  }

  // Static helpers used by services
  static async isMember(projectId, userId) {
    const query = 'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ? LIMIT 1';
    const rows = await database.query(query, [projectId, userId]);
    return rows.length > 0;
  }

  static async getMembers(projectId) {
    const query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.avatar_url, u.role AS user_role,
        pm.role AS project_role, pm.joined_at
      FROM project_members pm
      INNER JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ? AND u.is_active = TRUE
      ORDER BY pm.joined_at ASC
    `;
    return await database.query(query, [projectId]);
  }

  static async addMember(projectId, userId, role = 'developer') {
    const query = `
      INSERT INTO project_members (project_id, user_id, role, joined_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE role = VALUES(role)
    `;
    await database.query(query, [projectId, userId, role]);
    return true;
  }

  static async removeMember(projectId, userId) {
    const query = 'DELETE FROM project_members WHERE project_id = ? AND user_id = ?';
    const result = await database.query(query, [projectId, userId]);
    return result.affectedRows > 0;
  }

  static async updateMemberRole(projectId, userId, role) {
    const query = 'UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?';
    const result = await database.query(query, [role, projectId, userId]);
    return result.affectedRows > 0;
  }

  static async getTasks(projectId, options = {}) {
    let query = `
      SELECT t.*,
             CONCAT(assignee.first_name, ' ', assignee.last_name) AS assignee_name,
             CONCAT(creator.first_name, ' ', creator.last_name) AS created_by_name
      FROM tasks t
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN users creator ON t.created_by = creator.id
      WHERE t.project_id = ?
    `;
    const values = [projectId];

    if (options.status) {
      query += ' AND t.status = ?';
      values.push(options.status);
    }

    if (options.assignedTo) {
      query += ' AND t.assigned_to = ?';
      values.push(options.assignedTo);
    }

    query += ' ORDER BY t.created_at DESC';

    if (options.limit) {
      query += ' LIMIT ?';
      values.push(parseInt(options.limit));
    }

    return await database.query(query, values);
  }

  static async getStatistics(projectId) {
    const query = `
      SELECT 
        COUNT(DISTINCT pm.user_id) AS memberCount,
        COUNT(DISTINCT t.id) AS totalTasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) AS completedTasks,
        COUNT(DISTINCT CASE WHEN t.status = 'in_progress' THEN t.id END) AS activeTasks,
        COUNT(DISTINCT CASE WHEN t.due_date < NOW() AND t.status NOT IN ('done') THEN t.id END) AS overdueTasks,
        SUM(t.actual_hours) AS totalHoursSpent,
        NULL AS avgCompletionHours
      FROM projects p
      LEFT JOIN project_members pm ON p.id = pm.project_id
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE p.id = ?
    `;
    const rows = await database.query(query, [projectId]);
    return rows[0] || {
      memberCount: 0,
      totalTasks: 0,
      completedTasks: 0,
      activeTasks: 0,
      overdueTasks: 0,
      totalHoursSpent: 0,
      avgCompletionHours: null
    };
  }

  static async findByMemberId(userId, options = {}) {
    // Alias to findByUser for service compatibility
    return await Project.findByUser(userId, options);
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