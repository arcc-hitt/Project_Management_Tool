import database from '../config/database.js';
import { snakeToCamel, camelToSnake } from '../utils/helpers.js';

class Notification {
  constructor(data = {}) {
    // Accept both camelCase (from services) and snake_case (from database)
    this.id = data.id;
    this.userId = data.userId || data.user_id;
    this.title = data.title;
    this.message = data.message;
    this.type = data.type || 'info';
    this.isRead = data.isRead !== undefined ? data.isRead : (data.is_read !== undefined ? data.is_read : false);
    this.createdAt = data.createdAt || data.created_at;
  }

  // Static methods for database operations
  static async create(notificationData) {
    try {
      const query = `
        INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id, is_read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      
      const values = [
        notificationData.userId,
        notificationData.type,
        notificationData.title,
        notificationData.message || null,
        notificationData.entityType,
        notificationData.entityId,
        notificationData.isRead || false
      ];

      const result = await database.query(query, values);
      
      // Fetch and return the created notification
      return await Notification.findById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating notification: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT n.*, 
               CONCAT(u.first_name, ' ', u.last_name) as userName,
               u.email as userEmail
        FROM notifications n
        INNER JOIN users u ON n.user_id = u.id
        WHERE n.id = ?
      `;
      
      const rows = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }

      return new Notification(rows[0]);
    } catch (error) {
      throw new Error(`Error finding notification by ID: ${error.message}`);
    }
  }

  static async findByUser(userId, options = {}) {
    try {
      let query = `
        SELECT n.*
        FROM notifications n
        WHERE n.user_id = ?
      `;
      
      const values = [userId];

      // Add filtering options
      if (options.isRead !== undefined) {
        query += ' AND n.is_read = ?';
        values.push(options.isRead);
      }

      if (options.type) {
        query += ' AND n.type = ?';
        values.push(options.type);
      }

      // entityType filter retained if entity_type column exists
      if (options.entityType) {
        query += ' AND n.entity_type = ?';
        values.push(options.entityType);
      }

      // Add date filter
      if (options.since) {
        query += ' AND n.created_at >= ?';
        values.push(options.since);
      }

      // Add ordering
  query += ' ORDER BY n.created_at DESC';

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
      return rows.map(row => new Notification(row));
    } catch (error) {
      throw new Error(`Error finding notifications by user: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      let query = `
        SELECT n.*, 
               CONCAT(u.first_name, ' ', u.last_name) as userName,
               u.email as userEmail
        FROM notifications n
        INNER JOIN users u ON n.user_id = u.id
        WHERE 1=1
      `;
      
      const values = [];

      // Add filtering options
      if (options.userId) {
        query += ' AND n.user_id = ?';
        values.push(options.userId);
      }

      if (options.type) {
        query += ' AND n.type = ?';
        values.push(options.type);
      }

      if (options.isRead !== undefined) {
        query += ' AND n.is_read = ?';
        values.push(options.isRead);
      }

      // Add ordering
  query += ' ORDER BY n.created_at DESC';

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
      return rows.map(row => new Notification(row));
    } catch (error) {
      throw new Error(`Error finding notifications: ${error.message}`);
    }
  }

  static async count(options = {}) {
    try {
      let query = 'SELECT COUNT(*) as total FROM notifications WHERE 1=1';
      const values = [];

      if (options.userId) {
        query += ' AND user_id = ?';
        values.push(options.userId);
      }

      if (options.isRead !== undefined) {
        query += ' AND is_read = ?';
        values.push(options.isRead);
      }

      if (options.type) {
        query += ' AND type = ?';
        values.push(options.type);
      }

  const rows = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting notifications: ${error.message}`);
    }
  }

  static async markAsRead(id) {
    try {
  const query = 'UPDATE notifications SET is_read = TRUE WHERE id = ?';
  const result = await database.query(query, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error marking notification as read: ${error.message}`);
    }
  }

  static async markAllAsRead(userId) {
    try {
  const query = 'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE';
  const result = await database.query(query, [userId]);
      
      return result.affectedRows;
    } catch (error) {
      throw new Error(`Error marking all notifications as read: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
  const query = 'DELETE FROM notifications WHERE id = ?';
  const result = await database.query(query, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting notification: ${error.message}`);
    }
  }

  static async deleteOld(days = 30) {
    try {
  const query = 'DELETE FROM notifications WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)';
  const result = await database.query(query, [days]);
      
      return result.affectedRows;
    } catch (error) {
      throw new Error(`Error deleting old notifications: ${error.message}`);
    }
  }

  // Notification creation helpers
  static async createTaskAssigned(taskId, assigneeId, assignerId) {
    try {
      // Get task details
  const taskQuery = 'SELECT title, project_id FROM tasks WHERE id = ?';
  const taskRows = await database.query(taskQuery, [taskId]);
      
      if (taskRows.length === 0) {
        throw new Error('Task not found');
      }

      const task = taskRows[0];

      // Get assigner name
  const userQuery = 'SELECT first_name, last_name FROM users WHERE id = ?';
  const userRows = await database.query(userQuery, [assignerId]);
      
      const assignerName = userRows.length > 0 
  ? `${userRows[0].first_name} ${userRows[0].last_name}` 
        : 'Someone';

      return await Notification.create({
        userId: assigneeId,
        type: 'task_assigned',
        title: 'New Task Assigned',
        message: `${assignerName} assigned you the task: "${task.title}"`,
        entityType: 'task',
        entityId: taskId
      });
    } catch (error) {
      throw new Error(`Error creating task assigned notification: ${error.message}`);
    }
  }

  static async createTaskUpdated(taskId, updaterId, changes) {
    try {
      // Get task details and assignee
      const taskQuery = `
        SELECT title, assignedTo, projectId 
        FROM tasks 
        WHERE id = ?
      `;
  const taskRows = await database.query(taskQuery, [taskId]);
      
      if (taskRows.length === 0 || !taskRows[0].assignedTo) {
        return null;
      }

      const task = taskRows[0];

      // Don't notify if the assignee updated their own task
      if (task.assignedTo === updaterId) {
        return null;
      }

      // Get updater name
  const userQuery = 'SELECT first_name, last_name FROM users WHERE id = ?';
  const userRows = await database.query(userQuery, [updaterId]);
      
      const updaterName = userRows.length > 0 
  ? `${userRows[0].first_name} ${userRows[0].last_name}` 
        : 'Someone';

      const changeDescription = Object.keys(changes).join(', ');

      return await Notification.create({
        userId: task.assignedTo,
        type: 'task_updated',
        title: 'Task Updated',
        message: `${updaterName} updated the task: "${task.title}" (${changeDescription})`,
        entityType: 'task',
        entityId: taskId
      });
    } catch (error) {
      throw new Error(`Error creating task updated notification: ${error.message}`);
    }
  }

  static async createTaskCompleted(taskId, completerId) {
    try {
      // Get task details and project members
      const taskQuery = `
        SELECT t.title, t.project_id, t.created_by, t.assigned_to,
               p.name as projectName
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE t.id = ?
      `;
      const taskRows = await database.query(taskQuery, [taskId]);
      
      if (taskRows.length === 0) {
        return [];
      }

      const task = taskRows[0];

      // Get project managers and task creator
      const membersQuery = `
        SELECT DISTINCT u.id
        FROM project_members pm
        INNER JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ? 
        AND pm.role IN ('manager') 
        AND u.id != ?
      `;
      const memberRows = await database.query(membersQuery, [task.project_id, completerId]);

      // Get completer name
  const userQuery = 'SELECT first_name, last_name FROM users WHERE id = ?';
  const userRows = await database.query(userQuery, [completerId]);
      
      const completerName = userRows.length > 0 
  ? `${userRows[0].first_name} ${userRows[0].last_name}` 
        : 'Someone';

      const notifications = [];

      // Notify project managers
      for (const member of memberRows) {
        const notification = await Notification.create({
          userId: member.id,
          type: 'task_completed',
          title: 'Task Completed',
          message: `${completerName} completed the task: "${task.title}" in ${task.projectName}`,
          entityType: 'task',
          entityId: taskId
        });
        notifications.push(notification);
      }

      // Notify task creator if different from completer and not already notified
      if (task.created_by !== completerId && !memberRows.some(m => m.id === task.created_by)) {
        const notification = await Notification.create({
          userId: task.created_by,
          type: 'task_completed',
          title: 'Task Completed',
          message: `${completerName} completed the task: "${task.title}"`,
          entityType: 'task',
          entityId: taskId
        });
        notifications.push(notification);
      }

      return notifications;
    } catch (error) {
      throw new Error(`Error creating task completed notifications: ${error.message}`);
    }
  }

  static async createCommentAdded(commentId, taskId, commenterId) {
    try {
      // Get task details
      const taskQuery = `
        SELECT t.title, t.assigned_to, t.created_by, t.project_id
        FROM tasks t
        WHERE t.id = ?
      `;
      const taskRows = await database.query(taskQuery, [taskId]);
      
      if (taskRows.length === 0) {
        return [];
      }

      const task = taskRows[0];

      // Get commenter name
  const userQuery = 'SELECT first_name, last_name FROM users WHERE id = ?';
  const userRows = await database.query(userQuery, [commenterId]);
      
      const commenterName = userRows.length > 0 
  ? `${userRows[0].first_name} ${userRows[0].last_name}` 
        : 'Someone';

      const notifications = [];
      const notifiedUsers = new Set([commenterId]);

      // Notify assignee
      if (task.assigned_to && !notifiedUsers.has(task.assigned_to)) {
        const notification = await Notification.create({
          userId: task.assigned_to,
          type: 'comment_added',
          title: 'New Comment',
          message: `${commenterName} commented on the task: "${task.title}"`,
          entityType: 'task',
          entityId: taskId
        });
        notifications.push(notification);
        notifiedUsers.add(task.assigned_to);
      }

      // Notify task creator
      if (task.created_by && !notifiedUsers.has(task.created_by)) {
        const notification = await Notification.create({
          userId: task.created_by,
          type: 'comment_added',
          title: 'New Comment',
          message: `${commenterName} commented on the task: "${task.title}"`,
          entityType: 'task',
          entityId: taskId
        });
        notifications.push(notification);
        notifiedUsers.add(task.created_by);
      }

      return notifications;
    } catch (error) {
      throw new Error(`Error creating comment added notifications: ${error.message}`);
    }
  }

  static async createDeadlineReminder(taskId) {
    try {
      // Get task details
      const taskQuery = `
        SELECT title, assigned_to, due_date
        FROM tasks 
        WHERE id = ? AND assigned_to IS NOT NULL
      `;
      const taskRows = await database.query(taskQuery, [taskId]);
      
      if (taskRows.length === 0) {
        return null;
      }

  const task = taskRows[0];
  const dueDate = new Date(task.due_date);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

      let message;
      if (daysUntilDue <= 0) {
        message = `Task "${task.title}" is overdue!`;
      } else if (daysUntilDue === 1) {
        message = `Task "${task.title}" is due tomorrow!`;
      } else {
        message = `Task "${task.title}" is due in ${daysUntilDue} days`;
      }

      return await Notification.create({
        userId: task.assigned_to,
        type: 'deadline_reminder',
        title: 'Deadline Reminder',
        message,
        entityType: 'task',
        entityId: taskId
      });
    } catch (error) {
      throw new Error(`Error creating deadline reminder: ${error.message}`);
    }
  }

  // Instance methods
  async save() {
    try {
      if (this.id) {
        // Update existing notification (limited to isRead status)
        return await Notification.markAsRead(this.id);
      } else {
        // Create new notification
        const created = await Notification.create(this.toObject());
        this.id = created.id;
        this.createdAt = created.createdAt;
        return this;
      }
    } catch (error) {
      throw new Error(`Error saving notification: ${error.message}`);
    }
  }

  toObject() {
    return {
      id: this.id,
      userId: this.userId,
      type: this.type,
      title: this.title,
      message: this.message,
      entityType: this.entityType,
      entityId: this.entityId,
      isRead: this.isRead,
      createdAt: this.createdAt
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
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d ago`;
    }
  }

  // Validation methods
  static validateCreate(data) {
    const errors = [];

    if (!data.userId) {
      errors.push('User ID is required');
    }

    if (!data.type) {
      errors.push('Notification type is required');
    }

    if (data.type && !['task_assigned', 'task_updated', 'task_completed', 'project_updated', 'comment_added', 'deadline_reminder'].includes(data.type)) {
      errors.push('Invalid notification type');
    }

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Notification title is required');
    }

    if (!data.entityType) {
      errors.push('Entity type is required');
    }

    if (data.entityType && !['task', 'project', 'user_story', 'comment'].includes(data.entityType)) {
      errors.push('Invalid entity type');
    }

    if (!data.entityId) {
      errors.push('Entity ID is required');
    }

    return errors;
  }
}

export default Notification;