import database from '../config/database.js';
import { snakeToCamel, camelToSnake } from '../utils/helpers.js';

class Comment {
  constructor(data = {}) {
    // Accept both camelCase (from services) and snake_case (from database)
    this.id = data.id;
    this.taskId = data.taskId || data.task_id;
    this.userId = data.userId || data.user_id;
    this.comment = data.comment;
    this.createdAt = data.createdAt || data.created_at;
  }

  // Static methods for database operations
  static async create(commentData) {
    try {
      const query = `
        INSERT INTO task_comments (task_id, user_id, comment, created_at)
        VALUES (?, ?, ?, NOW())
      `;
      
      const values = [
        commentData.taskId || commentData.task_id,
        commentData.userId || commentData.user_id,
        commentData.comment
      ];

  const result = await database.query(query, values);
      
      // Fetch and return the created comment
      return await Comment.findById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating comment: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const query = `
   SELECT tc.*, 
     CONCAT(u.first_name, ' ', u.last_name) as userName,
     u.email as userEmail,
     u.avatar_url as userAvatar,
     u.role as userRole,
     t.title as taskTitle,
     p.name as projectName
   FROM task_comments tc
   INNER JOIN users u ON tc.user_id = u.id
   INNER JOIN tasks t ON tc.task_id = t.id
   INNER JOIN projects p ON t.project_id = p.id
   WHERE tc.id = ?
      `;
      
      const rows = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }

      return new Comment(rows[0]);
    } catch (error) {
      throw new Error(`Error finding comment by ID: ${error.message}`);
    }
  }

  static async findByTask(taskId, options = {}) {
    try {
      let query = `
        SELECT tc.*, 
     CONCAT(u.first_name, ' ', u.last_name) as userName,
     u.email as userEmail,
     u.avatar_url as userAvatar,
               u.role as userRole
   FROM task_comments tc
   INNER JOIN users u ON tc.user_id = u.id
   WHERE tc.task_id = ?
      `;
      
      const values = [taskId];

      // Add ordering
      const orderDir = options.orderDir || 'ASC';
  query += ` ORDER BY tc.created_at ${orderDir}`;

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
      return rows.map(row => new Comment(row));
    } catch (error) {
      throw new Error(`Error finding comments by task: ${error.message}`);
    }
  }

  static async findByUser(userId, options = {}) {
    try {
      let query = `
        SELECT tc.*, 
     CONCAT(u.first_name, ' ', u.last_name) as userName,
     u.email as userEmail,
     u.avatar_url as userAvatar,
               t.title as taskTitle,
               p.name as projectName
   FROM task_comments tc
   INNER JOIN users u ON tc.user_id = u.id
   INNER JOIN tasks t ON tc.task_id = t.id
   INNER JOIN projects p ON t.project_id = p.id
   WHERE tc.user_id = ?
      `;
      
      const values = [userId];

      // Add project filter
      if (options.projectId) {
        query += ' AND p.id = ?';
        values.push(options.projectId);
      }

      // Add ordering
  query += ' ORDER BY tc.created_at DESC';

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
      return rows.map(row => new Comment(row));
    } catch (error) {
      throw new Error(`Error finding comments by user: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      let query = `
        SELECT tc.*, 
     CONCAT(u.first_name, ' ', u.last_name) as userName,
     u.email as userEmail,
     u.avatar_url as userAvatar,
               t.title as taskTitle,
               p.name as projectName
   FROM task_comments tc
   INNER JOIN users u ON tc.user_id = u.id
   INNER JOIN tasks t ON tc.task_id = t.id
   INNER JOIN projects p ON t.project_id = p.id
        WHERE 1=1
      `;
      
      const values = [];

      // Add filtering options
      if (options.projectId) {
        query += ' AND p.id = ?';
        values.push(options.projectId);
      }

      if (options.taskId) {
        query += ' AND tc.task_id = ?';
        values.push(options.taskId);
      }

      if (options.userId) {
        query += ' AND tc.user_id = ?';
        values.push(options.userId);
      }

      if (options.search) {
        query += ' AND tc.comment LIKE ?';
        values.push(`%${options.search}%`);
      }

      // Add ordering
  query += ' ORDER BY tc.created_at DESC';

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
      return rows.map(row => new Comment(row));
    } catch (error) {
      throw new Error(`Error finding comments: ${error.message}`);
    }
  }

  static async count(options = {}) {
    try {
      let query = `
        SELECT COUNT(*) as total 
        FROM task_comments tc
        INNER JOIN tasks t ON tc.task_id = t.id
        INNER JOIN projects p ON t.project_id = p.id
        WHERE 1=1
      `;
      const values = [];

      if (options.projectId) {
        query += ' AND p.id = ?';
        values.push(options.projectId);
      }

      if (options.taskId) {
        query += ' AND tc.task_id = ?';
        values.push(options.taskId);
      }

      if (options.userId) {
        query += ' AND tc.user_id = ?';
        values.push(options.userId);
      }

  const rows = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting comments: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];

      // Build dynamic update query
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      // Add updated timestamp
  fields.push('updated_at = NOW()');
      values.push(id);

      const query = `UPDATE task_comments SET ${fields.join(', ')} WHERE id = ?`;
      await database.query(query, values);

      return await Comment.findById(id);
    } catch (error) {
      throw new Error(`Error updating comment: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const query = 'DELETE FROM task_comments WHERE id = ?';
  const result = await database.query(query, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting comment: ${error.message}`);
    }
  }

  static async getRecentActivity(options = {}) {
    try {
      let query = `
        SELECT tc.*, 
     CONCAT(u.first_name, ' ', u.last_name) as userName,
     u.avatar_url as userAvatar,
               t.title as taskTitle,
               p.name as projectName,
               p.id as projectId
   FROM task_comments tc
   INNER JOIN users u ON tc.user_id = u.id
   INNER JOIN tasks t ON tc.task_id = t.id
   INNER JOIN projects p ON t.project_id = p.id
   WHERE tc.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      `;
      
      const values = [options.days || 7];

      if (options.projectId) {
        query += ' AND p.id = ?';
        values.push(options.projectId);
      }

      if (options.userId) {
        query += ' AND tc.user_id = ?';
        values.push(options.userId);
      }

      query += ' ORDER BY tc.created_at DESC';

      if (options.limit) {
        query += ' LIMIT ?';
        values.push(parseInt(options.limit));
      }

  const rows = await database.query(query, values);
      return rows.map(row => new Comment(row));
    } catch (error) {
      throw new Error(`Error getting recent comment activity: ${error.message}`);
    }
  }

  // Instance methods
  async save() {
    try {
      if (this.id) {
        // Update existing comment
        return await Comment.update(this.id, this.toObject());
      } else {
        // Create new comment
        const created = await Comment.create(this.toObject());
        this.id = created.id;
        this.createdAt = created.createdAt;
        this.updatedAt = created.updatedAt;
        return this;
      }
    } catch (error) {
      throw new Error(`Error saving comment: ${error.message}`);
    }
  }

  async getTask() {
    try {
      const query = `
        SELECT t.*, p.name as projectName
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE t.id = ?
      `;
      
      const rows = await database.query(query, [this.taskId]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error getting task for comment: ${error.message}`);
    }
  }

  async getUser() {
    try {
      const query = `
        SELECT id, first_name as firstName, last_name as lastName, email, avatar_url as avatar, role
        FROM users
        WHERE id = ? AND is_active = TRUE
      `;
      
      const rows = await database.query(query, [this.userId]);
      return rows[0] || null;
    } catch (error) {
      throw new Error(`Error getting user for comment: ${error.message}`);
    }
  }

  toObject() {
    return {
      id: this.id,
      taskId: this.taskId,
      userId: this.userId,
      comment: this.comment,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    return this.toObject();
  }

  get timeAgo() {
    if (!this.createdAt) return null;
    
    const now = new Date();
    const created = new Date(this.createdAt);
    const diffInSeconds = Math.floor((now - created) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  }

  // Validation methods
  static validateCreate(data) {
    const errors = [];

    if (!data.taskId) {
      errors.push('Task ID is required');
    }

    if (!data.userId) {
      errors.push('User ID is required');
    }

    if (!data.comment || data.comment.trim().length === 0) {
      errors.push('Comment text is required');
    }

    if (data.comment && data.comment.trim().length > 2000) {
      errors.push('Comment cannot exceed 2000 characters');
    }

    return errors;
  }

  // Alias methods for backward compatibility
  static async findByTaskId(taskId, options = {}) {
    return await Comment.findByTask(taskId, options);
  }

  static async countByTaskId(taskId) {
    return await Comment.count({ taskId });
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.comment !== undefined) {
      if (data.comment.trim().length === 0) {
        errors.push('Comment text cannot be empty');
      } else if (data.comment.trim().length > 2000) {
        errors.push('Comment cannot exceed 2000 characters');
      }
    }

    return errors;
  }
}

export default Comment;