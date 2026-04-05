import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class Task {
  constructor(data = {}) {
    this.id = data.id;
    this.projectId = data.projectId || data.project_id;
    this.title = data.title;
    this.description = data.description;
    this.status = data.status || 'todo';
    this.priority = data.priority || 'medium';
    this.assignedTo = data.assignedTo || data.assigned_to;
    this.createdBy = data.createdBy || data.created_by;
    this.estimatedHours = data.estimatedHours || data.estimated_hours;
    this.actualHours = data.actualHours || data.actual_hours || 0;
    this.dueDate = data.dueDate || data.due_date;
    this.completedAt = data.completedAt || data.completed_at;
    this.tags = data.tags;
    this.storyPoints = data.storyPoints || data.story_points;
    this.blocked = data.blocked || false;
    this.blockedReason = data.blockedReason || data.blocked_reason;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  static async _collection() {
    return database.getCollection('tasks');
  }

  static _fromDoc(doc) {
    return doc ? new Task(mapDoc(doc)) : null;
  }

  static async create(taskData) {
    try {
      const tasks = await Task._collection();
      const payload = withTimestampsOnCreate({
        projectId: taskData.projectId || taskData.project_id,
        title: taskData.title,
        description: taskData.description || null,
        status: taskData.status || 'todo',
        priority: taskData.priority || 'medium',
        assignedTo: taskData.assignedTo || taskData.assigned_to || null,
        createdBy: taskData.createdBy || taskData.created_by,
        estimatedHours: taskData.estimatedHours || taskData.estimated_hours || null,
        actualHours: taskData.actualHours || taskData.actual_hours || 0,
        dueDate: taskData.dueDate || taskData.due_date || null,
        completedAt: taskData.completedAt || taskData.completed_at || null,
        tags: taskData.tags || null,
        storyPoints: taskData.storyPoints || taskData.story_points || null,
        blocked: taskData.blocked || false,
        blockedReason: taskData.blockedReason || taskData.blocked_reason || null,
      });

      const result = await tasks.insertOne(payload);
      return await Task.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating task: ${error.message}`);
    }
  }

  static async _enrichDocs(docs) {
    if (!docs.length) return [];

    const projects = await database.getCollection('projects');
    const users = await database.getCollection('users');

    const projectIds = [...new Set(docs.map((d) => d.projectId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const userIds = [...new Set(docs.flatMap((d) => [d.assignedTo, d.createdBy]).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);

    const [projectDocs, userDocs] = await Promise.all([
      projects.find({ _id: { $in: projectIds } }).toArray(),
      users.find({ _id: { $in: userIds } }).toArray(),
    ]);

    const projectMap = new Map(projectDocs.map((p) => [normalizeId(p._id), p]));
    const userMap = new Map(userDocs.map((u) => [normalizeId(u._id), u]));

    const now = new Date();
    return docs.map((doc) => {
      const mapped = mapDoc(doc);
      const project = mapped.projectId ? projectMap.get(mapped.projectId) : null;
      const assignee = mapped.assignedTo ? userMap.get(mapped.assignedTo) : null;
      const creator = mapped.createdBy ? userMap.get(mapped.createdBy) : null;
      mapped.projectName = project?.name || null;
      mapped.projectStatus = project?.status || null;
      mapped.assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null;
      mapped.assigneeEmail = assignee?.email || null;
      mapped.createdByName = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : null;
      mapped.createdByEmail = creator?.email || null;
      mapped.isOverdue = !!(mapped.dueDate && new Date(mapped.dueDate) < now && mapped.status !== 'done');
      return new Task(mapped);
    });
  }

  static async findById(id) {
    try {
      const tasks = await Task._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await tasks.findOne({ _id });
      if (!doc) return null;
      const [task] = await Task._enrichDocs([doc]);
      return task;
    } catch (error) {
      throw new Error(`Error finding task by ID: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      const tasks = await Task._collection();
      const filter = {};

      if (options.projectId) filter.projectId = options.projectId;
      if (options.status) filter.status = options.status;
      if (options.priority) filter.priority = options.priority;
      if (options.assignedTo) filter.assignedTo = options.assignedTo;
      if (options.createdBy) filter.createdBy = options.createdBy;
      if (options.overdue) filter.dueDate = { $lt: new Date() };
      if (options.search) {
        const regex = new RegExp(options.search, 'i');
        filter.$or = [{ title: regex }, { description: regex }];
      }

      const orderByMap = {
        created_at: 'createdAt',
        updated_at: 'updatedAt',
        due_date: 'dueDate',
        priority: 'priority',
        status: 'status',
      };
      const sortField = orderByMap[options.orderBy] || 'createdAt';
      const sortDir = (options.orderDir || 'DESC').toUpperCase() === 'ASC' ? 1 : -1;

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;

      const docs = await tasks.find(filter).sort({ [sortField]: sortDir }).skip(offset).limit(limit || 0).toArray();
      return await Task._enrichDocs(docs);
    } catch (error) {
      throw new Error(`Error finding tasks: ${error.message}`);
    }
  }

  static async findByProject(projectId, options = {}) {
    return Task.findAll({ ...options, projectId });
  }

  static async findByUser(userId, options = {}) {
    return Task.findAll({ ...options, assignedTo: userId });
  }

  static async count(options = {}) {
    try {
      const tasks = await Task._collection();
      const filter = {};
      if (options.projectId) filter.projectId = options.projectId;
      if (options.status) filter.status = options.status;
      if (options.assignedTo) filter.assignedTo = options.assignedTo;
      if (options.overdue) filter.dueDate = { $lt: new Date() };
      if (options.overdue) filter.status = { $ne: 'done' };
      return await tasks.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error counting tasks: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const tasks = await Task._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid task ID');

      const mapped = {};
      const keyMap = {
        project_id: 'projectId',
        assigned_to: 'assignedTo',
        created_by: 'createdBy',
        estimated_hours: 'estimatedHours',
        actual_hours: 'actualHours',
        due_date: 'dueDate',
        completed_at: 'completedAt',
        story_points: 'storyPoints',
        blocked_reason: 'blockedReason',
      };

      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined || key === 'id') continue;
        mapped[keyMap[key] || key] = value;
      }

      if (Object.keys(mapped).length === 0) {
        throw new Error('No fields to update');
      }

      if (mapped.status === 'done' && !mapped.completedAt) {
        mapped.completedAt = new Date();
      } else if (mapped.status && mapped.status !== 'done') {
        mapped.completedAt = null;
      }

      await tasks.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return await Task.findById(id);
    } catch (error) {
      throw new Error(`Error updating task: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const tasks = await Task._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await tasks.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting task: ${error.message}`);
    }
  }

  static async updateStatus(id, status) {
    const updateData = { status };
    if (status === 'done') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }
    return Task.update(id, updateData);
  }

  static async assign(id, userId) {
    return Task.update(id, { assignedTo: userId });
  }

  async save() {
    try {
      if (this.id) {
        return await Task.update(this.id, this.toObject());
      }

      const created = await Task.create(this.toObject());
      this.id = created.id;
      this.createdAt = created.createdAt;
      this.updatedAt = created.updatedAt;
      return this;
    } catch (error) {
      throw new Error(`Error saving task: ${error.message}`);
    }
  }

  async getComments() {
    return Task.getComments(this.id);
  }

  async addComment(userId, comment) {
    const commentCollection = await database.getCollection('task_comments');
    const result = await commentCollection.insertOne(withTimestampsOnCreate({
      taskId: this.id,
      userId,
      comment,
    }));
    return result.insertedId.toHexString();
  }

  async getTimeTracking() {
    try {
      if (!this.startDate || !this.completedAt) return null;
      const start = new Date(this.startDate);
      const end = new Date(this.completedAt);
      const diffInHours = (end - start) / (1000 * 60 * 60);

      return {
        startDate: this.startDate,
        completedAt: this.completedAt,
        actualHours: this.actualHours,
        calculatedHours: diffInHours,
        estimatedHours: this.estimatedHours,
        variance: this.estimatedHours ? diffInHours - this.estimatedHours : null,
      };
    } catch (error) {
      throw new Error(`Error calculating time tracking: ${error.message}`);
    }
  }

  toObject() {
    return {
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      assignedTo: this.assignedTo,
      createdBy: this.createdBy,
      estimatedHours: this.estimatedHours,
      actualHours: this.actualHours,
      dueDate: this.dueDate,
      completedAt: this.completedAt,
      tags: this.tags,
      storyPoints: this.storyPoints,
      blocked: this.blocked,
      blockedReason: this.blockedReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static async getComments(taskId) {
    const comments = await database.getCollection('task_comments');
    const users = await database.getCollection('users');

    const rows = await comments.find({ taskId }).sort({ createdAt: 1 }).toArray();
    if (!rows.length) return [];

    const userIds = [...new Set(rows.map((r) => r.userId))].map((id) => toObjectId(id)).filter(Boolean);
    const userDocs = await users.find({ _id: { $in: userIds } }).toArray();
    const userMap = new Map(userDocs.map((u) => [normalizeId(u._id), u]));

    return rows.map((row) => {
      const user = userMap.get(row.userId);
      return {
        ...mapDoc(row),
        userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null,
        userEmail: user?.email || null,
        userAvatar: user?.avatarUrl || null,
      };
    });
  }

  static async hasUserAccess(taskId, userId) {
    const task = await Task.findById(taskId);
    if (!task) return false;
    if (task.assignedTo === userId || task.createdBy === userId) return true;

    const projectMembers = await database.getCollection('project_members');
    const row = await projectMembers.findOne({ projectId: task.projectId, userId });
    return !!row;
  }

  static async findByAssignee(userId, options = {}) {
    return Task.findAll({ ...options, assignedTo: userId });
  }

  static async findByUserAccess(userId, projectIds = [], options = {}) {
    const baseTasks = await Task.findAll(options);
    const allowed = new Set(Array.isArray(projectIds) ? projectIds : []);

    return baseTasks.filter(
      (task) => task.assignedTo === userId || task.createdBy === userId || allowed.has(task.projectId)
    );
  }

  toJSON() {
    return this.toObject();
  }

  get isOverdue() {
    if (!this.dueDate || this.status === 'done') return false;
    return new Date(this.dueDate) < new Date();
  }

  get daysUntilDue() {
    if (!this.dueDate) return null;
    const now = new Date();
    const due = new Date(this.dueDate);
    return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  }

  get completionTime() {
    if (!this.startDate || !this.completedAt) return null;
    const start = new Date(this.startDate);
    const end = new Date(this.completedAt);
    return (end - start) / (1000 * 60 * 60);
  }

  static validateCreate(data) {
    const errors = [];

    if (!data.title || data.title.trim().length === 0) errors.push('Task title is required');
    if (!data.projectId) errors.push('Project ID is required');
    if (!data.createdBy) errors.push('Created by user ID is required');
    if (data.status && !['todo', 'in_progress', 'in_review', 'done'].includes(data.status)) errors.push('Invalid status specified');
    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) errors.push('Invalid priority specified');
    if (data.estimatedHours && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) errors.push('Estimated hours must be a positive number');
    if (data.actualHours && (isNaN(data.actualHours) || data.actualHours < 0)) errors.push('Actual hours must be a positive number');
    if (data.dueDate && isNaN(new Date(data.dueDate))) errors.push('Invalid due date format');

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.title !== undefined && data.title.trim().length === 0) errors.push('Task title cannot be empty');
    if (data.status && !['todo', 'in_progress', 'in_review', 'done'].includes(data.status)) errors.push('Invalid status specified');
    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) errors.push('Invalid priority specified');
    if (data.estimatedHours !== undefined && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) errors.push('Estimated hours must be a positive number');
    if (data.actualHours !== undefined && (isNaN(data.actualHours) || data.actualHours < 0)) errors.push('Actual hours must be a positive number');
    if (data.dueDate !== undefined && data.dueDate !== null && isNaN(new Date(data.dueDate))) errors.push('Invalid due date format');

    return errors;
  }
}

export default Task;
