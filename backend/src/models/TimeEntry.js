import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class TimeEntry {
  constructor(data = {}) {
    this.id = data.id;
    this.taskId = data.taskId || data.task_id;
    this.userId = data.userId || data.user_id;
    this.description = data.description;
    this.hoursSpent = data.hoursSpent || data.hours_spent;
    this.startTime = data.startTime || data.start_time;
    this.endTime = data.endTime || data.end_time;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
    this.userName = data.userName;
    this.taskTitle = data.taskTitle;
    this.projectName = data.projectName;
    this.projectId = data.projectId;
  }

  static async _collection() {
    return database.getCollection('time_entries');
  }

  static async _enrich(rows) {
    if (!rows.length) return [];

    const users = await database.getCollection('users');
    const tasks = await database.getCollection('tasks');
    const projects = await database.getCollection('projects');

    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const taskIds = [...new Set(rows.map((r) => r.taskId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);

    const [userDocs, taskDocs] = await Promise.all([
      users.find({ _id: { $in: userIds } }).toArray(),
      tasks.find({ _id: { $in: taskIds } }).toArray(),
    ]);

    const projectIds = [...new Set(taskDocs.map((t) => t.projectId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const projectDocs = await projects.find({ _id: { $in: projectIds } }).toArray();

    const userMap = new Map(userDocs.map((u) => [normalizeId(u._id), u]));
    const taskMap = new Map(taskDocs.map((t) => [normalizeId(t._id), t]));
    const projectMap = new Map(projectDocs.map((p) => [normalizeId(p._id), p]));

    return rows.map((row) => {
      const mapped = mapDoc(row);
      const user = mapped.userId ? userMap.get(mapped.userId) : null;
      const task = mapped.taskId ? taskMap.get(mapped.taskId) : null;
      const project = task?.projectId ? projectMap.get(task.projectId) : null;

      return new TimeEntry({
        ...mapped,
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null,
        userEmail: user?.email || null,
        userAvatar: user?.avatarUrl || null,
        taskTitle: task?.title || null,
        projectName: project?.name || null,
        projectId: task?.projectId || null,
      });
    });
  }

  static async create(timeEntryData) {
    try {
      const col = await TimeEntry._collection();
      const payload = withTimestampsOnCreate({
        taskId: timeEntryData.taskId,
        userId: timeEntryData.userId,
        description: timeEntryData.description || null,
        hoursSpent: timeEntryData.hoursSpent || timeEntryData.hours_spent || 0,
        startTime: timeEntryData.startTime || null,
        endTime: timeEntryData.endTime || null,
        duration: timeEntryData.duration || null,
      });
      const result = await col.insertOne(payload);
      return TimeEntry.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating time entry: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const col = await TimeEntry._collection();
      const row = await col.findOne({ _id: toObjectId(id) });
      if (!row) return null;
      const [entry] = await TimeEntry._enrich([row]);
      return entry;
    } catch (error) {
      throw new Error(`Error finding time entry: ${error.message}`);
    }
  }

  static async findAll(filters = {}) {
    try {
      const col = await TimeEntry._collection();
      const tasks = await database.getCollection('tasks');

      const query = {};
      if (filters.userId) query.userId = filters.userId;
      if (filters.taskId) query.taskId = filters.taskId;
      if (filters.dateFrom || filters.dateTo) {
        query.startTime = {};
        if (filters.dateFrom) query.startTime.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.startTime.$lte = new Date(filters.dateTo);
      }
      if (filters.search) query.description = { $regex: filters.search, $options: 'i' };

      if (filters.projectId) {
        const taskRows = await tasks.find({ projectId: filters.projectId }).project({ _id: 1 }).toArray();
        query.taskId = { $in: taskRows.map((t) => normalizeId(t._id)) };
      }

      const sortByMap = { start_time: 'startTime', end_time: 'endTime', created_at: 'createdAt', updated_at: 'updatedAt' };
      const sortBy = sortByMap[filters.sortBy] || filters.sortBy || 'startTime';
      const sortOrder = (filters.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 1 : -1;

      const limit = filters.limit ? parseInt(filters.limit, 10) : 0;
      const offset = filters.offset ? parseInt(filters.offset, 10) : 0;

      const rows = await col.find(query).sort({ [sortBy]: sortOrder }).skip(offset).limit(limit || 0).toArray();
      return TimeEntry._enrich(rows);
    } catch (error) {
      throw new Error(`Error finding time entries: ${error.message}`);
    }
  }

  static async findByUser(userId, filters = {}) {
    return TimeEntry.findAll({ userId, ...filters });
  }

  static async findByTask(taskId, filters = {}) {
    return TimeEntry.findAll({ taskId, ...filters });
  }

  static async findByProject(projectId, filters = {}) {
    return TimeEntry.findAll({ projectId, ...filters });
  }

  static async count(filters = {}) {
    const rows = await TimeEntry.findAll(filters);
    return rows.length;
  }

  static async update(id, updateData) {
    try {
      const col = await TimeEntry._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid time entry ID');

      const mapped = {};
      const keyMap = {
        task_id: 'taskId',
        user_id: 'userId',
        hours_spent: 'hoursSpent',
        start_time: 'startTime',
        end_time: 'endTime',
      };

      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined || key === 'id') continue;
        mapped[keyMap[key] || key] = value;
      }

      if (Object.keys(mapped).length === 0) throw new Error('No fields to update');

      await col.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return TimeEntry.findById(id);
    } catch (error) {
      throw new Error(`Error updating time entry: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const col = await TimeEntry._collection();
      const result = await col.deleteOne({ _id: toObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting time entry: ${error.message}`);
    }
  }

  static async getTotalHours(filters = {}) {
    const rows = await TimeEntry.findAll(filters);
    return {
      totalHours: rows.reduce((sum, row) => sum + Number(row.hoursSpent || 0), 0),
      totalEntries: rows.length,
    };
  }

  static async getTimeReport(filters = {}) {
    const rows = await TimeEntry.findAll(filters);
    const groupBy = filters.groupBy || 'date';
    const groups = new Map();

    for (const row of rows) {
      const workDate = row.startTime ? new Date(row.startTime).toISOString().slice(0, 10) : null;
      let key = workDate;
      if (groupBy === 'user') key = `${row.userId}|${row.projectId}|${row.taskId}`;
      if (groupBy === 'project') key = `${row.projectId}|${row.taskId}`;
      if (groupBy === 'task') key = `${row.taskId}|${row.projectId}`;

      if (!groups.has(key)) {
        groups.set(key, {
          projectId: row.projectId,
          projectName: row.projectName,
          taskId: row.taskId,
          taskTitle: row.taskTitle,
          userId: row.userId,
          userName: row.userName,
          totalHours: 0,
          entryCount: 0,
          workDate,
        });
      }

      const g = groups.get(key);
      g.totalHours += Number(row.hoursSpent || 0);
      g.entryCount += 1;
    }

    return [...groups.values()];
  }

  static async startTimer(userId, taskId, description = null) {
    const activeTimer = await TimeEntry.getActiveTimer(userId);
    if (activeTimer) {
      throw new Error('User already has an active timer. Please stop the current timer first.');
    }

    return TimeEntry.create({
      userId,
      taskId,
      description,
      startTime: new Date(),
      billable: true,
    });
  }

  static async stopTimer(userId, timeEntryId = null) {
    let activeTimer;
    if (timeEntryId) {
      activeTimer = await TimeEntry.findById(timeEntryId);
      if (!activeTimer || activeTimer.userId !== userId) {
        throw new Error('Timer not found or access denied');
      }
    } else {
      activeTimer = await TimeEntry.getActiveTimer(userId);
    }

    if (!activeTimer) throw new Error('No active timer found');
    if (activeTimer.endTime) throw new Error('Timer is already stopped');

    const endTime = new Date();
    const startTime = new Date(activeTimer.startTime);
    const duration = Math.round((endTime - startTime) / (1000 * 60));

    return TimeEntry.update(activeTimer.id, { endTime, duration });
  }

  static async getActiveTimer(userId) {
    const col = await TimeEntry._collection();
    const row = await col.find({ userId, endTime: null }).sort({ startTime: -1 }).limit(1).toArray();
    if (!row.length) return null;
    const [entry] = await TimeEntry._enrich(row);
    return entry;
  }

  static validateCreate(data) {
    const errors = [];
    if (!data.taskId) errors.push('Valid task ID is required');
    if (!data.userId) errors.push('Valid user ID is required');
    if (data.description && data.description.length > 500) errors.push('Description cannot exceed 500 characters');

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
    if (data.description !== undefined && data.description.length > 500) errors.push('Description cannot exceed 500 characters');

    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) errors.push('Invalid start or end time format');
      else if (end <= start) errors.push('End time must be after start time');
    }

    if (data.duration !== undefined && (!Number.isInteger(data.duration) || data.duration < 0)) {
      errors.push('Duration must be a non-negative integer (minutes)');
    }

    return errors;
  }
}

export default TimeEntry;
