import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

const VALID_ISSUE_TYPES = ['task', 'bug', 'epic'] as const;
const VALID_BUG_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;

class Issue {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.organizationId = data.organizationId || data.organization_id;
    this.projectId = data.projectId || data.project_id;
    this.issueKey = data.issueKey || data.issue_key;
    this.issueType = data.issueType || data.issue_type || 'task';
    this.title = data.title;
    this.description = data.description;
    this.status = data.status || 'todo';
    this.priority = data.priority || 'medium';
    this.assignedTo = data.assignedTo || data.assigned_to;
    this.createdBy = data.createdBy || data.created_by;
    this.sprintId = data.sprintId || data.sprint_id;
    this.epicId = data.epicId || data.epic_id;
    this.childIssueIds = data.childIssueIds || data.child_issue_ids || [];
    this.componentId = data.componentId || data.component_id;
    this.versionId = data.versionId || data.version_id;
    this.storyPoints = data.storyPoints !== undefined ? data.storyPoints : (data.story_points !== undefined ? data.story_points : null);
    this.bugSeverity = data.bugSeverity || data.bug_severity;
    this.labels = data.labels || [];
    this.position = data.position !== undefined ? data.position : null;
    this.githubPrUrl = data.githubPrUrl || data.github_pr_url;
    this.estimatedHours = data.estimatedHours || data.estimated_hours;
    this.actualHours = data.actualHours || data.actual_hours || 0;
    this.dueDate = data.dueDate || data.due_date;
    this.completedAt = data.completedAt || data.completed_at;
    this.tags = data.tags;
    this.blocked = data.blocked || false;
    this.blockedReason = data.blockedReason || data.blocked_reason;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  static async _collection() {
    return database.getCollection('issues');
  }

  static _fromDoc(doc) {
    return doc ? new Issue(mapDoc(doc)) : null;
  }

