import { Project, Task, User, Comment, Notification, TimeEntry, ActivityLog } from '../models/index.js';
import { snakeToCamel, formatDateForDB } from '../utils/helpers.js';

class DashboardService {
  /**
   * Get comprehensive dashboard overview
   * @param {number} userId - Current user ID
   * @param {string} userRole - Current user role
   * @param {object} options - Filter options
   * @returns {object} Dashboard overview data
   */
  async getDashboardOverview(userId, userRole, options = {}) {
    const { dateRange = '30', projectId } = options;

    try {
      const dateFilter = this.getDateFilter(dateRange);
      
      const [
        projectStats,
        taskStats,
        userStats,
        timeStats,
        recentActivities,
        taskDistribution,
        projectProgress,
        timeDistribution
      ] = await Promise.all([
        this.getProjectStatistics(userId, userRole, dateFilter, projectId),
        this.getTaskStatistics(userId, userRole, dateFilter, projectId),
        this.getUserStatistics(userId, userRole, dateFilter, projectId),
        this.getTimeStatistics(userId, userRole, dateFilter, projectId),
        this.getRecentActivities(userId, userRole, projectId),
        this.getTaskDistribution(userId, userRole, projectId),
        this.getProjectProgress(userId, userRole, projectId),
        this.getTimeDistribution(userId, userRole, dateFilter, projectId)
      ]);

      return {
        overview: {
          projects: projectStats,
          tasks: taskStats,
          users: userStats,
          timeTracking: timeStats
        },
        charts: {
          taskDistribution,
          projectProgress,
          timeDistribution
        },
        recentActivities,
        dateRange: parseInt(dateRange)
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get project statistics using Project model
   */
  async getProjectStatistics(userId, userRole, dateFilter, projectId) {
    try {
      // Get accessible projects based on user role
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      const projectIds = accessibleProjects.map(p => p.id);

      if (projectIds.length === 0) {
        return {
          total: 0,
          active: 0,
          completed: 0,
          overdue: 0,
          onTrack: 0
        };
      }

      // Get all projects with date filter
      const whereConditions = {
        id: { $in: projectIds },
        ...dateFilter
      };

      const [allProjects, activeProjects, completedProjects] = await Promise.all([
        Project.findAll({ where: whereConditions }),
        Project.findAll({ where: { ...whereConditions, status: 'active' } }),
        Project.findAll({ where: { ...whereConditions, status: 'completed' } })
      ]);

      // Check for overdue projects
      const now = new Date();
      const overdueProjects = allProjects.filter(project => 
        project.endDate && 
        new Date(project.endDate) < now && 
        !['completed', 'cancelled'].includes(project.status)
      );

      const stats = {
        total: allProjects.length,
        active: activeProjects.length,
        completed: completedProjects.length,
        overdue: overdueProjects.length,
        onTrack: activeProjects.length - overdueProjects.length
      };

      return stats;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get task statistics using Task model
   */
  async getTaskStatistics(userId, userRole, dateFilter, projectId) {
    try {
      // Get accessible projects based on user role
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      const projectIds = accessibleProjects.map(p => p.id);

      if (projectIds.length === 0) {
        return {
          total: 0,
          byStatus: { todo: 0, inProgress: 0, inReview: 0, done: 0 },
          overdue: 0,
          highPriority: 0,
          completionRate: 0,
          averageCompletionTime: 0
        };
      }

      // Base where conditions for tasks
      const baseWhere = {
        projectId: { $in: projectIds },
        ...dateFilter
      };

      // Get all tasks and filter by status
      const [
        allTasks,
        todoTasks,
        inProgressTasks,
        inReviewTasks,
        doneTasks,
        highPriorityTasks,
        completedTasksWithHours
      ] = await Promise.all([
        Task.findAll({ where: baseWhere }),
        Task.findAll({ where: { ...baseWhere, status: 'todo' } }),
        Task.findAll({ where: { ...baseWhere, status: 'in_progress' } }),
        Task.findAll({ where: { ...baseWhere, status: 'in_review' } }),
        Task.findAll({ where: { ...baseWhere, status: 'done' } }),
        Task.findAll({ where: { ...baseWhere, priority: { $in: ['high', 'critical'] } } }),
        Task.findAll({ 
          where: { 
            ...baseWhere, 
            status: 'done',
            actualHours: { $ne: null }
          }
        })
      ]);

      // Calculate overdue tasks
      const now = new Date();
      const overdueTasks = allTasks.filter(task => 
        task.dueDate && 
        new Date(task.dueDate) < now && 
        task.status !== 'done'
      );

      // Calculate average completion time
      const totalHours = completedTasksWithHours.reduce((sum, task) => sum + (task.actualHours || 0), 0);
      const avgCompletionTime = completedTasksWithHours.length > 0 
        ? Math.round(totalHours / completedTasksWithHours.length) 
        : 0;

      const total = allTasks.length;
      const completed = doneTasks.length;
      const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        total,
        byStatus: {
          todo: todoTasks.length,
          inProgress: inProgressTasks.length,
          inReview: inReviewTasks.length,
          done: completed
        },
        overdue: overdueTasks.length,
        highPriority: highPriorityTasks.length,
        completionRate,
        averageCompletionTime: avgCompletionTime
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user statistics using User model
   */
  async getUserStatistics(userId, userRole, dateFilter, projectId) {
    try {
      if (userRole === 'developer') {
        // For developers, show only their own stats
        return await this.getDeveloperStats(userId, dateFilter);
      }

      // For admins and managers, get team statistics
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      const projectIds = accessibleProjects.map(p => p.id);

      // Get all active users
      const baseWhere = {
        isActive: true,
        ...dateFilter
      };

      // Get users involved in accessible projects
      let relevantUsers;
      if (userRole === 'admin') {
        // Admins can see all users
        relevantUsers = await User.findAll({ where: baseWhere });
      } else {
        // Managers see users in their projects
        relevantUsers = await User.findAll({
          include: [{
            model: Project,
            as: 'projects',
            where: { id: { $in: projectIds } },
            through: { attributes: [] }
          }],
          where: baseWhere
        });
      }

      // Calculate active users (logged in within 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const activeUsers = relevantUsers.filter(user => 
        user.lastLogin && new Date(user.lastLogin) > sevenDaysAgo
      );

      // Calculate role distribution
      const roleDistribution = {};
      relevantUsers.forEach(user => {
        roleDistribution[user.role] = (roleDistribution[user.role] || 0) + 1;
      });

      return {
        total: relevantUsers.length,
        active: activeUsers.length,
        roleDistribution
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get developer-specific statistics using Task model
   */
  async getDeveloperStats(userId, dateFilter) {
    try {
      const baseWhere = {
        assignedTo: userId,
        ...dateFilter
      };

      const [assignedTasks, completedTasks, tasksWithHours] = await Promise.all([
        Task.findAll({ where: baseWhere }),
        Task.findAll({ where: { ...baseWhere, status: 'done' } }),
        Task.findAll({ 
          where: { 
            ...baseWhere, 
            status: 'done',
            actualHours: { $ne: null }
          }
        })
      ]);

      // Get unique project IDs from assigned tasks
      const uniqueProjectIds = [...new Set(assignedTasks.map(task => task.projectId))];

      // Calculate average task time
      const totalHours = tasksWithHours.reduce((sum, task) => sum + (task.actualHours || 0), 0);
      const avgTaskTime = tasksWithHours.length > 0 
        ? Math.round(totalHours / tasksWithHours.length) 
        : 0;

      const assigned = assignedTasks.length;
      const completed = completedTasks.length;
      const completionRate = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

      return {
        assignedTasks: assigned,
        completedTasks: completed,
        activeProjects: uniqueProjectIds.length,
        completionRate,
        averageTaskTime: avgTaskTime
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get recent activities using models
   */
  async getRecentActivities(userId, userRole, projectId, limit = 10) {
    try {
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      const projectIds = accessibleProjects.map(p => p.id);

      if (projectIds.length === 0) {
        return [];
      }

      const activities = [];

      // Get recent projects
      const recentProjects = await Project.findAll({
        where: { id: { $in: projectIds } },
        include: [{ model: User, as: 'creator', attributes: ['firstName', 'lastName'] }],
        order: [['createdAt', 'DESC']],
        limit: Math.min(limit, 5)
      });

      recentProjects.forEach(project => {
        activities.push({
          activityType: 'project_created',
          entityName: project.name,
          activityDate: project.createdAt,
          userName: project.creator ? `${project.creator.firstName} ${project.creator.lastName}` : 'Unknown',
          projectName: project.name,
          entityId: project.id,
          entityType: 'project'
        });
      });

      // Get recent tasks
      const recentTasks = await Task.findAll({
        where: { projectId: { $in: projectIds } },
        include: [
          { model: User, as: 'creator', attributes: ['firstName', 'lastName'] },
          { model: Project, as: 'project', attributes: ['name'] }
        ],
        order: [['createdAt', 'DESC']],
        limit: Math.min(limit, 10)
      });

      recentTasks.forEach(task => {
        activities.push({
          activityType: 'task_created',
          entityName: task.title,
          activityDate: task.createdAt,
          userName: task.creator ? `${task.creator.firstName} ${task.creator.lastName}` : 'Unknown',
          projectName: task.project ? task.project.name : 'Unknown Project',
          entityId: task.id,
          entityType: 'task'
        });

        // Add update activity if task was updated
        if (task.updatedAt && task.updatedAt.getTime() !== task.createdAt.getTime()) {
          activities.push({
            activityType: 'task_updated',
            entityName: task.title,
            activityDate: task.updatedAt,
            userName: task.creator ? `${task.creator.firstName} ${task.creator.lastName}` : 'Unknown',
            projectName: task.project ? task.project.name : 'Unknown Project',
            entityId: task.id,
            entityType: 'task'
          });
        }
      });

      // Get recent comments
      const recentComments = await Comment.findAll({
        include: [
          { model: User, as: 'author', attributes: ['firstName', 'lastName'] },
          { 
            model: Task, 
            as: 'task',
            attributes: ['title', 'projectId'],
            where: { projectId: { $in: projectIds } },
            include: [{ model: Project, as: 'project', attributes: ['name'] }]
          }
        ],
        order: [['createdAt', 'DESC']],
        limit: Math.min(limit, 5)
      });

      recentComments.forEach(comment => {
        activities.push({
          activityType: 'comment_added',
          entityName: `Comment on: ${comment.task ? comment.task.title : 'Unknown Task'}`,
          activityDate: comment.createdAt,
          userName: comment.author ? `${comment.author.firstName} ${comment.author.lastName}` : 'Unknown',
          projectName: comment.task && comment.task.project ? comment.task.project.name : 'Unknown Project',
          entityId: comment.task ? comment.task.id : null,
          entityType: 'comment'
        });
      });

      // Sort all activities by date and limit
      activities.sort((a, b) => new Date(b.activityDate) - new Date(a.activityDate));
      
      return activities.slice(0, limit);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get task distribution for charts
   */
  async getTaskDistribution(userId, userRole, projectId) {
    try {
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      const projectIds = accessibleProjects.map(p => p.id);

      if (projectIds.length === 0) {
        return {
          byStatus: [],
          byPriority: [],
          byProject: []
        };
      }

      // Get all tasks for accessible projects
      const tasks = await Task.findAll({
        where: { projectId: { $in: projectIds } },
        include: [{ model: Project, as: 'project', attributes: ['name'] }]
      });

      // Group by status
      const statusGroups = {};
      tasks.forEach(task => {
        statusGroups[task.status] = (statusGroups[task.status] || 0) + 1;
      });

      // Group by priority
      const priorityGroups = {};
      tasks.forEach(task => {
        priorityGroups[task.priority] = (priorityGroups[task.priority] || 0) + 1;
      });

      // Group by project (top 5)
      const projectGroups = {};
      tasks.forEach(task => {
        const projectName = task.project ? task.project.name : 'Unknown Project';
        projectGroups[projectName] = (projectGroups[projectName] || 0) + 1;
      });

      // Convert to array format and sort by count
      const byProject = Object.entries(projectGroups)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      return {
        byStatus: Object.entries(statusGroups).map(([name, value]) => ({ name, value })),
        byPriority: Object.entries(priorityGroups).map(([name, value]) => ({ name, value })),
        byProject
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get project progress data using models
   */
  async getProjectProgress(userId, userRole, projectId) {
    try {
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      
      // Filter for active projects only
      const activeProjects = accessibleProjects.filter(p => 
        ['planning', 'active'].includes(p.status)
      ).slice(0, 10);

      if (activeProjects.length === 0) {
        return [];
      }

      const projectIds = activeProjects.map(p => p.id);

      // Get tasks for each project
      const tasks = await Task.findAll({
        where: { projectId: { $in: projectIds } }
      });

      // Group tasks by project
      const tasksByProject = {};
      tasks.forEach(task => {
        if (!tasksByProject[task.projectId]) {
          tasksByProject[task.projectId] = [];
        }
        tasksByProject[task.projectId].push(task);
      });

      // Calculate progress for each project
      return activeProjects.map(project => {
        const projectTasks = tasksByProject[project.id] || [];
        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
        
        const now = new Date();
        const overdueTasks = projectTasks.filter(t => 
          t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
        ).length;

        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const isOverdue = project.endDate && new Date(project.endDate) < now;

        return {
          id: project.id,
          name: project.name,
          status: project.status,
          progress,
          totalTasks,
          completedTasks,
          overdueTasks,
          isOverdue,
          endDate: project.endDate
        };
      }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get team performance metrics using models
   */
  async getTeamPerformance(userId, userRole, options = {}) {
    const { dateRange = '30', projectId } = options;

    try {
      if (userRole === 'developer') {
        throw new Error('Access denied. Insufficient permissions to view team performance.');
      }

      const dateFilter = this.getDateFilter(dateRange);
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      const projectIds = accessibleProjects.map(p => p.id);

      if (projectIds.length === 0) {
        return [];
      }

      // Get team members (developers, testers, designers)
      const teamMembers = await User.findAll({
        where: { 
          isActive: true, 
          role: { $in: ['developer', 'tester', 'designer'] },
          ...dateFilter
        }
      });

      // Get tasks for these team members
      const tasks = await Task.findAll({
        where: { 
          projectId: { $in: projectIds },
          assignedTo: { $in: teamMembers.map(m => m.id) },
          ...dateFilter
        }
      });

      // Calculate performance metrics for each team member
      const teamPerformance = teamMembers.map(member => {
        const memberTasks = tasks.filter(t => t.assignedTo === member.id);
        const assignedTasks = memberTasks.length;
        const completedTasks = memberTasks.filter(t => t.status === 'done').length;
        
        const now = new Date();
        const overdueTasks = memberTasks.filter(t => 
          t.dueDate && new Date(t.dueDate) < now && t.status !== 'done'
        ).length;

        // Calculate average completion time
        const completedWithHours = memberTasks.filter(t => 
          t.status === 'done' && t.actualHours !== null
        );
        const totalHours = completedWithHours.reduce((sum, t) => sum + (t.actualHours || 0), 0);
        const avgCompletionTime = completedWithHours.length > 0 
          ? Math.round(totalHours / completedWithHours.length) 
          : 0;

        // Get unique project count
        const activeProjects = [...new Set(memberTasks.map(t => t.projectId))].length;

        const completionRate = assignedTasks > 0 ? Math.round((completedTasks / assignedTasks) * 100) : 0;

        return {
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
          assignedTasks,
          completedTasks,
          overdueTasks,
          completionRate,
          averageCompletionTime: avgCompletionTime,
          activeProjects
        };
      }).filter(member => member.assignedTasks > 0)
        .sort((a, b) => b.completedTasks - a.completedTasks || b.assignedTasks - a.assignedTasks);

      return teamPerformance;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get productivity analytics using models
   */
  async getProductivityAnalytics(userId, userRole, options = {}) {
    const { dateRange = '30', projectId } = options;

    try {
      const dateFilter = this.getDateFilter(dateRange);
      const accessibleProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
      const projectIds = accessibleProjects.map(p => p.id);

      if (projectIds.length === 0) {
        return {
          completionTrends: [],
          timeAllocation: []
        };
      }

      // Get all tasks in the date range
      const tasks = await Task.findAll({
        where: { 
          projectId: { $in: projectIds },
          ...dateFilter
        }
      });

      // Generate completion trends (last 30 days)
      const trends = [];
      const days = parseInt(dateRange);
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayTasks = tasks.filter(t => {
          const taskDate = new Date(t.updatedAt).toISOString().split('T')[0];
          return taskDate === dateStr;
        });
        
        const completedTasks = dayTasks.filter(t => t.status === 'done').length;
        const totalTasks = dayTasks.length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        trends.push({
          date: dateStr,
          completed: completedTasks,
          total: totalTasks,
          completionRate
        });
      }

      // Get time allocation by priority
      const completedTasksWithHours = tasks.filter(t => 
        t.status === 'done' && t.actualHours !== null
      );

      const priorityGroups = {};
      completedTasksWithHours.forEach(task => {
        if (!priorityGroups[task.priority]) {
          priorityGroups[task.priority] = { totalHours: 0, taskCount: 0 };
        }
        priorityGroups[task.priority].totalHours += task.actualHours || 0;
        priorityGroups[task.priority].taskCount += 1;
      });

      const timeAllocation = Object.entries(priorityGroups).map(([priority, data]) => ({
        priority,
        totalHours: Math.round(data.totalHours),
        taskCount: data.taskCount,
        averageHours: Math.round(data.totalHours / data.taskCount)
      })).sort((a, b) => b.totalHours - a.totalHours);

      return {
        completionTrends: trends.reverse(), // Most recent first
        timeAllocation
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Helper method to get date filter for model queries
   */
  getDateFilter(dateRange) {
    const days = parseInt(dateRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return {
      createdAt: {
        $gte: cutoffDate
      }
    };
  }

  /**
   * Helper method to get project filter conditions for model queries
   */
  getProjectFilterConditions(userId, userRole, projectId) {
    const conditions = {};

    if (projectId) {
      conditions.id = projectId;
    }

    // For developers, we'll handle user filtering in the calling methods
    // since it requires joining with project_members
    return { conditions, userId, userRole };
  }

  /**
   * Helper method to check if user has access to projects based on role
   */
  async getUserAccessibleProjects(userId, userRole, projectId = null) {
    if (userRole === 'admin' || userRole === 'manager') {
      // Admins and managers can see all projects
      const conditions = projectId ? { id: projectId } : {};
      return await Project.findAll({ where: conditions });
    } else {
      // Developers can only see projects they're members of
      const userProjects = await Project.findAll({
        include: [{
          model: User,
          as: 'members',
          where: { id: userId },
          through: { attributes: [] }
        }],
        where: projectId ? { id: projectId } : {}
      });
      return userProjects;
    }
  }

  /**
   * Get time tracking statistics
   */
  async getTimeStatistics(userId, userRole, dateFilter, projectId) {
    try {
      const filters = {
        ...dateFilter,
        ...(projectId && { projectId })
      };

      // Role-based filtering for time entries
      if (userRole !== 'admin' && userRole !== 'manager') {
        // Developers can only see their own time entries
        filters.userId = userId;
      }

      const [totalHours, timeEntries, activeTimer] = await Promise.all([
        TimeEntry.getTotalHours(filters),
        TimeEntry.findAll({ ...filters, limit: 10 }),
        userRole !== 'admin' && userRole !== 'manager' ? 
          TimeEntry.getActiveTimer(userId) : null
      ]);

      // Calculate productivity metrics
      const totalDays = this.getDaysInDateRange(dateFilter);
      const avgHoursPerDay = totalDays > 0 ? (totalHours.totalHours / totalDays) : 0;

      return {
        totalHours: totalHours.totalHours,
        billableHours: totalHours.billableHours,
        totalEntries: totalHours.totalEntries,
        avgHoursPerDay: Math.round(avgHoursPerDay * 100) / 100,
        billablePercentage: totalHours.totalHours > 0 ? 
          Math.round((totalHours.billableHours / totalHours.totalHours) * 100) : 0,
        activeTimer: activeTimer,
        recentEntries: timeEntries.slice(0, 5)
      };

    } catch (error) {
      throw new Error(`Error getting time statistics: ${error.message}`);
    }
  }

  /**
   * Get time distribution analytics
   */
  async getTimeDistribution(userId, userRole, dateFilter, projectId) {
    try {
      const filters = {
        ...dateFilter,
        ...(projectId && { projectId })
      };

      // Role-based filtering
      if (userRole !== 'admin' && userRole !== 'manager') {
        filters.userId = userId;
      }

      const [
        projectTimeReport,
        userTimeReport,
        dailyTimeReport
      ] = await Promise.all([
        TimeEntry.getTimeReport({ ...filters, groupBy: 'project' }),
        TimeEntry.getTimeReport({ ...filters, groupBy: 'user' }),
        TimeEntry.getTimeReport({ ...filters, groupBy: 'date' })
      ]);

      return {
        byProject: projectTimeReport.map(entry => ({
          projectId: entry.projectId,
          projectName: entry.projectName,
          totalHours: entry.totalHours,
          billableHours: entry.billableHours,
          entryCount: entry.entryCount
        })),
        byUser: userTimeReport.map(entry => ({
          userId: entry.userId,
          userName: entry.userName,
          totalHours: entry.totalHours,
          billableHours: entry.billableHours,
          entryCount: entry.entryCount
        })),
        byDate: dailyTimeReport.map(entry => ({
          date: entry.workDate,
          totalHours: entry.totalHours,
          billableHours: entry.billableHours,
          entryCount: entry.entryCount
        })).slice(0, 30) // Last 30 days
      };

    } catch (error) {
      throw new Error(`Error getting time distribution: ${error.message}`);
    }
  }

  /**
   * Get team productivity analytics
   */
  async getTeamProductivity(userId, userRole, options = {}) {
    try {
      const { dateRange = '30', projectId } = options;
      const dateFilter = this.getDateFilter(dateRange);

      const filters = {
        ...dateFilter,
        ...(projectId && { projectId })
      };

      const [
        teamTimeStats,
        teamTaskStats,
        teamActivityStats
      ] = await Promise.all([
        this.getTeamTimeAnalytics(filters),
        this.getTeamTaskAnalytics(filters),
        this.getTeamActivityAnalytics(filters)
      ]);

      return {
        timeAnalytics: teamTimeStats,
        taskAnalytics: teamTaskStats,
        activityAnalytics: teamActivityStats,
        dateRange: parseInt(dateRange)
      };

    } catch (error) {
      throw new Error(`Error getting team productivity: ${error.message}`);
    }
  }

  /**
   * Get detailed project analytics
   */
  async getProjectAnalytics(projectId, userId, userRole, options = {}) {
    try {
      const { dateRange = '30' } = options;
      const dateFilter = this.getDateFilter(dateRange);

      // Check project access
      const project = await Project.findById(projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      // Role-based access check
      if (userRole !== 'admin' && userRole !== 'manager') {
        const userProjects = await this.getUserAccessibleProjects(userId, userRole, projectId);
        if (userProjects.length === 0) {
          throw new Error('Access denied to this project');
        }
      }

      const [
        projectOverview,
        taskAnalytics,
        timeAnalytics,
        teamPerformance,
        milestones
      ] = await Promise.all([
        this.getProjectOverview(projectId, dateFilter),
        this.getProjectTaskAnalytics(projectId, dateFilter),
        this.getProjectTimeAnalytics(projectId, dateFilter),
        this.getProjectTeamPerformance(projectId, dateFilter),
        this.getProjectMilestones(projectId)
      ]);

      return {
        project: projectOverview,
        analytics: {
          tasks: taskAnalytics,
          time: timeAnalytics,
          team: teamPerformance
        },
        milestones,
        dateRange: parseInt(dateRange)
      };

    } catch (error) {
      throw new Error(`Error getting project analytics: ${error.message}`);
    }
  }

  /**
   * Helper method to get days in date range
   */
  getDaysInDateRange(dateFilter) {
    if (dateFilter.createdAt && dateFilter.createdAt.$gte) {
      const startDate = new Date(dateFilter.createdAt.$gte);
      const endDate = new Date();
      const timeDiff = endDate.getTime() - startDate.getTime();
      return Math.ceil(timeDiff / (1000 * 3600 * 24));
    }
    return 30; // Default fallback
  }

  /**
   * Get team time analytics
   */
  async getTeamTimeAnalytics(filters) {
    try {
      const timeReport = await TimeEntry.getTimeReport({ ...filters, groupBy: 'user' });
      
      return {
        topPerformers: timeReport
          .sort((a, b) => b.totalHours - a.totalHours)
          .slice(0, 5),
        totalTeamHours: timeReport.reduce((sum, user) => sum + user.totalHours, 0),
        avgHoursPerUser: timeReport.length > 0 ? 
          timeReport.reduce((sum, user) => sum + user.totalHours, 0) / timeReport.length : 0,
        utilizationRate: this.calculateUtilizationRate(timeReport)
      };

    } catch (error) {
      throw new Error(`Error getting team time analytics: ${error.message}`);
    }
  }

  /**
   * Get team task analytics
   */
  async getTeamTaskAnalytics(filters) {
    try {
      // This would require enhancement to Task model for analytics
      // For now, return basic structure
      return {
        completionRate: 0,
        avgTasksPerUser: 0,
        overdueTasks: 0,
        taskVelocity: []
      };

    } catch (error) {
      throw new Error(`Error getting team task analytics: ${error.message}`);
    }
  }

  /**
   * Get team activity analytics
   */
  async getTeamActivityAnalytics(filters) {
    try {
      const activities = await ActivityLog.findAll({
        ...filters,
        limit: 100
      });

      const activityByUser = activities.reduce((acc, activity) => {
        if (!acc[activity.userId]) {
          acc[activity.userId] = {
            userId: activity.userId,
            userName: activity.userName,
            activities: 0
          };
        }
        acc[activity.userId].activities++;
        return acc;
      }, {});

      return {
        totalActivities: activities.length,
        mostActiveUsers: Object.values(activityByUser)
          .sort((a, b) => b.activities - a.activities)
          .slice(0, 5),
        activityTrend: this.calculateActivityTrend(activities)
      };

    } catch (error) {
      throw new Error(`Error getting team activity analytics: ${error.message}`);
    }
  }

  /**
   * Calculate utilization rate
   */
  calculateUtilizationRate(timeReport) {
    if (timeReport.length === 0) return 0;
    
    const standardWorkHours = 8; // 8 hours per day
    const workDaysInPeriod = 22; // Roughly 22 work days per month
    const expectedHours = timeReport.length * standardWorkHours * workDaysInPeriod;
    const actualHours = timeReport.reduce((sum, user) => sum + user.totalHours, 0);
    
    return expectedHours > 0 ? Math.round((actualHours / expectedHours) * 100) : 0;
  }

  /**
   * Calculate activity trend
   */
  calculateActivityTrend(activities) {
    const last7Days = activities.filter(activity => {
      const activityDate = new Date(activity.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return activityDate >= weekAgo;
    });

    return {
      total: activities.length,
      lastWeek: last7Days.length,
      trend: last7Days.length > (activities.length - last7Days.length) ? 'up' : 'down'
    };
  }
}

export default new DashboardService();