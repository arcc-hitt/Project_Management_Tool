import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId } from '../utils/mongo.js';
import Issue from '../models/Issue.js';
import SavedFilter, { FilterCriteria } from '../models/SavedFilter.js';
import ProjectMember from '../models/ProjectMember.js';

class SearchService {
  async unifiedSearch(options: any = {}) {
    const { query = '', page = 1, limit = 20, userId } = options;

    if (!query || query.trim().length === 0) {
      return {
        projects: [],
        tasks: [],
        users: [],
        comments: [],
        pagination: {
          totalItems: 0,
          totalPages: 0,
          currentPage: page,
          itemsPerPage: limit,
        },
      };
    }

    const [projects, tasks, users, comments] = await Promise.all([
      this.searchProjects({ query, userId, limit: 5 }),
      this.searchTasks({ query, userId, limit: 5 }),
      this.searchUsers({ query, limit: 5 }),
      this.searchComments({ query, userId, limit: 5 }),
    ]);

    const totalItems = projects.length + tasks.length + users.length + comments.length;
    return {
      projects,
      tasks,
      users,
      comments,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
        currentPage: page,
        itemsPerPage: limit,
      },
    };
  }

  async searchProjects(options: any = {}) {
    const { query = '', userId, limit = 10 } = options;
    const projects = await database.getCollection('projects');
    const users = await database.getCollection('users');
    const members = await database.getCollection('project_members');

    const regex = new RegExp(query, 'i');
    const filter: Record<string, any> = { $or: [{ name: regex }, { description: regex }] };

    let rows = await projects.find(filter).sort({ createdAt: -1 }).limit(Number(limit) * 3).toArray();
    if (userId) {
      const memberships = await members.find({ userId }).project({ projectId: 1 }).toArray();
      const memberIds = new Set(memberships.map((m) => m.projectId));
      rows = rows.filter((p) => p.createdBy === userId || memberIds.has(normalizeId(p._id)));
    }
    rows = rows.slice(0, Number(limit));
    const creatorIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const creatorDocs = await users.find({ _id: { $in: creatorIds } }).toArray();
    const creatorMap: Map<string, any> = new Map(creatorDocs.map((u) => [normalizeId(u._id), u]));

    return rows.map((row) => {
      const mapped = mapDoc(row);
      const creator = mapped.createdBy ? creatorMap.get(mapped.createdBy) : null;
      mapped.createdByName = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : null;
      return mapped;
    });
  }

  async searchTasks(options: any = {}) {
    const { query = '', userId, limit = 10 } = options;
    const tasks = await database.getCollection('tasks');
    const projects = await database.getCollection('projects');
    const users = await database.getCollection('users');
    const members = await database.getCollection('project_members');

    const regex = new RegExp(query, 'i');
    const filter: Record<string, any> = { $or: [{ title: regex }, { description: regex }] };

    if (userId) {
      const memberships = await members.find({ userId }).project({ projectId: 1 }).toArray();
      const memberIds = memberships.map((m) => m.projectId);
      filter.$and = [{
        $or: [
          { assignedTo: userId },
          { createdBy: userId },
          { projectId: { $in: memberIds } },
        ],
      }];
    }

    const rows = await tasks.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).toArray();

    const projectIds = [...new Set(rows.map((r) => r.projectId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const userIds = [...new Set(rows.flatMap((r) => [r.assignedTo, r.createdBy]).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);

    const [projectDocs, userDocs] = await Promise.all([
      projects.find({ _id: { $in: projectIds } }).toArray(),
      users.find({ _id: { $in: userIds } }).toArray(),
    ]);

    const projectMap: Map<string, any> = new Map(projectDocs.map((p) => [normalizeId(p._id), p]));
    const userMap: Map<string, any> = new Map(userDocs.map((u) => [normalizeId(u._id), u]));

    return rows.map((row) => {
      const mapped = mapDoc(row);
      const project = mapped.projectId ? projectMap.get(mapped.projectId) : null;
      const assignee = mapped.assignedTo ? userMap.get(mapped.assignedTo) : null;
      const creator = mapped.createdBy ? userMap.get(mapped.createdBy) : null;
      mapped.projectName = project?.name || null;
      mapped.assignedToName = assignee ? `${assignee.firstName || ''} ${assignee.lastName || ''}`.trim() : null;
      mapped.createdByName = creator ? `${creator.firstName || ''} ${creator.lastName || ''}`.trim() : null;
      return mapped;
    });
  }

  async searchUsers(options: any = {}) {
    const { query = '', limit = 10 } = options;
    const users = await database.getCollection('users');

    const regex = new RegExp(query, 'i');
    const rows = await users
      .find({ isActive: true, $or: [{ firstName: regex }, { lastName: regex }, { email: regex }] })
      .project({ passwordHash: 0 })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .toArray();

    return rows.map((row) => mapDoc(row));
  }

  async searchComments(options: any = {}) {
    const { query = '', userId, limit = 10 } = options;
    const comments = await database.getCollection('task_comments');
    const tasks = await database.getCollection('tasks');
    const projects = await database.getCollection('projects');
    const users = await database.getCollection('users');
    const members = await database.getCollection('project_members');

    const regex = new RegExp(query, 'i');
    const filter: Record<string, any> = { comment: regex };

    if (userId) {
      const memberships = await members.find({ userId }).project({ projectId: 1 }).toArray();
      const memberIds = new Set(memberships.map((m) => m.projectId));
      const taskRows = await tasks.find({ projectId: { $in: [...memberIds] } }).project({ _id: 1 }).toArray();
      filter.taskId = { $in: taskRows.map((t) => normalizeId(t._id)) };
    }

    const rows = await comments.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).toArray();
    const taskIds = [...new Set(rows.map((r) => r.taskId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);

    const [taskDocs, userDocs] = await Promise.all([
      tasks.find({ _id: { $in: taskIds } }).toArray(),
      users.find({ _id: { $in: userIds } }).toArray(),
    ]);

    const projectIds = [...new Set(taskDocs.map((t) => t.projectId).filter(Boolean))].map((id) => toObjectId(id)).filter(Boolean);
    const projectDocs = await projects.find({ _id: { $in: projectIds } }).toArray();

    const taskMap: Map<string, any> = new Map(taskDocs.map((t) => [normalizeId(t._id), t]));
    const userMap: Map<string, any> = new Map(userDocs.map((u) => [normalizeId(u._id), u]));
    const projectMap: Map<string, any> = new Map(projectDocs.map((p) => [normalizeId(p._id), p]));

    return rows.map((row) => {
      const mapped = mapDoc(row);
      const task = mapped.taskId ? taskMap.get(mapped.taskId) : null;
      const project = task?.projectId ? projectMap.get(task.projectId) : null;
      const user = mapped.userId ? userMap.get(mapped.userId) : null;
      mapped.taskTitle = task?.title || null;
      mapped.projectName = project?.name || null;
      mapped.userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null;
      return mapped;
    });
  }

  async searchIssues(options: any = {}) {
    const {
      query = '',
      page = 1,
      limit = 25,
      issueType,
      status,
      priority,
      assigneeId,
      projectId,
      sprintId,
      label,
      componentId,
      bugSeverity,
      versionId,
      epicId,
      storyPointsMin,
      storyPointsMax,
      createdAtFrom,
      createdAtTo,
      updatedAtFrom,
      updatedAtTo,
      dueDateFrom,
      dueDateTo,
    } = options;

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
    const offset = (pageNum - 1) * limitNum;

    const findOptions: any = {
      limit: limitNum,
      offset,
    };

    if (query && query.trim().length > 0) findOptions.search = query.trim();
    if (issueType) findOptions.issueType = issueType;
    if (status) findOptions.status = status;
    if (priority) findOptions.priority = priority;
    if (assigneeId) findOptions.assignedTo = assigneeId;
    if (projectId) findOptions.projectId = projectId;
    if (sprintId) findOptions.sprintId = sprintId;
    if (componentId) findOptions.componentId = componentId;
    if (bugSeverity) findOptions.bugSeverity = bugSeverity;
    if (versionId) findOptions.versionId = versionId;
    if (epicId) findOptions.epicId = epicId;

    // label filter requires special handling (array field)
    let issues = await Issue.findAll(findOptions);

    // Apply post-fetch filters that Issue.findAll doesn't support natively
    if (label) {
      const labelArr = Array.isArray(label) ? label : [label];
      issues = issues.filter((issue) =>
        Array.isArray(issue.labels) && labelArr.some((l) => issue.labels.includes(l))
      );
    }

    if (storyPointsMin !== undefined && storyPointsMin !== null) {
      const min = Number(storyPointsMin);
      issues = issues.filter((issue) => issue.storyPoints != null && issue.storyPoints >= min);
    }
    if (storyPointsMax !== undefined && storyPointsMax !== null) {
      const max = Number(storyPointsMax);
      issues = issues.filter((issue) => issue.storyPoints != null && issue.storyPoints <= max);
    }

    if (createdAtFrom) {
      const from = new Date(createdAtFrom);
      issues = issues.filter((issue) => issue.createdAt && new Date(issue.createdAt) >= from);
    }
    if (createdAtTo) {
      const to = new Date(createdAtTo);
      issues = issues.filter((issue) => issue.createdAt && new Date(issue.createdAt) <= to);
    }

    if (updatedAtFrom) {
      const from = new Date(updatedAtFrom);
      issues = issues.filter((issue) => issue.updatedAt && new Date(issue.updatedAt) >= from);
    }
    if (updatedAtTo) {
      const to = new Date(updatedAtTo);
      issues = issues.filter((issue) => issue.updatedAt && new Date(issue.updatedAt) <= to);
    }

    if (dueDateFrom) {
      const from = new Date(dueDateFrom);
      issues = issues.filter((issue) => issue.dueDate && new Date(issue.dueDate) >= from);
    }
    if (dueDateTo) {
      const to = new Date(dueDateTo);
      issues = issues.filter((issue) => issue.dueDate && new Date(issue.dueDate) <= to);
    }

    // Count total for pagination
    const issuesCollection = await database.getCollection('issues');
    const countFilter: Record<string, any> = {};
    if (query && query.trim().length > 0) {
      const regex = new RegExp(query.trim(), 'i');
      countFilter.$or = [{ title: regex }, { description: regex }];
    }
    if (issueType) countFilter.issueType = issueType;
    if (status) countFilter.status = status;
    if (priority) countFilter.priority = priority;
    if (assigneeId) countFilter.assignedTo = assigneeId;
    if (projectId) countFilter.projectId = projectId;
    if (sprintId) countFilter.sprintId = sprintId;
    if (componentId) countFilter.componentId = componentId;
    if (bugSeverity) countFilter.bugSeverity = bugSeverity;
    if (versionId) countFilter.versionId = versionId;
    if (epicId) countFilter.epicId = epicId;
    if (label) {
      const labelArr = Array.isArray(label) ? label : [label];
      countFilter.labels = { $in: labelArr };
    }
    if (storyPointsMin !== undefined && storyPointsMin !== null) {
      countFilter.storyPoints = { ...countFilter.storyPoints, $gte: Number(storyPointsMin) };
    }
    if (storyPointsMax !== undefined && storyPointsMax !== null) {
      countFilter.storyPoints = { ...countFilter.storyPoints, $lte: Number(storyPointsMax) };
    }
    if (createdAtFrom || createdAtTo) {
      countFilter.createdAt = {};
      if (createdAtFrom) countFilter.createdAt.$gte = new Date(createdAtFrom);
      if (createdAtTo) countFilter.createdAt.$lte = new Date(createdAtTo);
    }
    if (updatedAtFrom || updatedAtTo) {
      countFilter.updatedAt = {};
      if (updatedAtFrom) countFilter.updatedAt.$gte = new Date(updatedAtFrom);
      if (updatedAtTo) countFilter.updatedAt.$lte = new Date(updatedAtTo);
    }
    if (dueDateFrom || dueDateTo) {
      countFilter.dueDate = {};
      if (dueDateFrom) countFilter.dueDate.$gte = new Date(dueDateFrom);
      if (dueDateTo) countFilter.dueDate.$lte = new Date(dueDateTo);
    }

    const totalItems = await issuesCollection.countDocuments(countFilter);
    const totalPages = Math.ceil(totalItems / limitNum);

    return {
      issues,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNum,
        itemsPerPage: limitNum,
      },
    };
  }

  async saveFilter(userId: string, name: string, criteria: FilterCriteria, organizationId?: string) {
    return SavedFilter.create({ userId, name, criteria, organizationId: organizationId || null });
  }

  async runFilter(filterId: string, userId: string) {
    const filter = await SavedFilter.findById(filterId);
    if (!filter) {
      const err: any = new Error('Filter not found');
      err.status = 404;
      throw err;
    }

    if (filter.userId !== userId) {
      const err: any = new Error('Access denied');
      err.status = 403;
      throw err;
    }

    const criteria: FilterCriteria = filter.criteria || {};

    if (criteria.projectId) {
      const membership = await ProjectMember.findOne({ projectId: criteria.projectId, userId });
      if (!membership) {
        const err: any = new Error('Access denied: not a project member');
        err.status = 403;
        throw err;
      }
    }

    return this.searchIssues(criteria);
  }

  async listFilters(userId: string, organizationId?: string) {
    return SavedFilter.findByUser(userId, organizationId);
  }

  async deleteFilter(filterId: string, userId: string) {
    const filter = await SavedFilter.findById(filterId);
    if (!filter) {
      const err: any = new Error('Filter not found');
      err.status = 404;
      throw err;
    }

    if (filter.userId !== userId) {
      const err: any = new Error('Access denied');
      err.status = 403;
      throw err;
    }

    return SavedFilter.delete(filterId);
  }

  async getSearchSuggestions(options: any = {}) {
    const { query = '', limit = 5 } = options;
    if (!query || String(query).trim().length === 0) {
      return [];
    }

    const [projects, tasks, users] = await Promise.all([
      this.searchProjects({ query, limit }),
      this.searchTasks({ query, limit }),
      this.searchUsers({ query, limit }),
    ]);

    const suggestions = [
      ...projects.map((p) => ({ type: 'project', label: p.name, id: p.id })),
      ...tasks.map((t) => ({ type: 'task', label: t.title, id: t.id })),
      ...users.map((u) => ({ type: 'user', label: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email, id: u.id })),
    ];

    return suggestions.slice(0, Number(limit));
  }

  async getFilterOptions(userId?: string) {
    const projects = await this.searchProjects({ query: '', userId, limit: 200 });
    const tasks = await this.searchTasks({ query: '', userId, limit: 200 });

    return {
      projects: projects.map((p) => ({ id: p.id, name: p.name })).filter((p) => p.id),
      taskStatuses: [...new Set(tasks.map((t) => t.status).filter(Boolean))],
      taskPriorities: [...new Set(tasks.map((t) => t.priority).filter(Boolean))],
    };
  }
}

export default new SearchService();
