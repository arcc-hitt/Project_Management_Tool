import database from '../config/database.js';
import { snakeToCamel, camelToSnake } from '../utils/helpers.js';

class ProjectMember {
  constructor(data = {}) {
    // Accept both camelCase (from services) and snake_case (from database)
    this.id = data.id;
    this.projectId = data.projectId || data.project_id;
    this.userId = data.userId || data.user_id;
    this.role = data.role || 'developer';
    this.joinedAt = data.joinedAt || data.joined_at;
  }

  // Static methods for database operations
  static async findAll(where = {}) {
    try {
      let query = 'SELECT * FROM project_members';
      const params = [];
      
      if (Object.keys(where).length > 0) {
        const conditions = Object.keys(where).map(key => {
          params.push(where[key]);
          return `${key} = ?`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      const rows = await database.query(query, params);
      return rows.map(row => new ProjectMember(row));
    } catch (error) {
      throw new Error(`Failed to fetch project members: ${error.message}`);
    }
  }

  static async findByProjectId(projectId) {
    return this.findAll({ projectId });
  }

  static async findByUserId(userId) {
    return this.findAll({ userId });
  }

  static async findOne(where) {
    const results = await this.findAll(where);
    return results[0] || null;
  }

  static async create(data) {
    try {
      const query = `
        INSERT INTO project_members (projectId, userId, role, joinedAt, createdAt, updatedAt)
        VALUES (?, ?, ?, NOW(), NOW(), NOW())
      `;
      const params = [data.projectId, data.userId, data.role || 'member'];
      
      await database.query(query, params);
      
      // Get the created record
      return this.findOne({ projectId: data.projectId, userId: data.userId });
    } catch (error) {
      throw new Error(`Failed to create project member: ${error.message}`);
    }
  }

  async save() {
    try {
      if (this.id) {
        // Update existing record
        const query = `
          UPDATE project_members 
          SET role = ?, updatedAt = NOW()
          WHERE id = ?
        `;
        await database.query(query, [this.role, this.id]);
      } else {
        // Create new record
        const created = await ProjectMember.create(this);
        Object.assign(this, created);
      }
      return this;
    } catch (error) {
      throw new Error(`Failed to save project member: ${error.message}`);
    }
  }

  static async delete(where) {
    try {
      let query = 'DELETE FROM project_members';
      const params = [];
      
      if (Object.keys(where).length > 0) {
        const conditions = Object.keys(where).map(key => {
          params.push(where[key]);
          return `${key} = ?`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      await database.query(query, params);
    } catch (error) {
      throw new Error(`Failed to delete project member: ${error.message}`);
    }
  }
}

export default ProjectMember;