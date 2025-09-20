import database from '../config/database.js';
import { formatDateForDB } from '../utils/helpers.js';

class TimeEntry {
  constructor(data = {}) {
    this.id = data.id;
    this.taskId = data.taskId;
    this.userId = data.userId;
    this.description = data.description;
    this.startTime = data.startTime;
    this.endTime = data.endTime;
    this.duration = data.duration; // in minutes
    this.billable = data.billable !== undefined ? data.billable : true;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Static methods for database operations
  static async create(timeEntryData) {
    try {
      // Calculate duration if start and end times are provided
      let duration = timeEntryData.duration;
      if (!duration && timeEntryData.startTime && timeEntryData.endTime) {
        const start = new Date(timeEntryData.startTime);
        const end = new Date(timeEntryData.endTime);
        duration = Math.round((end - start) / (1000 * 60)); // duration in minutes
      }

      const query = `
        INSERT INTO time_entries (task_id, user_id, description, start_time, end_time, 
                                 duration, billable, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const values = [
        timeEntryData.taskId,
        timeEntryData.userId,
        timeEntryData.description || null,
        timeEntryData.startTime ? formatDateForDB(timeEntryData.startTime) : null,
        timeEntryData.endTime ? formatDateForDB(timeEntryData.endTime) : null,
        duration || 0,
        timeEntryData.billable !== undefined ? timeEntryData.billable : true
      ];

      const [result] = await database.query(query, values);
      
      // Fetch and return the created time entry
      return await TimeEntry.findById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating time entry: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT te.*, 
               CONCAT(u.firstName, ' ', u.lastName) as userName,
               u.email as userEmail,
               u.avatar as userAvatar,
               t.title as taskTitle,
               p.name as projectName,
               p.id as projectId
        FROM time_entries te
        INNER JOIN users u ON te.user_id = u.id
        INNER JOIN tasks t ON te.task_id = t.id
        INNER JOIN projects p ON t.projectId = p.id
        WHERE te.id = ?
      `;
      
      const [rows] = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const data = rows[0];
      return new TimeEntry({
        id: data.id,
        taskId: data.task_id,
        userId: data.user_id,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        duration: data.duration,
        billable: data.billable,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userName: data.userName,
        userEmail: data.userEmail,
        userAvatar: data.userAvatar,
        taskTitle: data.taskTitle,
        projectName: data.projectName,
        projectId: data.projectId
      });
    } catch (error) {
      throw new Error(`Error finding time entry: ${error.message}`);
    }
  }

  static async findAll(filters = {}) {
    try {
      let query = `
        SELECT te.*, 
               CONCAT(u.firstName, ' ', u.lastName) as userName,
               u.email as userEmail,
               u.avatar as userAvatar,
               t.title as taskTitle,
               p.name as projectName,
               p.id as projectId
        FROM time_entries te
        INNER JOIN users u ON te.user_id = u.id
        INNER JOIN tasks t ON te.task_id = t.id
        INNER JOIN projects p ON t.projectId = p.id
        WHERE 1=1
      `;
      
      const values = [];
      
      // Apply filters
      if (filters.userId) {
        query += ` AND te.user_id = ?`;
        values.push(filters.userId);
      }
      
      if (filters.taskId) {
        query += ` AND te.task_id = ?`;
        values.push(filters.taskId);
      }
      
      if (filters.projectId) {
        query += ` AND p.id = ?`;
        values.push(filters.projectId);
      }
      
      if (filters.billable !== undefined) {
        query += ` AND te.billable = ?`;
        values.push(filters.billable);
      }
      
      if (filters.dateFrom) {
        query += ` AND DATE(te.start_time) >= ?`;
        values.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ` AND DATE(te.start_time) <= ?`;
        values.push(filters.dateTo);
      }
      
      if (filters.search) {
        query += ` AND (te.description LIKE ? OR t.title LIKE ? OR p.name LIKE ?)`;
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm);
      }
      
      // Add ordering
      const sortBy = filters.sortBy || 'start_time';
      const sortOrder = filters.sortOrder || 'DESC';
      query += ` ORDER BY te.${sortBy} ${sortOrder}`;
      
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
      
      return rows.map(data => new TimeEntry({
        id: data.id,
        taskId: data.task_id,
        userId: data.user_id,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        duration: data.duration,
        billable: data.billable,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userName: data.userName,
        userEmail: data.userEmail,
        userAvatar: data.userAvatar,
        taskTitle: data.taskTitle,
        projectName: data.projectName,
        projectId: data.projectId
      }));
    } catch (error) {
      throw new Error(`Error finding time entries: ${error.message}`);
    }
  }

