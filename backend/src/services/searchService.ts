import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId } from '../utils/mongo.js';

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
