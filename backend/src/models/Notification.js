import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class Notification {
  constructor(data = {}) {
    this.id = data.id;
    this.userId = data.userId || data.user_id;
    this.title = data.title;
    this.message = data.message;
    this.type = data.type || 'info';
    this.entityType = data.entityType || data.entity_type;
    this.entityId = data.entityId || data.entity_id;
    this.isRead = data.isRead !== undefined ? data.isRead : (data.is_read !== undefined ? data.is_read : false);
    this.readAt = data.readAt || data.read_at;
    this.createdAt = data.createdAt || data.created_at;
  }

  static async _collection() {
    return database.getCollection('notifications');
  }

  static async create(notificationData) {
    try {
      const col = await Notification._collection();
      const payload = withTimestampsOnCreate({
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message || null,
        entityType: notificationData.entityType || notificationData.relatedEntityType || null,
        entityId: notificationData.entityId || notificationData.relatedEntityId || null,
        isRead: notificationData.isRead || false,
        metadata: notificationData.metadata || null,
      });
      const result = await col.insertOne(payload);
      return Notification.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating notification: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const col = await Notification._collection();
      const row = await col.findOne({ _id: toObjectId(id) });
      return row ? new Notification(mapDoc(row)) : null;
    } catch (error) {
      throw new Error(`Error finding notification by ID: ${error.message}`);
    }
  }

  static async findByUser(userId, options = {}) {
    try {
      const col = await Notification._collection();
      const filter = { userId };
      if (options.isRead !== undefined) filter.isRead = options.isRead;
      if (options.type) filter.type = options.type;
      if (options.entityType) filter.entityType = options.entityType;
      if (options.since) filter.createdAt = { $gte: new Date(options.since) };

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;
      const rows = await col.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit || 0).toArray();
      return rows.map((row) => new Notification(mapDoc(row)));
    } catch (error) {
      throw new Error(`Error finding notifications by user: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const col = await Notification._collection();
      const filter = {};
      if (options.userId) filter.userId = options.userId;
      if (options.type) filter.type = options.type;
      if (options.isRead !== undefined) filter.isRead = options.isRead;

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;
      const rows = await col.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit || 0).toArray();
      return rows.map((row) => new Notification(mapDoc(row)));
    } catch (error) {
      throw new Error(`Error finding notifications: ${error.message}`);
    }
  }

  static async count(options = {}) {
    try {
      const col = await Notification._collection();
      const filter = {};
      if (options.userId) filter.userId = options.userId;
      if (options.isRead !== undefined) filter.isRead = options.isRead;
      if (options.type) filter.type = options.type;
      return await col.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error counting notifications: ${error.message}`);
    }
  }

  static async markAsRead(id) {
    try {
      const col = await Notification._collection();
      const result = await col.updateOne({ _id: toObjectId(id) }, { $set: withUpdatedAt({ isRead: true, readAt: new Date() }) });
      return result.modifiedCount > 0;
    } catch (error) {
      throw new Error(`Error marking notification as read: ${error.message}`);
    }
  }

  static async markAllAsRead(userId) {
    try {
      const col = await Notification._collection();
      const result = await col.updateMany({ userId, isRead: false }, { $set: withUpdatedAt({ isRead: true, readAt: new Date() }) });
      return result.modifiedCount;
    } catch (error) {
      throw new Error(`Error marking all notifications as read: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const col = await Notification._collection();
      const result = await col.deleteOne({ _id: toObjectId(id) });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting notification: ${error.message}`);
    }
  }

  static async deleteOld(days = 30) {
    try {
      const col = await Notification._collection();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Number(days));
      const result = await col.deleteMany({ createdAt: { $lt: cutoff } });
      return result.deletedCount;
    } catch (error) {
      throw new Error(`Error deleting old notifications: ${error.message}`);
    }
  }

  static async createTaskAssigned(taskId, assigneeId, assignerId) {
    const tasks = await database.getCollection('tasks');
    const users = await database.getCollection('users');
    const task = await tasks.findOne({ _id: toObjectId(taskId) });
    if (!task) throw new Error('Task not found');

    const assigner = await users.findOne({ _id: toObjectId(assignerId) });
    const assignerName = assigner ? `${assigner.firstName || ''} ${assigner.lastName || ''}`.trim() : 'Someone';

    return Notification.create({
      userId: assigneeId,
      type: 'task_assigned',
      title: 'New Task Assigned',
      message: `${assignerName} assigned you the task: "${task.title}"`,
      entityType: 'task',
      entityId: taskId,
    });
  }

  static async createTaskUpdated(taskId, updaterId, changes) {
    const task = await this._taskForNotification(taskId);
    if (!task || !task.assignedTo || task.assignedTo === updaterId) return null;

    const updater = await this._userById(updaterId);
    const updaterName = updater ? `${updater.firstName || ''} ${updater.lastName || ''}`.trim() : 'Someone';
    const changeDescription = Object.keys(changes || {}).join(', ');

    return Notification.create({
      userId: task.assignedTo,
      type: 'task_updated',
      title: 'Task Updated',
      message: `${updaterName} updated the task: "${task.title}" (${changeDescription})`,
      entityType: 'task',
      entityId: taskId,
    });
  }

  static async createTaskCompleted(taskId, completerId) {
    const task = await this._taskForNotification(taskId, true);
    if (!task) return [];

    const projectMembers = await database.getCollection('project_members');
    const managers = await projectMembers.find({ projectId: task.projectId, role: 'manager', userId: { $ne: completerId } }).toArray();

    const completer = await this._userById(completerId);
    const completerName = completer ? `${completer.firstName || ''} ${completer.lastName || ''}`.trim() : 'Someone';

    const notifications = [];
    for (const manager of managers) {
      notifications.push(await Notification.create({
        userId: manager.userId,
        type: 'task_completed',
        title: 'Task Completed',
        message: `${completerName} completed the task: "${task.title}" in ${task.projectName || 'project'}`,
        entityType: 'task',
        entityId: taskId,
      }));
    }

    if (task.createdBy && task.createdBy !== completerId && !managers.some((m) => m.userId === task.createdBy)) {
      notifications.push(await Notification.create({
        userId: task.createdBy,
        type: 'task_completed',
        title: 'Task Completed',
        message: `${completerName} completed the task: "${task.title}"`,
        entityType: 'task',
        entityId: taskId,
      }));
    }

    return notifications;
  }

  static async createCommentAdded(commentId, taskId, commenterId) {
    const task = await this._taskForNotification(taskId);
    if (!task) return [];

    const commenter = await this._userById(commenterId);
    const commenterName = commenter ? `${commenter.firstName || ''} ${commenter.lastName || ''}`.trim() : 'Someone';

    const notifications = [];
    const notifiedUsers = new Set([commenterId]);

    if (task.assignedTo && !notifiedUsers.has(task.assignedTo)) {
      notifications.push(await Notification.create({
        userId: task.assignedTo,
        type: 'comment_added',
        title: 'New Comment',
        message: `${commenterName} commented on the task: "${task.title}"`,
        entityType: 'task',
        entityId: taskId,
      }));
      notifiedUsers.add(task.assignedTo);
    }

    if (task.createdBy && !notifiedUsers.has(task.createdBy)) {
      notifications.push(await Notification.create({
        userId: task.createdBy,
        type: 'comment_added',
        title: 'New Comment',
        message: `${commenterName} commented on the task: "${task.title}"`,
        entityType: 'task',
        entityId: taskId,
      }));
    }

    return notifications;
  }

  static async createDeadlineReminder(taskId) {
    const task = await this._taskForNotification(taskId);
    if (!task || !task.assignedTo || !task.dueDate) return null;

    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

    let message;
    if (daysUntilDue <= 0) message = `Task "${task.title}" is overdue!`;
    else if (daysUntilDue === 1) message = `Task "${task.title}" is due tomorrow!`;
    else message = `Task "${task.title}" is due in ${daysUntilDue} days`;

    return Notification.create({
      userId: task.assignedTo,
      type: 'deadline_reminder',
      title: 'Deadline Reminder',
      message,
      entityType: 'task',
      entityId: taskId,
    });
  }

  static async _taskForNotification(taskId, includeProject = false) {
    const tasks = await database.getCollection('tasks');
    const task = await tasks.findOne({ _id: toObjectId(taskId) });
    if (!task) return null;
    const mapped = mapDoc(task);
    if (includeProject && mapped.projectId) {
      const projects = await database.getCollection('projects');
      const project = await projects.findOne({ _id: toObjectId(mapped.projectId) });
      mapped.projectName = project?.name || null;
    }
    return mapped;
  }

  static async _userById(userId) {
    const users = await database.getCollection('users');
    return users.findOne({ _id: toObjectId(userId) });
  }

  async save() {
    if (this.id) {
      return Notification.markAsRead(this.id);
    }
    const created = await Notification.create(this.toObject());
    this.id = created.id;
    this.createdAt = created.createdAt;
    return this;
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
      createdAt: this.createdAt,
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

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  static validateCreate(data) {
    const errors = [];
    if (!data.userId) errors.push('User ID is required');
    if (!data.type) errors.push('Notification type is required');
    if (data.type && !['task_assigned', 'task_updated', 'task_completed', 'project_updated', 'comment_added', 'deadline_reminder', 'test', 'deadline', 'mention'].includes(data.type)) {
      errors.push('Invalid notification type');
    }
    if (!data.title || data.title.trim().length === 0) errors.push('Notification title is required');
    if (data.entityType && !['task', 'project', 'user_story', 'comment'].includes(data.entityType)) errors.push('Invalid entity type');
    return errors;
  }
}

export default Notification;
