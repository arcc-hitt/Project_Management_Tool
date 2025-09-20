import { 
  Project, 
  Task, 
  User, 
  Comment, 
  TimeEntry, 
  ActivityLog,
  ProjectMember,
  TaskAssignment 
} from '../models/index.js';

class SearchService {
  /**
   * Perform unified search across multiple entities
   * @param {Object} params - Search parameters
   * @param {string} params.query - Search query string
   * @param {Array} params.types - Types to search in ['projects', 'tasks', 'users', 'comments']
   * @param {Object} params.filters - Additional filters
   * @param {Object} params.pagination - Pagination options
   * @param {number} params.userId - Current user ID for permission filtering
   * @returns {Object} Search results grouped by type
   */
  async unifiedSearch({ query, types = ['projects', 'tasks', 'users', 'comments'], filters = {}, pagination = {}, userId }) {
    const results = {};
    const { limit = 10, offset = 0 } = pagination;

    // Build search options
    const searchOptions = this._buildSearchOptions(query, filters, { limit, offset }, userId);

    // Search each requested type
    if (types.includes('projects')) {
      results.projects = await this.searchProjects({ ...searchOptions, userId });
    }

    if (types.includes('tasks')) {
      results.tasks = await this.searchTasks({ ...searchOptions, userId });
    }

    if (types.includes('users')) {
      results.users = await this.searchUsers({ ...searchOptions, userId });
    }

    if (types.includes('comments')) {
      results.comments = await this.searchComments({ ...searchOptions, userId });
    }

    return {
      results,
      query,
      types,
      filters,
      pagination
    };
  }

