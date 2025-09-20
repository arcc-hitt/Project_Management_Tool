import database from '../config/database.js';

class TaskAssignment {
  constructor(data = {}) {
    this.id = data.id;
    this.taskId = data.taskId;
    this.userId = data.userId;
    this.assignedBy = data.assignedBy;
    this.assignedAt = data.assignedAt;
    this.role = data.role || 'assignee';
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Static methods for database operations
  static async findAll(where = {}) {
    try {
      let query = 'SELECT * FROM task_assignments';
      const params = [];
      
      if (Object.keys(where).length > 0) {
        const conditions = Object.keys(where).map(key => {
          params.push(where[key]);
          return `${key} = ?`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      const rows = await database.query(query, params);
      return rows.map(row => new TaskAssignment(row));
    } catch (error) {
      throw new Error(`Failed to fetch task assignments: ${error.message}`);
    }
  }

  static async findByTaskId(taskId) {
    return this.findAll({ taskId });
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
        INSERT INTO task_assignments (taskId, userId, assignedBy, assignedAt, role, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, NOW(), ?, ?, NOW(), NOW())
      `;
      const params = [
        data.taskId, 
        data.userId, 
        data.assignedBy, 
        data.role || 'assignee',
        data.isActive !== undefined ? data.isActive : true
      ];
      
      await database.query(query, params);
      
      // Get the created record
      return this.findOne({ taskId: data.taskId, userId: data.userId });
    } catch (error) {
      throw new Error(`Failed to create task assignment: ${error.message}`);
    }
  }

  async save() {
    try {
      if (this.id) {
        // Update existing record
        const query = `
          UPDATE task_assignments 
          SET role = ?, isActive = ?, updatedAt = NOW()
          WHERE id = ?
        `;
        await database.query(query, [this.role, this.isActive, this.id]);
      } else {
        // Create new record
        const created = await TaskAssignment.create(this);
        Object.assign(this, created);
      }
      return this;
    } catch (error) {
      throw new Error(`Failed to save task assignment: ${error.message}`);
    }
  }

  static async delete(where) {
    try {
      let query = 'DELETE FROM task_assignments';
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
      throw new Error(`Failed to delete task assignment: ${error.message}`);
    }
  }
}

export default TaskAssignment;