import database from '../config/database.js';

class ActivityLog {
  constructor(data = {}) {
    this.id = data.id;
    this.userId = data.userId;
    this.action = data.action;
    this.entityType = data.entityType;
    this.entityId = data.entityId;
    this.oldValues = data.oldValues;
    this.newValues = data.newValues;
    this.createdAt = data.createdAt;
  }

  // Static methods for database operations
  static async create(activityData) {
    try {
      const query = `
        INSERT INTO activity_logs (user_id, action, entity_type, entity_id, old_values, new_values, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
      
      const values = [
        activityData.userId,
        activityData.action,
        activityData.entityType,
        activityData.entityId,
        activityData.oldValues ? JSON.stringify(activityData.oldValues) : null,
        activityData.newValues ? JSON.stringify(activityData.newValues) : null
      ];

      const [result] = await database.query(query, values);
      
      // Fetch and return the created activity log
      return await ActivityLog.findById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating activity log: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT al.*, 
               CONCAT(u.firstName, ' ', u.lastName) as userName,
               u.email as userEmail,
               u.avatar as userAvatar
        FROM activity_logs al
        INNER JOIN users u ON al.user_id = u.id
        WHERE al.id = ?
      `;
      
      const [rows] = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const data = rows[0];
      
      // Parse JSON fields
      if (data.old_values) {
        try {
          data.oldValues = JSON.parse(data.old_values);
        } catch (e) {
          data.oldValues = null;
        }
      }
      
      if (data.new_values) {
        try {
          data.newValues = JSON.parse(data.new_values);
        } catch (e) {
          data.newValues = null;
        }
      }
      
      return new ActivityLog({
        id: data.id,
        userId: data.user_id,
        action: data.action,
        entityType: data.entity_type,
        entityId: data.entity_id,
        oldValues: data.oldValues,
        newValues: data.newValues,
        createdAt: data.created_at,
        userName: data.userName,
        userEmail: data.userEmail,
        userAvatar: data.userAvatar
      });
    } catch (error) {
      throw new Error(`Error finding activity log: ${error.message}`);
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT al.*, 
               CONCAT(u.firstName, ' ', u.lastName) as userName,
               u.email as userEmail,
               u.avatar as userAvatar
        FROM activity_logs al
        INNER JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      
      const values = [];
      
      // Apply filters
      if (filters.entityType) {
        query += ` AND al.entity_type = ?`;
        values.push(filters.entityType);
      }
      
      if (filters.entityId) {
        query += ` AND al.entity_id = ?`;
        values.push(filters.entityId);
      }
      
      if (filters.userId) {
        query += ` AND al.user_id = ?`;
        values.push(filters.userId);
      }
      
      if (filters.action) {
        query += ` AND al.action = ?`;
        values.push(filters.action);
      }
      
      if (filters.dateFrom) {
        query += ` AND al.created_at >= ?`;
        values.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ` AND al.created_at <= ?`;
        values.push(filters.dateTo);
      }
      
      // Add ordering
      query += ` ORDER BY al.created_at DESC`;
      
      // Add pagination
      if (filters.limit) {
        query += ` LIMIT ?`;
        values.push(parseInt(filters.limit));
        
        if (filters.offset) {
          query += ` OFFSET ?`;
          values.push(parseInt(filters.offset));
        }
      }
      
      const [rows] = await database.query(query, values);
      
      return rows.map(data => {
        // Parse JSON fields
        if (data.old_values) {
          try {
            data.oldValues = JSON.parse(data.old_values);
          } catch (e) {
            data.oldValues = null;
          }
        }
        
        if (data.new_values) {
          try {
            data.newValues = JSON.parse(data.new_values);
          } catch (e) {
            data.newValues = null;
          }
        }
        
        return new ActivityLog({
          id: data.id,
          userId: data.user_id,
          action: data.action,
          entityType: data.entity_type,
          entityId: data.entity_id,
          oldValues: data.oldValues,
          newValues: data.newValues,
          createdAt: data.created_at,
          userName: data.userName,
          userEmail: data.userEmail,
          userAvatar: data.userAvatar
        });
      });
    } catch (error) {
      throw new Error(`Error finding activity logs: ${error.message}`);
    }
  }