  /**
   * Search projects with advanced filtering
   * @param {Object} params - Search parameters
   * @returns {Object} Projects and metadata
   */
  async searchProjects({ query, filters = {}, pagination = {}, userId }) {
    const { limit = 10, offset = 0 } = pagination;
    const whereClause = this._buildProjectSearchWhere(query, filters, userId);
    const orderClause = this._buildOrderClause(filters.sortBy, filters.sortOrder);

    const { count, rows } = await Project.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'owner',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: ProjectMember,
          as: 'members',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }]
        },
        {
          model: Task,
          as: 'tasks',
          attributes: ['id', 'title', 'status', 'priority']
        }
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true
    });

    return {
      projects: rows,
      total: count,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(count / limit),
        currentPage: Math.floor(offset / limit) + 1
      }
    };
  }

  /**
   * Search tasks with advanced filtering
   * @param {Object} params - Search parameters
   * @returns {Object} Tasks and metadata
   */
  async searchTasks({ query, filters = {}, pagination = {}, userId }) {
    const { limit = 10, offset = 0 } = pagination;
    const whereClause = this._buildTaskSearchWhere(query, filters, userId);
    const orderClause = this._buildOrderClause(filters.sortBy, filters.sortOrder);

    const { count, rows } = await Task.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Project,
          as: 'project',
          attributes: ['id', 'name', 'description'],
          include: [{
            model: ProjectMember,
            as: 'members',
            where: { userId },
            required: false
          }]
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: TaskAssignment,
          as: 'assignments',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }]
        },
        {
          model: TimeEntry,
          as: 'timeEntries',
          attributes: ['id', 'duration', 'date']
        }
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true
    });

    return {
      tasks: rows,
      total: count,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(count / limit),
        currentPage: Math.floor(offset / limit) + 1
      }
    };
  }

  /**
   * Search users with filtering
   * @param {Object} params - Search parameters
   * @returns {Object} Users and metadata
   */
  async searchUsers({ query, filters = {}, pagination = {}, userId }) {
    const { limit = 10, offset = 0 } = pagination;
    const whereClause = this._buildUserSearchWhere(query, filters);
    const orderClause = this._buildOrderClause(filters.sortBy, filters.sortOrder);

    const { count, rows } = await User.findAndCountAll({
      where: whereClause,
      attributes: { exclude: ['password', 'refreshToken'] },
      include: [
        {
          model: ProjectMember,
          as: 'projectMemberships',
          include: [{
            model: Project,
            as: 'project',
            attributes: ['id', 'name', 'status']
          }]
        }
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true
    });

    return {
      users: rows,
      total: count,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(count / limit),
        currentPage: Math.floor(offset / limit) + 1
      }
    };
  }

  /**
   * Search comments with filtering
   * @param {Object} params - Search parameters
   * @returns {Object} Comments and metadata
   */
  async searchComments({ query, filters = {}, pagination = {}, userId }) {
    const { limit = 10, offset = 0 } = pagination;
    const whereClause = this._buildCommentSearchWhere(query, filters, userId);
    const orderClause = this._buildOrderClause(filters.sortBy, filters.sortOrder);

    const { count, rows } = await Comment.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'author',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        {
          model: Task,
          as: 'task',
          attributes: ['id', 'title', 'status'],
          include: [{
            model: Project,
            as: 'project',
            attributes: ['id', 'name'],
            include: [{
              model: ProjectMember,
              as: 'members',
              where: { userId },
              required: true
            }]
          }]
        }
      ],
      order: orderClause,
      limit,
      offset,
      distinct: true
    });

    return {
      comments: rows,
      total: count,
      pagination: {
        limit,
        offset,
        totalPages: Math.ceil(count / limit),
        currentPage: Math.floor(offset / limit) + 1
      }
    };
  }

  /**
   * Get search suggestions based on partial query
   * @param {Object} params - Search parameters
   * @returns {Object} Suggestions grouped by type
   */
  async getSearchSuggestions({ query, types = ['projects', 'tasks', 'users'], userId }) {
    if (!query || query.length < 2) {
      return { suggestions: {} };
    }

    const suggestions = {};
    const limit = 5; // Limit suggestions per type

    if (types.includes('projects')) {
      const projects = await Project.findAll({
        where: this._buildProjectSearchWhere(query, {}, userId),
        attributes: ['id', 'name'],
        limit
      });
      suggestions.projects = projects.map(p => ({ id: p.id, name: p.name, type: 'project' }));
    }

    if (types.includes('tasks')) {
      const tasks = await Task.findAll({
        where: this._buildTaskSearchWhere(query, {}, userId),
        attributes: ['id', 'title'],
        include: [{
          model: Project,
          as: 'project',
          attributes: ['name'],
          include: [{
            model: ProjectMember,
            as: 'members',
            where: { userId },
            required: false
          }]
        }],
        limit
      });
      suggestions.tasks = tasks.map(t => ({ id: t.id, name: t.title, type: 'task', project: t.project?.name }));
    }

    if (types.includes('users')) {
      const users = await User.findAll({
        where: this._buildUserSearchWhere(query, {}),
        attributes: ['id', 'firstName', 'lastName'],
        limit
      });
      suggestions.users = users.map(u => ({ 
        id: u.id, 
        name: `${u.firstName} ${u.lastName}`, 
        type: 'user' 
      }));
    }

    return { suggestions };
  }

  /**
   * Get available filter options for advanced search
   * @param {number} userId - Current user ID
   * @returns {Object} Available filter options
   */
  async getFilterOptions(userId) {
    // Get user's accessible projects
    const projects = await Project.findAll({
      include: [{
        model: ProjectMember,
        as: 'members',
        where: { userId },
        required: false
      }],
      where: {
        [Op.or]: [
          { ownerId: userId },
          { '$members.userId$': userId }
        ]
      },
      attributes: ['id', 'name', 'status']
    });

    // Get available statuses
    const projectStatuses = ['active', 'completed', 'on_hold', 'cancelled'];
    const taskStatuses = ['todo', 'in_progress', 'review', 'done'];
    const taskPriorities = ['low', 'medium', 'high', 'urgent'];

    return {
      projects: projects.map(p => ({ id: p.id, name: p.name })),
      projectStatuses,
      taskStatuses,
      taskPriorities,
      userRoles: ['admin', 'manager', 'developer', 'designer', 'tester']
    };
  }

  // Private helper methods
  _buildSearchOptions(query, filters, pagination, userId) {
    return { query, filters, pagination, userId };
  }

  _buildProjectSearchWhere(query, filters, userId) {
    const where = {
      [Op.and]: []
    };

    // Text search
    if (query) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } }
        ]
      });
    }

    // Status filter
    if (filters.status) {
      where[Op.and].push({ status: filters.status });
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      const dateFilter = {};
      if (filters.startDate) dateFilter[Op.gte] = new Date(filters.startDate);
      if (filters.endDate) dateFilter[Op.lte] = new Date(filters.endDate);
      where[Op.and].push({ createdAt: dateFilter });
    }

    // User access filter
    where[Op.and].push({
      [Op.or]: [
        { ownerId: userId },
        { '$members.userId$': userId }
      ]
    });

    return where[Op.and].length > 0 ? where : {};
  }

  _buildTaskSearchWhere(query, filters, userId) {
    const where = {
      [Op.and]: []
    };

    // Text search
    if (query) {
      where[Op.and].push({
        [Op.or]: [
          { title: { [Op.iLike]: `%${query}%` } },
          { description: { [Op.iLike]: `%${query}%` } }
        ]
      });
    }

    // Status filter
    if (filters.status) {
      where[Op.and].push({ status: filters.status });
    }

    // Priority filter
    if (filters.priority) {
      where[Op.and].push({ priority: filters.priority });
    }

    // Project filter
    if (filters.projectId) {
      where[Op.and].push({ projectId: filters.projectId });
    }

    // Assignee filter
    if (filters.assigneeId) {
      where[Op.and].push({ '$assignments.userId$': filters.assigneeId });
    }

    // Due date filter
    if (filters.dueDate) {
      const dueDate = new Date(filters.dueDate);
      where[Op.and].push({ dueDate: { [Op.lte]: dueDate } });
    }

    return where[Op.and].length > 0 ? where : {};
  }

  _buildUserSearchWhere(query, filters) {
    const where = {
      [Op.and]: []
    };

    // Text search
    if (query) {
      where[Op.and].push({
        [Op.or]: [
          { firstName: { [Op.iLike]: `%${query}%` } },
          { lastName: { [Op.iLike]: `%${query}%` } },
          { email: { [Op.iLike]: `%${query}%` } }
        ]
      });
    }

    // Role filter
    if (filters.role) {
      where[Op.and].push({ role: filters.role });
    }

    // Active users only
    where[Op.and].push({ isEmailVerified: true });

    return where[Op.and].length > 0 ? where : {};
  }

  _buildCommentSearchWhere(query, filters, userId) {
    const where = {
      [Op.and]: []
    };

    // Text search
    if (query) {
      where[Op.and].push({
        content: { [Op.iLike]: `%${query}%` }
      });
    }

    // Project filter
    if (filters.projectId) {
      where[Op.and].push({ '$task.projectId$': filters.projectId });
    }

    // Task filter
    if (filters.taskId) {
      where[Op.and].push({ taskId: filters.taskId });
    }

    return where[Op.and].length > 0 ? where : {};
  }

  _buildOrderClause(sortBy = 'createdAt', sortOrder = 'DESC') {
    const validSortFields = {
      name: 'name',
      title: 'title',
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      status: 'status',
      priority: 'priority',
      dueDate: 'dueDate'
    };

    const field = validSortFields[sortBy] || 'createdAt';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    return [[field, order]];
  }
}

export default new SearchService();