  static async create(issueData) {
    try {
      const issues = await Issue._collection();

      // Default bugSeverity to 'medium' when issueType is 'bug' and none provided
      let bugSeverity = issueData.bugSeverity || issueData.bug_severity || null;
      const issueType = issueData.issueType || issueData.issue_type || 'task';
      if (issueType === 'bug' && !bugSeverity) {
        bugSeverity = 'medium';
      }

      const payload = withTimestampsOnCreate({
        organizationId: issueData.organizationId || issueData.organization_id || null,
        projectId: issueData.projectId || issueData.project_id,
        issueKey: issueData.issueKey || issueData.issue_key || null,
        issueType,
        title: issueData.title,
        description: issueData.description || null,
        status: issueData.status || 'todo',
        priority: issueData.priority || 'medium',
        assignedTo: issueData.assignedTo || issueData.assigned_to || null,
        createdBy: issueData.createdBy || issueData.created_by,
        sprintId: issueData.sprintId || issueData.sprint_id || null,
        epicId: issueData.epicId || issueData.epic_id || null,
        childIssueIds: issueData.childIssueIds || issueData.child_issue_ids || [],
        componentId: issueData.componentId || issueData.component_id || null,
        versionId: issueData.versionId || issueData.version_id || null,
        storyPoints: issueData.storyPoints !== undefined ? issueData.storyPoints : (issueData.story_points !== undefined ? issueData.story_points : null),
        bugSeverity,
        labels: issueData.labels || [],
        position: issueData.position !== undefined ? issueData.position : null,
        githubPrUrl: issueData.githubPrUrl || issueData.github_pr_url || null,
        estimatedHours: issueData.estimatedHours || issueData.estimated_hours || null,
        actualHours: issueData.actualHours || issueData.actual_hours || 0,
        dueDate: issueData.dueDate || issueData.due_date || null,
        completedAt: issueData.completedAt || issueData.completed_at || null,
        tags: issueData.tags || null,
        blocked: issueData.blocked || false,
        blockedReason: issueData.blockedReason || issueData.blocked_reason || null,
      });

      const result = await issues.insertOne(payload);
      return await Issue.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating issue: ${error.message}`);
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
      mapped.projectKey = project?.projectKey || null;
      mapped.projectStatus = project?.status || null;
      mapped.assigneeName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null;
      mapped.assigneeEmail = assignee?.email || null;
      mapped.createdByName = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : null;
      mapped.createdByEmail = creator?.email || null;
      mapped.isOverdue = !!(mapped.dueDate && new Date(mapped.dueDate) < now && mapped.status !== 'done');
      return new Issue(mapped);
    });
  }

  static async findById(id) {
    try {
      const issues = await Issue._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await issues.findOne({ _id });
      if (!doc) return null;
      const [issue] = await Issue._enrichDocs([doc]);
      return issue;
    } catch (error) {
      throw new Error(`Error finding issue by ID: ${error.message}`);
    }
  }

  static async findAll(options: any = {}) {
    try {
      const issues = await Issue._collection();
      const filter: Record<string, any> = {};

      if (options.projectId) filter.projectId = options.projectId;
      if (options.status) filter.status = options.status;
      if (options.priority) filter.priority = options.priority;
      if (options.assignedTo) filter.assignedTo = options.assignedTo;
      if (options.createdBy) filter.createdBy = options.createdBy;
      if (options.issueType) filter.issueType = options.issueType;
      if (options.sprintId) filter.sprintId = options.sprintId;
      if (options.epicId) filter.epicId = options.epicId;
      if (options.componentId) filter.componentId = options.componentId;
      if (options.versionId) filter.versionId = options.versionId;
      if (options.bugSeverity) filter.bugSeverity = options.bugSeverity;
      if (options.organizationId) filter.organizationId = options.organizationId;
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
        position: 'position',
      };
      const sortField = orderByMap[options.orderBy] || 'createdAt';
      const sortDir = (options.orderDir || 'DESC').toUpperCase() === 'ASC' ? 1 : -1;

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;

      const docs = await issues.find(filter).sort({ [sortField]: sortDir }).skip(offset).limit(limit || 0).toArray();
      return await Issue._enrichDocs(docs);
    } catch (error) {
      throw new Error(`Error finding issues: ${error.message}`);
    }
  }

  static async findByProject(projectId, options: any = {}) {
    return Issue.findAll({ ...options, projectId });
  }

  static async findByUser(userId, options: any = {}) {
    return Issue.findAll({ ...options, assignedTo: userId });
  }

  static async count(options: any = {}) {
    try {
      const issues = await Issue._collection();
      const filter: Record<string, any> = {};
      if (options.projectId) filter.projectId = options.projectId;
      if (options.status) filter.status = options.status;
      if (options.assignedTo) filter.assignedTo = options.assignedTo;
      if (options.issueType) filter.issueType = options.issueType;
      if (options.organizationId) filter.organizationId = options.organizationId;
      if (options.overdue) {
        filter.dueDate = { $lt: new Date() };
        filter.status = { $ne: 'done' };
      }
      return await issues.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error counting issues: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const issues = await Issue._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid issue ID');

      const mapped: Record<string, any> = {};
      const keyMap = {
        project_id: 'projectId',
        issue_key: 'issueKey',
        issue_type: 'issueType',
        assigned_to: 'assignedTo',
        created_by: 'createdBy',
        sprint_id: 'sprintId',
        epic_id: 'epicId',
        child_issue_ids: 'childIssueIds',
        component_id: 'componentId',
        version_id: 'versionId',
        story_points: 'storyPoints',
        bug_severity: 'bugSeverity',
        github_pr_url: 'githubPrUrl',
        estimated_hours: 'estimatedHours',
        actual_hours: 'actualHours',
        due_date: 'dueDate',
        completed_at: 'completedAt',
        blocked_reason: 'blockedReason',
        organization_id: 'organizationId',
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

      await issues.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return await Issue.findById(id);
    } catch (error) {
      throw new Error(`Error updating issue: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const issues = await Issue._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await issues.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting issue: ${error.message}`);
    }
  }

  static async updateStatus(id, status) {
    const updateData: Record<string, any> = { status };
    if (status === 'done') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }
    return Issue.update(id, updateData);
  }

  static async assign(id, userId) {
    return Issue.update(id, { assignedTo: userId });
  }

  async save() {
    try {
      if (this.id) {
        return await Issue.update(this.id, this.toObject());
      }

      const created = await Issue.create(this.toObject());
      this.id = created.id;
      this.createdAt = created.createdAt;
      this.updatedAt = created.updatedAt;
      return this;
    } catch (error) {
      throw new Error(`Error saving issue: ${error.message}`);
    }
  }

  async getComments() {
    return Issue.getComments(this.id);
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
      const diffInHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

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
      organizationId: this.organizationId,
      projectId: this.projectId,
      issueKey: this.issueKey,
      issueType: this.issueType,
      title: this.title,
      description: this.description,
      status: this.status,
      priority: this.priority,
      assignedTo: this.assignedTo,
      createdBy: this.createdBy,
      sprintId: this.sprintId,
      epicId: this.epicId,
      childIssueIds: this.childIssueIds,
      componentId: this.componentId,
      versionId: this.versionId,
      storyPoints: this.storyPoints,
      bugSeverity: this.bugSeverity,
      labels: this.labels,
      position: this.position,
      githubPrUrl: this.githubPrUrl,
      estimatedHours: this.estimatedHours,
      actualHours: this.actualHours,
      dueDate: this.dueDate,
      completedAt: this.completedAt,
      tags: this.tags,
      blocked: this.blocked,
      blockedReason: this.blockedReason,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
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
    return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }

  get completionTime() {
    if (!this.startDate || !this.completedAt) return null;
    const start = new Date(this.startDate);
    const end = new Date(this.completedAt);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  static async getComments(issueId) {
    const comments = await database.getCollection('task_comments');
    const users = await database.getCollection('users');

    const rows = await comments.find({ taskId: issueId }).sort({ createdAt: 1 }).toArray();
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

  static async hasUserAccess(issueId, userId) {
    const issue = await Issue.findById(issueId);
    if (!issue) return false;
    if (issue.assignedTo === userId || issue.createdBy === userId) return true;

    const projectMembers = await database.getCollection('project_members');
    const row = await projectMembers.findOne({ projectId: issue.projectId, userId });
    return !!row;
  }

  static async findByAssignee(userId, options: any = {}) {
    return Issue.findAll({ ...options, assignedTo: userId });
  }

  static async findByUserAccess(userId, projectIds = [], options: any = {}) {
    const baseIssues = await Issue.findAll(options);
    const allowed = new Set(Array.isArray(projectIds) ? projectIds : []);

    return baseIssues.filter(
      (issue) => issue.assignedTo === userId || issue.createdBy === userId || allowed.has(issue.projectId)
    );
  }

  static validateCreate(data) {
    const errors = [];

    if (!data.title || data.title.trim().length === 0) errors.push('Issue title is required');
    if (!data.projectId) errors.push('Project ID is required');
    if (!data.createdBy) errors.push('Created by user ID is required');

    const issueType = data.issueType || data.issue_type || 'task';
    if (!VALID_ISSUE_TYPES.includes(issueType as any)) {
      errors.push(`Invalid issueType: must be one of ${VALID_ISSUE_TYPES.join(', ')}`);
    }

    if (data.bugSeverity && !VALID_BUG_SEVERITIES.includes(data.bugSeverity as any)) {
      errors.push(`Invalid bugSeverity: must be one of ${VALID_BUG_SEVERITIES.join(', ')}`);
    }

    if (data.storyPoints !== undefined && data.storyPoints !== null) {
      const sp = Number(data.storyPoints);
      if (!Number.isInteger(sp) || sp < 0) {
        errors.push('storyPoints must be a non-negative integer');
      }
    }

    if (data.status && !['todo', 'in_progress', 'in_review', 'done'].includes(data.status)) errors.push('Invalid status specified');
    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) errors.push('Invalid priority specified');
    if (data.estimatedHours && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) errors.push('Estimated hours must be a positive number');
    if (data.actualHours && (isNaN(data.actualHours) || data.actualHours < 0)) errors.push('Actual hours must be a positive number');
    if (data.dueDate && Number.isNaN(new Date(data.dueDate).getTime())) errors.push('Invalid due date format');

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.title !== undefined && data.title.trim().length === 0) errors.push('Issue title cannot be empty');

    if (data.issueType !== undefined) {
      if (!VALID_ISSUE_TYPES.includes(data.issueType as any)) {
        errors.push(`Invalid issueType: must be one of ${VALID_ISSUE_TYPES.join(', ')}`);
      }
    }

    if (data.bugSeverity !== undefined && data.bugSeverity !== null) {
      if (!VALID_BUG_SEVERITIES.includes(data.bugSeverity as any)) {
        errors.push(`Invalid bugSeverity: must be one of ${VALID_BUG_SEVERITIES.join(', ')}`);
      }
    }

    if (data.storyPoints !== undefined && data.storyPoints !== null) {
      const sp = Number(data.storyPoints);
      if (!Number.isInteger(sp) || sp < 0) {
        errors.push('storyPoints must be a non-negative integer');
      }
    }

    if (data.status && !['todo', 'in_progress', 'in_review', 'done'].includes(data.status)) errors.push('Invalid status specified');
    if (data.priority && !['low', 'medium', 'high', 'critical'].includes(data.priority)) errors.push('Invalid priority specified');
    if (data.estimatedHours !== undefined && (isNaN(data.estimatedHours) || data.estimatedHours < 0)) errors.push('Estimated hours must be a positive number');
    if (data.actualHours !== undefined && (isNaN(data.actualHours) || data.actualHours < 0)) errors.push('Actual hours must be a positive number');
    if (data.dueDate !== undefined && data.dueDate !== null && Number.isNaN(new Date(data.dueDate).getTime())) errors.push('Invalid due date format');

    return errors;
  }
}

export default Issue;
