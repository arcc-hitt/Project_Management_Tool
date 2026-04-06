import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class Project {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.status = data.status || 'planning';
    this.priority = data.priority || 'medium';
    this.startDate = data.startDate || data.start_date;
    this.endDate = data.endDate || data.end_date;
    this.budget = data.budget;
    this.actualCost = data.actualCost || data.actual_cost;
    this._progressPercentage = data.progressPercentage ?? data.progress_percentage ?? 0;
    this.repositoryUrl = data.repositoryUrl || data.repository_url;
    this.tags = data.tags;
    this.createdBy = data.createdBy || data.created_by;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  static async _collection() {
    return database.getCollection('projects');
  }

  static _fromDoc(doc) {
    return doc ? new Project(mapDoc(doc)) : null;
  }

  static async create(projectData) {
    try {
      const projects = await Project._collection();
      const payload = withTimestampsOnCreate({
        name: projectData.name,
        description: projectData.description || null,
        status: projectData.status || 'planning',
        priority: projectData.priority || 'medium',
        startDate: projectData.startDate || projectData.start_date || null,
        endDate: projectData.endDate || projectData.end_date || null,
        budget: projectData.budget || null,
        actualCost: projectData.actualCost || projectData.actual_cost || null,
        progressPercentage: projectData.progressPercentage || projectData.progress_percentage || 0,
        repositoryUrl: projectData.repositoryUrl || projectData.repository_url || null,
        tags: projectData.tags || null,
        createdBy: projectData.createdBy || projectData.created_by,
      });

      const result = await projects.insertOne(payload);
      return await Project.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating project: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const projects = await Project._collection();
      const users = await database.getCollection('users');
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await projects.findOne({ _id });
      if (!doc) return null;

      const creator = doc.createdBy ? await users.findOne({ _id: toObjectId(doc.createdBy) }) : null;
      const mapped = mapDoc(doc);
      mapped.created_by_name = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : null;
      mapped.created_by_email = creator?.email || null;
      return new Project(mapped);
    } catch (error) {
      throw new Error(`Error finding project by ID: ${error.message}`);
    }
  }

  static async findAll(options: any = {}) {
    try {
      const projects = await Project._collection();
      const users = await database.getCollection('users');
      const projectMembers = await database.getCollection('project_members');
      const tasks = await database.getCollection('tasks');

      const filter: Record<string, any> = {};
      if (options.status) filter.status = options.status;
      if (options.priority) filter.priority = options.priority;
      if (options.created_by) filter.createdBy = options.created_by;
      if (options.search) {
        const regex = new RegExp(options.search, 'i');
        filter.$or = [{ name: regex }, { description: regex }];
      }

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;

      const docs = await projects.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit || 0).toArray();

      const projectIds = docs.map((d) => normalizeId(d._id));
      const creatorIds = [...new Set(docs.map((d) => d.createdBy).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);

      const [creatorDocs, memberRows, taskRows] = await Promise.all([
        users.find({ _id: { $in: creatorIds } }).toArray(),
        projectMembers.find({ projectId: { $in: projectIds } }).toArray(),
        tasks.find({ projectId: { $in: projectIds } }).toArray(),
      ]);

      const creatorMap = new Map(creatorDocs.map((u) => [normalizeId(u._id), u]));
      const memberCountMap = new Map();
      const totalTaskMap = new Map();
      const completedTaskMap = new Map();

      for (const row of memberRows) {
        memberCountMap.set(row.projectId, (memberCountMap.get(row.projectId) || 0) + 1);
      }
      for (const row of taskRows) {
        totalTaskMap.set(row.projectId, (totalTaskMap.get(row.projectId) || 0) + 1);
        if (row.status === 'done') {
          completedTaskMap.set(row.projectId, (completedTaskMap.get(row.projectId) || 0) + 1);
        }
      }

      return docs.map((doc) => {
        const mapped = mapDoc(doc);
        const creator = mapped.createdBy ? creatorMap.get(mapped.createdBy) : null;
        mapped.created_by_name = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : null;
        mapped.created_by_email = creator?.email || null;
        mapped.member_count = memberCountMap.get(mapped.id) || 0;
        mapped.total_tasks = totalTaskMap.get(mapped.id) || 0;
        mapped.completed_tasks = completedTaskMap.get(mapped.id) || 0;
        return new Project(mapped);
      });
    } catch (error) {
      throw new Error(`Error finding projects: ${error.message}`);
    }
  }

  static async findByUser(userId, options: any = {}) {
    try {
      const projectMembers = await database.getCollection('project_members');
      const rows = await projectMembers.find({ userId }).sort({ joinedAt: -1 }).toArray();
      const projectIds = rows.map((r) => toObjectId(r.projectId)).filter(Boolean);
      if (projectIds.length === 0) return [];

      const projects = await Project.findAll({ ...options });
      const roleMap = new Map<string, any>(rows.map((r) => [r.projectId, r.role]));
      const joinedMap = new Map<string, any>(rows.map((r) => [r.projectId, r.joinedAt]));

      return projects
        .filter((p) => roleMap.has(p.id))
        .map((p) => {
          p.member_role = roleMap.get(p.id);
          p.joined_at = joinedMap.get(p.id);
          return p;
        });
    } catch (error) {
      throw new Error(`Error finding projects by user: ${error.message}`);
    }
  }

  static async count(options: any = {}) {
    try {
      const projects = await Project._collection();
      const filter: Record<string, any> = {};
      if (options.status) filter.status = options.status;
      if (options.created_by) filter.createdBy = options.created_by;
      return await projects.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error counting projects: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const projects = await Project._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid project ID');

      const mapped: Record<string, any> = {};
      const keyMap = {
        start_date: 'startDate',
        end_date: 'endDate',
        actual_cost: 'actualCost',
        progress_percentage: 'progressPercentage',
        repository_url: 'repositoryUrl',
      };

      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined || key === 'id') continue;
        mapped[keyMap[key] || key] = value;
      }

      if (Object.keys(mapped).length === 0) {
        throw new Error('No fields to update');
      }

      await projects.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return await Project.findById(id);
    } catch (error) {
      throw new Error(`Error updating project: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const projects = await Project._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await projects.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting project: ${error.message}`);
    }
  }

  async save() {
    try {
      if (this.id) {
        return await Project.update(this.id, this.toObject());
      }
      const created = await Project.create({ ...this.toObject(), createdBy: this.createdBy });
      this.id = created.id;
      this.createdAt = created.createdAt;
      this.updatedAt = created.updatedAt;
      return this;
    } catch (error) {
      throw new Error(`Error saving project: ${error.message}`);
    }
  }

  async getMembers() {
    return Project.getMembers(this.id);
  }

  async addMember(userId, role = 'developer') {
    return Project.addMember(this.id, userId, role);
  }

  async removeMember(userId) {
    return Project.removeMember(this.id, userId);
  }

  async updateMemberRole(userId, role) {
    return Project.updateMemberRole(this.id, userId, role);
  }

  async getTasks(options: any = {}) {
    return Project.getTasks(this.id, options);
  }

  async getStatistics() {
    return Project.getStatistics(this.id);
  }

  toObject() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      status: this.status,
      priority: this.priority,
      startDate: this.startDate,
      endDate: this.endDate,
      budget: this.budget,
      actualCost: this.actualCost,
      progressPercentage: this._progressPercentage,
      repositoryUrl: this.repositoryUrl,
      tags: this.tags,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toJSON() {
    return this.toObject();
  }

  get progressPercentage() {
    if (this.totalTasks !== undefined && this.completedTasks !== undefined) {
      if (!this.totalTasks) return 0;
      return Math.round((this.completedTasks / this.totalTasks) * 100);
    }
    return this._progressPercentage ?? 0;
  }

  set progressPercentage(value) {
    this._progressPercentage = value;
  }

  get isOverdue() {
    if (!this.endDate) return false;
    return new Date(this.endDate) < new Date() && this.status !== 'completed';
  }

  static async isMember(projectId, userId) {
    const projectMembers = await database.getCollection('project_members');
    const row = await projectMembers.findOne({ projectId, userId });
    return !!row;
  }

  static async getMembers(projectId) {
    const projectMembers = await database.getCollection('project_members');
    const users = await database.getCollection('users');

    const rows = await projectMembers.find({ projectId }).sort({ joinedAt: 1 }).toArray();
    if (rows.length === 0) return [];

    const userIds = rows.map((r) => toObjectId(r.userId)).filter(Boolean);
    const userDocs = await users.find({ _id: { $in: userIds }, isActive: true }).toArray();
    const userMap = new Map(userDocs.map((u) => [normalizeId(u._id), u]));

    return rows
      .map((r) => {
        const user = userMap.get(r.userId);
        if (!user) return null;
        return {
          id: normalizeId(user._id),
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          avatar_url: user.avatarUrl,
          user_role: user.role,
          project_role: r.role,
          joined_at: r.joinedAt,
        };
      })
      .filter(Boolean);
  }

  static async addMember(projectId, userId, role = 'developer') {
    const projectMembers = await database.getCollection('project_members');
    await projectMembers.updateOne(
      { projectId, userId },
      { $set: withUpdatedAt({ role }), $setOnInsert: { joinedAt: new Date() } },
      { upsert: true }
    );
    return true;
  }

  static async removeMember(projectId, userId) {
    const projectMembers = await database.getCollection('project_members');
    const result = await projectMembers.deleteOne({ projectId, userId });
    return result.deletedCount > 0;
  }

  static async updateMemberRole(projectId, userId, role) {
    const projectMembers = await database.getCollection('project_members');
    const result = await projectMembers.updateOne({ projectId, userId }, { $set: withUpdatedAt({ role }) });
    return result.modifiedCount > 0;
  }

  static async getTasks(projectId, options: any = {}) {
    const tasks = await database.getCollection('tasks');
    const users = await database.getCollection('users');

    const filter: Record<string, any> = { projectId };
    if (options.status) filter.status = options.status;
    if (options.assignedTo) filter.assignedTo = options.assignedTo;

    const limit = options.limit ? parseInt(options.limit, 10) : 0;
    const docs = await tasks.find(filter).sort({ createdAt: -1 }).limit(limit || 0).toArray();
    if (docs.length === 0) return [];

    const userIds = [...new Set(docs.flatMap((d) => [d.assignedTo, d.createdBy]).filter(Boolean))]
      .map((id) => toObjectId(id))
      .filter(Boolean);
    const userDocs = await users.find({ _id: { $in: userIds } }).toArray();
    const userMap = new Map(userDocs.map((u) => [normalizeId(u._id), u]));

    return docs.map((doc) => {
      const assignee = doc.assignedTo ? userMap.get(doc.assignedTo) : null;
      const creator = doc.createdBy ? userMap.get(doc.createdBy) : null;
      return {
        ...mapDoc(doc),
        assignee_name: assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null,
        created_by_name: creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : null,
      };
    });
  }

  static async getStatistics(projectId) {
    const projectMembers = await database.getCollection('project_members');
    const tasks = await database.getCollection('tasks');

    const [members, taskRows] = await Promise.all([
      projectMembers.countDocuments({ projectId }),
      tasks.find({ projectId }).toArray(),
    ]);

    const now = new Date();
    const totalTasks = taskRows.length;
    const completedTasks = taskRows.filter((t) => t.status === 'done').length;
    const activeTasks = taskRows.filter((t) => t.status === 'in_progress').length;
    const overdueTasks = taskRows.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'done').length;
    const totalHoursSpent = taskRows.reduce((sum, t) => sum + Number(t.actualHours || 0), 0);

    return {
      memberCount: members,
      totalTasks,
      completedTasks,
      activeTasks,
      overdueTasks,
      totalHoursSpent,
      avgCompletionHours: null,
    };
  }

  static async findByMemberId(userId, options: any = {}) {
    return Project.findByUser(userId, options);
  }

  static validateCreate(data) {
    const errors = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Project name is required');
    }

    if (!data.createdBy) {
      errors.push('Created by user ID is required');
    }

    if (data.status && !['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(data.status)) {
      errors.push('Invalid status specified');
    }

    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      errors.push('Invalid priority specified');
    }

    if (data.startDate && data.endDate) {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      if (end <= start) {
        errors.push('End date must be after start date');
      }
    }

    if (data.estimatedHours && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) {
      errors.push('Estimated hours must be a positive number');
    }

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.name !== undefined && data.name.trim().length === 0) {
      errors.push('Project name cannot be empty');
    }

    if (data.status && !['planning', 'active', 'on_hold', 'completed', 'cancelled'].includes(data.status)) {
      errors.push('Invalid status specified');
    }

    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) {
      errors.push('Invalid priority specified');
    }

    if ((data.startDate || data.endDate)) {
      const start = data.startDate ? new Date(data.startDate) : null;
      const end = data.endDate ? new Date(data.endDate) : null;
      if (start && end && end <= start) {
        errors.push('End date must be after start date');
      }
    }

    if (data.estimatedHours !== undefined && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) {
      errors.push('Estimated hours must be a positive number');
    }

    return errors;
  }
}

export default Project;


