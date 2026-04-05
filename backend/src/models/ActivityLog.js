import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate } from '../utils/mongo.js';

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
    this.userName = data.userName;
    this.userEmail = data.userEmail;
    this.userAvatar = data.userAvatar;
  }

  static async _collection() {
    return database.getCollection('activity_logs');
  }

  static async create(activityData) {
    try {
      const logs = await ActivityLog._collection();
      const payload = withTimestampsOnCreate({
        userId: activityData.userId,
        action: activityData.action,
        entityType: activityData.entityType,
        entityId: activityData.entityId,
        oldValues: activityData.oldValues || null,
        newValues: activityData.newValues || null,
      });
      const result = await logs.insertOne(payload);
      return ActivityLog.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating activity log: ${error.message}`);
    }
  }

  static async _enrich(rows) {
    if (!rows.length) return [];
    const users = await database.getCollection('users');
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const userDocs = await users.find({ _id: { $in: userIds } }).toArray();
    const userMap = new Map(userDocs.map((u) => [normalizeId(u._id), u]));

    return rows.map((row) => {
      const mapped = mapDoc(row);
      const user = mapped.userId ? userMap.get(mapped.userId) : null;
      return new ActivityLog({
        ...mapped,
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null,
        userEmail: user?.email || null,
        userAvatar: user?.avatarUrl || null,
      });
    });
  }

  static async findById(id) {
    try {
      const logs = await ActivityLog._collection();
      const row = await logs.findOne({ _id: toObjectId(id) });
      if (!row) return null;
      const [log] = await ActivityLog._enrich([row]);
      return log;
    } catch (error) {
      throw new Error(`Error finding activity log: ${error.message}`);
    }
  }

  static async findAll(filters = {}) {
    try {
      const logs = await ActivityLog._collection();
      const query = {};
      if (filters.entityType) query.entityType = filters.entityType;
      if (filters.entityId) query.entityId = filters.entityId;
      if (filters.userId) query.userId = filters.userId;
      if (filters.action) query.action = filters.action;
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      const limit = filters.limit ? parseInt(filters.limit, 10) : 0;
      const offset = filters.offset ? parseInt(filters.offset, 10) : 0;
      const rows = await logs.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit || 0).toArray();
      return ActivityLog._enrich(rows);
    } catch (error) {
      throw new Error(`Error finding activity logs: ${error.message}`);
    }
  }

  static async findByEntity(entityType, entityId, options = {}) {
    return ActivityLog.findAll({ entityType, entityId, ...options });
  }

  static async findByUser(userId, options = {}) {
    return ActivityLog.findAll({ userId, ...options });
  }

  static async count(filters = {}) {
    try {
      const logs = await ActivityLog._collection();
      const query = {};
      if (filters.entityType) query.entityType = filters.entityType;
      if (filters.entityId) query.entityId = filters.entityId;
      if (filters.userId) query.userId = filters.userId;
      if (filters.action) query.action = filters.action;
      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }
      return await logs.countDocuments(query);
    } catch (error) {
      throw new Error(`Error counting activity logs: ${error.message}`);
    }
  }

  static async deleteOld(daysToKeep = 90) {
    try {
      const logs = await ActivityLog._collection();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(daysToKeep));
      const result = await logs.deleteMany({ createdAt: { $lt: cutoff } });
      return result.deletedCount;
    } catch (error) {
      throw new Error(`Error deleting old activity logs: ${error.message}`);
    }
  }

  static async logProjectActivity(userId, action, projectId, oldValues = null, newValues = null) {
    return ActivityLog.create({ userId, action, entityType: 'project', entityId: projectId, oldValues, newValues });
  }

  static async logTaskActivity(userId, action, taskId, oldValues = null, newValues = null) {
    return ActivityLog.create({ userId, action, entityType: 'task', entityId: taskId, oldValues, newValues });
  }

  static async logUserActivity(userId, action, targetUserId, oldValues = null, newValues = null) {
    return ActivityLog.create({ userId, action, entityType: 'user', entityId: targetUserId, oldValues, newValues });
  }

  static async logCommentActivity(userId, action, commentId, oldValues = null, newValues = null) {
    return ActivityLog.create({ userId, action, entityType: 'comment', entityId: commentId, oldValues, newValues });
  }

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
      LOGOUT: 'logout',
    };
  }

  static get ENTITY_TYPES() {
    return {
      PROJECT: 'project',
      TASK: 'task',
      USER: 'user',
      COMMENT: 'comment',
      FILE: 'file',
      TIME_ENTRY: 'time_entry',
    };
  }
}

export default ActivityLog;