  static async findByUser(userId, filters = {}) {
    try {
      const mergedFilters = { userId, ...filters };
      return await TimeEntry.findAll(mergedFilters);
    } catch (error) {
      throw new Error(`Error finding time entries by user: ${error.message}`);
    }
  }

  static async findByTask(taskId, filters = {}) {
    try {
      const mergedFilters = { taskId, ...filters };
      return await TimeEntry.findAll(mergedFilters);
    } catch (error) {
      throw new Error(`Error finding time entries by task: ${error.message}`);
    }
  }

  static async findByProject(projectId, filters = {}) {
    try {
      const mergedFilters = { projectId, ...filters };
      return await TimeEntry.findAll(mergedFilters);
    } catch (error) {
      throw new Error(`Error finding time entries by project: ${error.message}`);
    }
  }

  static async count(filters = {}) {
    try {
      let query = `
        SELECT COUNT(*) as total
        FROM time_entries te
        INNER JOIN tasks t ON te.task_id = t.id
        INNER JOIN projects p ON t.projectId = p.id
        WHERE 1=1
      `;
      
      const values = [];
      
      // Apply same filters as findAll
      if (filters.userId) {
        query += ` AND te.user_id = ?`;
        values.push(filters.userId);
      }
      
      if (filters.taskId) {
        query += ` AND te.task_id = ?`;
        values.push(filters.taskId);
      }
      
      if (filters.projectId) {
        query += ` AND p.id = ?`;
        values.push(filters.projectId);
      }
      
      if (filters.billable !== undefined) {
        query += ` AND te.billable = ?`;
        values.push(filters.billable);
      }
      
      if (filters.dateFrom) {
        query += ` AND DATE(te.start_time) >= ?`;
        values.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ` AND DATE(te.start_time) <= ?`;
        values.push(filters.dateTo);
      }
      
      if (filters.search) {
        query += ` AND (te.description LIKE ? OR t.title LIKE ? OR p.name LIKE ?)`;
        const searchTerm = `%${filters.search}%`;
        values.push(searchTerm, searchTerm, searchTerm);
      }
      
      const [rows] = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting time entries: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      // Recalculate duration if start and end times are being updated
      if (updateData.startTime || updateData.endTime) {
        const existing = await TimeEntry.findById(id);
        if (!existing) {
          throw new Error('Time entry not found');
        }
        
        const startTime = updateData.startTime || existing.startTime;
        const endTime = updateData.endTime || existing.endTime;
        
        if (startTime && endTime) {
          const start = new Date(startTime);
          const end = new Date(endTime);
          updateData.duration = Math.round((end - start) / (1000 * 60));
        }
      }

      // Build dynamic update query
      const fields = [];
      const values = [];
      
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          fields.push(`${key === 'taskId' ? 'task_id' : 
                          key === 'userId' ? 'user_id' :
                          key === 'startTime' ? 'start_time' :
                          key === 'endTime' ? 'end_time' : key} = ?`);
          
          if (key === 'startTime' || key === 'endTime') {
            values.push(formatDateForDB(updateData[key]));
          } else {
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
      
      const query = `UPDATE time_entries SET ${fields.join(', ')} WHERE id = ?`;
      await database.query(query, values);
      
      return await TimeEntry.findById(id);
    } catch (error) {
      throw new Error(`Error updating time entry: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const query = 'DELETE FROM time_entries WHERE id = ?';
      const [result] = await database.query(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting time entry: ${error.message}`);
    }
  }

  // Reporting methods
  static async getTotalHours(filters = {}) {
    try {
      let query = `
        SELECT 
          SUM(te.duration) as totalMinutes,
          SUM(CASE WHEN te.billable = true THEN te.duration ELSE 0 END) as billableMinutes,
          COUNT(*) as totalEntries
        FROM time_entries te
        INNER JOIN tasks t ON te.task_id = t.id
        INNER JOIN projects p ON t.projectId = p.id
        WHERE 1=1
      `;
      
      const values = [];
      
      // Apply filters
      if (filters.userId) {
        query += ` AND te.user_id = ?`;
        values.push(filters.userId);
      }
      
      if (filters.projectId) {
        query += ` AND p.id = ?`;
        values.push(filters.projectId);
      }
      
      if (filters.taskId) {
        query += ` AND te.task_id = ?`;
        values.push(filters.taskId);
      }
      
      if (filters.dateFrom) {
        query += ` AND DATE(te.start_time) >= ?`;
        values.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ` AND DATE(te.start_time) <= ?`;
        values.push(filters.dateTo);
      }
      
      const [rows] = await database.query(query, values);
      const result = rows[0];
      
      return {
        totalHours: Math.round((result.totalMinutes || 0) / 60 * 100) / 100,
        billableHours: Math.round((result.billableMinutes || 0) / 60 * 100) / 100,
        totalEntries: result.totalEntries || 0
      };
    } catch (error) {
      throw new Error(`Error calculating total hours: ${error.message}`);
    }
  }

  static async getTimeReport(filters = {}) {
    try {
      let query = `
        SELECT 
          p.id as projectId,
          p.name as projectName,
          t.id as taskId,
          t.title as taskTitle,
          u.id as userId,
          CONCAT(u.firstName, ' ', u.lastName) as userName,
          SUM(te.duration) as totalMinutes,
          SUM(CASE WHEN te.billable = true THEN te.duration ELSE 0 END) as billableMinutes,
          COUNT(te.id) as entryCount,
          DATE(te.start_time) as workDate
        FROM time_entries te
        INNER JOIN tasks t ON te.task_id = t.id
        INNER JOIN projects p ON t.projectId = p.id
        INNER JOIN users u ON te.user_id = u.id
        WHERE 1=1
      `;
      
      const values = [];
      
      // Apply filters
      if (filters.userId) {
        query += ` AND te.user_id = ?`;
        values.push(filters.userId);
      }
      
      if (filters.projectId) {
        query += ` AND p.id = ?`;
        values.push(filters.projectId);
      }
      
      if (filters.taskId) {
        query += ` AND te.task_id = ?`;
        values.push(filters.taskId);
      }
      
      if (filters.dateFrom) {
        query += ` AND DATE(te.start_time) >= ?`;
        values.push(filters.dateFrom);
      }
      
      if (filters.dateTo) {
        query += ` AND DATE(te.start_time) <= ?`;
        values.push(filters.dateTo);
      }
      
      // Group by
      const groupBy = filters.groupBy || 'date';
      switch (groupBy) {
        case 'user':
          query += ` GROUP BY u.id, p.id, t.id ORDER BY userName, projectName, taskTitle`;
          break;
        case 'project':
          query += ` GROUP BY p.id, t.id ORDER BY projectName, taskTitle`;
          break;
        case 'task':
          query += ` GROUP BY t.id ORDER BY projectName, taskTitle`;
          break;
        case 'date':
        default:
          query += ` GROUP BY DATE(te.start_time), p.id, t.id, u.id ORDER BY workDate DESC, projectName, taskTitle`;
          break;
      }
      
      const [rows] = await database.query(query, values);
      
      return rows.map(row => ({
        projectId: row.projectId,
        projectName: row.projectName,
        taskId: row.taskId,
        taskTitle: row.taskTitle,
        userId: row.userId,
        userName: row.userName,
        totalHours: Math.round((row.totalMinutes || 0) / 60 * 100) / 100,
        billableHours: Math.round((row.billableMinutes || 0) / 60 * 100) / 100,
        entryCount: row.entryCount,
        workDate: row.workDate
      }));
    } catch (error) {
      throw new Error(`Error generating time report: ${error.message}`);
    }
  }

  static async startTimer(userId, taskId, description = null) {
    try {
      // Check if user already has an active timer
      const activeTimer = await TimeEntry.getActiveTimer(userId);
      if (activeTimer) {
        throw new Error('User already has an active timer. Please stop the current timer first.');
      }

      const timeEntryData = {
        userId,
        taskId,
        description,
        startTime: new Date(),
        billable: true
      };

      return await TimeEntry.create(timeEntryData);
    } catch (error) {
      throw new Error(`Error starting timer: ${error.message}`);
    }
  }

  static async stopTimer(userId, timeEntryId = null) {
    try {
      let activeTimer;
      
      if (timeEntryId) {
        activeTimer = await TimeEntry.findById(timeEntryId);
        if (!activeTimer || activeTimer.userId !== userId) {
          throw new Error('Timer not found or access denied');
        }
      } else {
        activeTimer = await TimeEntry.getActiveTimer(userId);
      }

      if (!activeTimer) {
        throw new Error('No active timer found');
      }

      if (activeTimer.endTime) {
        throw new Error('Timer is already stopped');
      }

      const endTime = new Date();
      const startTime = new Date(activeTimer.startTime);
      const duration = Math.round((endTime - startTime) / (1000 * 60));

      return await TimeEntry.update(activeTimer.id, {
        endTime,
        duration
      });
    } catch (error) {
      throw new Error(`Error stopping timer: ${error.message}`);
    }
  }

  static async getActiveTimer(userId) {
    try {
      const query = `
        SELECT te.*, 
               CONCAT(u.firstName, ' ', u.lastName) as userName,
               t.title as taskTitle,
               p.name as projectName,
               p.id as projectId
        FROM time_entries te
        INNER JOIN users u ON te.user_id = u.id
        INNER JOIN tasks t ON te.task_id = t.id
        INNER JOIN projects p ON t.projectId = p.id
        WHERE te.user_id = ? AND te.end_time IS NULL
        ORDER BY te.start_time DESC
        LIMIT 1
      `;
      
      const [rows] = await database.query(query, [userId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const data = rows[0];
      return new TimeEntry({
        id: data.id,
        taskId: data.task_id,
        userId: data.user_id,
        description: data.description,
        startTime: data.start_time,
        endTime: data.end_time,
        duration: data.duration,
        billable: data.billable,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        userName: data.userName,
        taskTitle: data.taskTitle,
        projectName: data.projectName,
        projectId: data.projectId
      });
    } catch (error) {
      throw new Error(`Error getting active timer: ${error.message}`);
    }
  }

  // Validation methods
  static validateCreate(data) {
    const errors = [];

    if (!data.taskId || !Number.isInteger(data.taskId) || data.taskId <= 0) {
      errors.push('Valid task ID is required');
    }

    if (!data.userId || !Number.isInteger(data.userId) || data.userId <= 0) {
      errors.push('Valid user ID is required');
    }

    if (data.description && data.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push('Invalid start or end time format');
      } else if (end <= start) {
        errors.push('End time must be after start time');
      }
    }

    if (data.duration !== undefined && (!Number.isInteger(data.duration) || data.duration < 0)) {
      errors.push('Duration must be a non-negative integer (minutes)');
    }

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.description !== undefined && data.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }

    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push('Invalid start or end time format');
      } else if (end <= start) {
        errors.push('End time must be after start time');
      }
    }

    if (data.duration !== undefined && (!Number.isInteger(data.duration) || data.duration < 0)) {
      errors.push('Duration must be a non-negative integer (minutes)');
    }

    return errors;
  }
}

export default TimeEntry;