  static async findByEntity(entityType, entityId, options = {}) {
    try {
      const filters = {
        entityType,
        entityId,
        ...options
      };
      
      return await ActivityLog.findAll(filters);
    } catch (error) {
      throw new Error(`Error finding activity logs by entity: ${error.message}`);
    }
  }

  static async findByUser(userId, options = {}) {
    try {
      const filters = {
        userId,
        ...options
      };
      
      return await ActivityLog.findAll(filters);
    } catch (error) {
      throw new Error(`Error finding activity logs by user: ${error.message}`);
    }
  }

  static async count(filters = {}) {
    try {
      let query = `
        SELECT COUNT(*) as total
        FROM activity_logs al
        WHERE 1=1
      `;
      
      const values = [];
      
      // Apply same filters as findAll
      if (filters.entityType) {
        query += ` AND al.entity_type = ?`;
        values.push(filters.entityType);
      }
      
      if (filters.entityId) {
        query += ` AND al.entity_id = ?`;
        values.push(filters.entityId);
      }
      
      if (filters.userId) {
        query += ` AND al.user_id = ?`;
        values.push(filters.userId);
      }
      
      if (filters.action) {
        query += ` AND al.action = ?`;
        values.push(filters.action);
      }
      
      if (filters.dateFrom) {
        query += ` AND al.created_at >= ?`;
        values.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ` AND al.created_at <= ?`;
        values.push(filters.dateTo);
      }
      
      const [rows] = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting activity logs: ${error.message}`);
    }
  }

  static async deleteOld(daysToKeep = 90) {
    try {
      const query = `
        DELETE FROM activity_logs 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;
      
      const [result] = await database.query(query, [daysToKeep]);
      return result.affectedRows;
    } catch (error) {
      throw new Error(`Error deleting old activity logs: ${error.message}`);
    }
  }

  // Helper methods for common activity types
  static async logProjectActivity(userId, action, projectId, oldValues = null, newValues = null) {
    return await ActivityLog.create({
      userId,
      action,
      entityType: 'project',
      entityId: projectId,
      oldValues,
      newValues
    });
  }

  static async logTaskActivity(userId, action, taskId, oldValues = null, newValues = null) {
    return await ActivityLog.create({
      userId,
      action,
      entityType: 'task',
      entityId: taskId,
      oldValues,
      newValues
    });
  }

  static async logUserActivity(userId, action, targetUserId, oldValues = null, newValues = null) {
    return await ActivityLog.create({
      userId,
      action,
      entityType: 'user',
      entityId: targetUserId,
      oldValues,
      newValues
    });
  }

  static async logCommentActivity(userId, action, commentId, oldValues = null, newValues = null) {
    return await ActivityLog.create({
      userId,
      action,
      entityType: 'comment',
      entityId: commentId,
      oldValues,
      newValues
    });
  }

  // Activity type constants
  static get ACTIONS() {
    return {
      CREATE: 'create',
      UPDATE: 'update',
      DELETE: 'delete',
      ASSIGN: 'assign',
      UNASSIGN: 'unassign',
      COMPLETE: 'complete',
      REOPEN: 'reopen',
      ARCHIVE: 'archive',
      RESTORE: 'restore',
      COMMENT: 'comment',
      UPLOAD: 'upload',
      DOWNLOAD: 'download',
      LOGIN: 'login',
      LOGOUT: 'logout'
    };
  }

  static get ENTITY_TYPES() {
    return {
      PROJECT: 'project',
      TASK: 'task',
      USER: 'user',
      COMMENT: 'comment',
      FILE: 'file',
      TIME_ENTRY: 'time_entry'
    };
  }
}

export default ActivityLog;