import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class Comment {
  constructor(data = {}) {
    this.id = data.id;
    this.taskId = data.taskId || data.task_id;
    this.userId = data.userId || data.user_id;
    this.comment = data.comment;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  static async _collection() {
    return database.getCollection('task_comments');
  }

  static _fromDoc(doc) {
    return doc ? new Comment(mapDoc(doc)) : null;
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

      mapped.userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null;
      mapped.userEmail = user?.email || null;
      mapped.userAvatar = user?.avatarUrl || null;
      mapped.userRole = user?.role || null;
      mapped.taskTitle = task?.title || null;
      mapped.projectName = project?.name || null;
      mapped.projectId = task?.projectId || null;

      return new Comment(mapped);
    });
  }

  static async create(commentData) {
    try {
      const comments = await Comment._collection();
      const payload = withTimestampsOnCreate({
        taskId: commentData.taskId || commentData.task_id,
        userId: commentData.userId || commentData.user_id,
        comment: commentData.comment,
      });

      const result = await comments.insertOne(payload);
      return await Comment.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating comment: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const comments = await Comment._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const row = await comments.findOne({ _id });
      if (!row) return null;
      const [comment] = await Comment._enrich([row]);
      return comment;
    } catch (error) {
      throw new Error(`Error finding comment by ID: ${error.message}`);
    }
  }

  static async findByTask(taskId, options = {}) {
    try {
      const comments = await Comment._collection();
      const filter = { taskId };
      const sortDir = (options.orderDir || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;
      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;

      const rows = await comments.find(filter).sort({ createdAt: sortDir }).skip(offset).limit(limit || 0).toArray();
      return await Comment._enrich(rows);
    } catch (error) {
      throw new Error(`Error finding comments by task: ${error.message}`);
    }
  }

  static async findByUser(userId, options = {}) {
    try {
      const comments = await Comment._collection();
      const tasks = await database.getCollection('tasks');

      let filter = { userId };
      if (options.projectId) {
        const taskRows = await tasks.find({ projectId: options.projectId }).project({ _id: 1 }).toArray();
        const taskIds = taskRows.map((t) => normalizeId(t._id));
        filter = { userId, taskId: { $in: taskIds } };
      }

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;
      const rows = await comments.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit || 0).toArray();
      return await Comment._enrich(rows);
    } catch (error) {
      throw new Error(`Error finding comments by user: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const comments = await Comment._collection();
      const tasks = await database.getCollection('tasks');

      const filter = {};
      if (options.taskId) filter.taskId = options.taskId;
      if (options.userId) filter.userId = options.userId;
      if (options.search) filter.comment = { $regex: options.search, $options: 'i' };

      if (options.projectId) {
        const taskRows = await tasks.find({ projectId: options.projectId }).project({ _id: 1 }).toArray();
        const taskIds = taskRows.map((t) => normalizeId(t._id));
        filter.taskId = { $in: taskIds };
      }

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;
      const rows = await comments.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit || 0).toArray();
      return await Comment._enrich(rows);
    } catch (error) {
      throw new Error(`Error finding comments: ${error.message}`);
    }
  }

  static async count(options = {}) {
    try {
      const comments = await Comment._collection();
      const tasks = await database.getCollection('tasks');

      const filter = {};
      if (options.taskId) filter.taskId = options.taskId;
      if (options.userId) filter.userId = options.userId;
      if (options.projectId) {
        const taskRows = await tasks.find({ projectId: options.projectId }).project({ _id: 1 }).toArray();
        filter.taskId = { $in: taskRows.map((t) => normalizeId(t._id)) };
      }

      return await comments.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error counting comments: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const comments = await Comment._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid comment ID');

      const mapped = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined || key === 'id') continue;
        mapped[key] = value;
      }

      if (Object.keys(mapped).length === 0) {
        throw new Error('No fields to update');
      }

      await comments.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return await Comment.findById(id);
    } catch (error) {
      throw new Error(`Error updating comment: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const comments = await Comment._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await comments.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting comment: ${error.message}`);
    }
  }

  static async getRecentActivity(options = {}) {
    try {
      const comments = await Comment._collection();
      const since = new Date();
      since.setDate(since.getDate() - (options.days || 7));

      const filter = { createdAt: { $gte: since } };
      if (options.userId) filter.userId = options.userId;

      if (options.projectId) {
        const tasks = await database.getCollection('tasks');
        const taskRows = await tasks.find({ projectId: options.projectId }).project({ _id: 1 }).toArray();
        filter.taskId = { $in: taskRows.map((t) => normalizeId(t._id)) };
      }

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const rows = await comments.find(filter).sort({ createdAt: -1 }).limit(limit || 0).toArray();
      return await Comment._enrich(rows);
    } catch (error) {
      throw new Error(`Error getting recent comment activity: ${error.message}`);
    }
  }

  async save() {
    if (this.id) {
      return Comment.update(this.id, this.toObject());
    }

    const created = await Comment.create(this.toObject());
    this.id = created.id;
    this.createdAt = created.createdAt;
    this.updatedAt = created.updatedAt;
    return this;
  }

  async getTask() {
    try {
      const tasks = await database.getCollection('tasks');
      const projects = await database.getCollection('projects');
      const task = await tasks.findOne({ _id: toObjectId(this.taskId) });
      if (!task) return null;
      const project = task.projectId ? await projects.findOne({ _id: toObjectId(task.projectId) }) : null;
      return { ...mapDoc(task), projectName: project?.name || null };
    } catch (error) {
      throw new Error(`Error getting task for comment: ${error.message}`);
    }
  }

  async getUser() {
    try {
      const users = await database.getCollection('users');
      const user = await users.findOne({ _id: toObjectId(this.userId), isActive: true });
      if (!user) return null;
      return {
        id: normalizeId(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        avatar: user.avatarUrl,
        role: user.role,
      };
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
      updatedAt: this.updatedAt,
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
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }

  static validateCreate(data) {
    const errors = [];
    if (!data.taskId) errors.push('Task ID is required');
    if (!data.userId) errors.push('User ID is required');
    if (!data.comment || data.comment.trim().length === 0) errors.push('Comment text is required');
    if (data.comment && data.comment.trim().length > 2000) errors.push('Comment cannot exceed 2000 characters');
    return errors;
  }

  static async findByTaskId(taskId, options = {}) {
    return Comment.findByTask(taskId, options);
  }

  static async countByTaskId(taskId) {
    return Comment.count({ taskId });
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
