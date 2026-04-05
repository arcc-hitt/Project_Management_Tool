import { validationResult } from 'express-validator';
import dashboardService from '../services/dashboardService.js';
import Project from '../models/Project.js';
import User from '../models/User.js';
import Task from '../models/Task.js';
import database from '../config/database.js';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

class DashboardController {
  async getDashboardOverview(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId || null,
      };

      const dashboardData = await dashboardService.getDashboardOverview(user.id, user.role, options);
      res.status(200).json(formatApiResponse(dashboardData, 'Dashboard overview retrieved successfully'));
    } catch (error) {
      console.error('Get dashboard overview error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve dashboard overview', error.message));
    }
  }

  async getTeamPerformance(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId || null,
      };

      const teamPerformance = await dashboardService.getTeamPerformance(user.id, user.role, options);
      res.status(200).json(formatApiResponse({ teamMembers: teamPerformance }, 'Team performance retrieved successfully'));
    } catch (error) {
      console.error('Get team performance error:', error);
      if (error.message.includes('Access denied')) return res.status(403).json(formatErrorResponse(error.message));
      res.status(500).json(formatErrorResponse('Failed to retrieve team performance', error.message));
    }
  }

  async getProductivityAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId || null,
      };

      const analytics = await dashboardService.getProductivityAnalytics(user.id, user.role, options);
      res.status(200).json(formatApiResponse(analytics, 'Productivity analytics retrieved successfully'));
    } catch (error) {
      console.error('Get productivity analytics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve productivity analytics', error.message));
    }
  }

  async getProjectStatistics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const { projectId } = req.params;
      const dateRange = req.query.dateRange || '30';

      const projectFilter = dashboardService.getProjectFilter(user.id, user.role, projectId);
      const dateFilter = dashboardService.getDateFilter(dateRange);

      if (user.role === 'developer') {
        const access = await Project.isMember(projectId, user.id);
        if (!access) return res.status(403).json(formatErrorResponse('Access denied to this project'));
      }

      const [projectStats, taskStats, taskDistribution] = await Promise.all([
        dashboardService.getProjectStatistics(user.id, user.role, dateFilter, projectFilter),
        dashboardService.getTaskStatistics(user.id, user.role, dateFilter, projectFilter),
        dashboardService.getTaskDistribution(user.id, user.role, projectFilter),
      ]);

      const statistics = { project: projectStats, tasks: taskStats, distribution: taskDistribution };
      res.status(200).json(formatApiResponse(statistics, 'Project statistics retrieved successfully'));
    } catch (error) {
      console.error('Get project statistics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve project statistics', error.message));
    }
  }

  async getUserDashboard(req, res) {
    try {
      const { user } = req;
      const dateRange = req.query.dateRange || '30';

      const dateFilter = dashboardService.getDateFilter(dateRange);
      const userStats = await dashboardService.getDeveloperStats(user.id, dateFilter);
      const recentActivities = await dashboardService.getRecentActivities(user.id, user.role, '', 15);
      const projectFilter = dashboardService.getProjectFilter(user.id, user.role, null);
      const taskDistribution = await dashboardService.getTaskDistribution(user.id, user.role, projectFilter);

      const dashboard = {
        statistics: userStats,
        recentActivities,
        taskDistribution,
        dateRange: parseInt(dateRange, 10),
      };

      res.status(200).json(formatApiResponse(dashboard, 'User dashboard retrieved successfully'));
    } catch (error) {
      console.error('Get user dashboard error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve user dashboard', error.message));
    }
  }

  async getSystemAnalytics(req, res) {
    try {
      const { user } = req;
      if (user.role !== 'admin') {
        return res.status(403).json(formatErrorResponse('Admin access required for system analytics'));
      }

      const dateRange = parseInt(req.query.dateRange || '30', 10);
      const now = new Date();
      const since = new Date(now.getTime() - dateRange * 24 * 60 * 60 * 1000);

      const usersCol = await database.getCollection('users');
      const projectsCol = await database.getCollection('projects');
      const tasksCol = await database.getCollection('tasks');
      const membersCol = await database.getCollection('project_members');

      const [users, projects, tasks, memberships] = await Promise.all([
        usersCol.find({ isActive: true }).toArray(),
        projectsCol.find({ createdAt: { $gte: since } }).toArray(),
        tasksCol.find({ updatedAt: { $gte: since }, status: 'done' }).toArray(),
        membersCol.find({}).toArray(),
      ]);

      const roleCounts = new Map();
      for (const u of users) {
        roleCounts.set(u.role, (roleCounts.get(u.role) || 0) + 1);
      }

      const projectTrendMap = new Map();
      for (const p of projects) {
        const d = new Date(p.createdAt).toISOString().slice(0, 10);
        projectTrendMap.set(d, (projectTrendMap.get(d) || 0) + 1);
      }

      const taskTrendMap = new Map();
      for (const t of tasks) {
        const d = new Date(t.updatedAt || t.createdAt).toISOString().slice(0, 10);
        taskTrendMap.set(d, (taskTrendMap.get(d) || 0) + 1);
      }

      const completedByUser = new Map();
      for (const t of tasks) {
        if (t.assignedTo) completedByUser.set(t.assignedTo, (completedByUser.get(t.assignedTo) || 0) + 1);
      }

      const projectsByUser = new Map();
      for (const m of memberships) {
        if (!projectsByUser.has(m.userId)) projectsByUser.set(m.userId, new Set());
        projectsByUser.get(m.userId).add(m.projectId);
      }

      const topPerformers = users
        .map((u) => ({
          id: u._id.toHexString(),
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim(),
          email: u.email,
          role: u.role,
          tasksCompleted: completedByUser.get(u._id.toHexString()) || 0,
          projectsInvolved: (projectsByUser.get(u._id.toHexString()) || new Set()).size,
        }))
        .sort((a, b) => (b.tasksCompleted - a.tasksCompleted) || (b.projectsInvolved - a.projectsInvolved))
        .slice(0, 10);

      const analytics = {
        userDistribution: [...roleCounts.entries()].map(([role, count]) => ({ role, count })),
        trends: {
          projectCreation: [...projectTrendMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
          taskCompletion: [...taskTrendMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
        },
        topPerformers,
        dateRange,
      };

      res.status(200).json(formatApiResponse(analytics, 'System analytics retrieved successfully'));
    } catch (error) {
      console.error('Get system analytics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve system analytics', error.message));
    }
  }

  async exportDashboardData(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const { format = 'json' } = req.query;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId || null,
      };

      const dashboardData = await dashboardService.getDashboardOverview(user.id, user.role, options);

      if (format === 'csv') {
        const csv = this.convertToCSV(dashboardData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="dashboard-export.csv"');
        res.send(csv);
      } else {
        const exportData = {
          ...dashboardData,
          exportMetadata: {
            exportedAt: new Date().toISOString(),
            exportedBy: user.id,
            format: 'json',
            dateRange: options.dateRange,
          },
        };
        res.status(200).json(formatApiResponse(exportData, 'Dashboard data exported successfully'));
      }
    } catch (error) {
      console.error('Export dashboard data error:', error);
      res.status(500).json(formatErrorResponse('Failed to export dashboard data', error.message));
    }
  }

  convertToCSV(data) {
    const csv = [];
    csv.push('Dashboard Overview');
    csv.push('Metric,Value');
    csv.push(`Total Projects,${data.overview.projects.total}`);
    csv.push(`Active Projects,${data.overview.projects.active}`);
    csv.push(`Completed Projects,${data.overview.projects.completed}`);
    csv.push(`Total Tasks,${data.overview.tasks.total}`);
    csv.push(`Completion Rate,${data.overview.tasks.completionRate}%`);
    csv.push(`Overdue Tasks,${data.overview.tasks.overdue}`);
    csv.push('');

    csv.push('Task Distribution by Status');
    csv.push('Status,Count');
    data.charts.taskDistribution.byStatus.forEach((item) => csv.push(`${item.name},${item.value}`));
    csv.push('');

    csv.push('Recent Activities');
    csv.push('Activity,Entity,User,Project,Date');
    data.recentActivities.forEach((activity) => {
      csv.push(`${activity.activityType},${activity.entityName},${activity.userName},${activity.projectName},${activity.activityDate}`);
    });

    return csv.join('\n');
  }

  async getTimeAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const options = { dateRange: req.query.dateRange || '30', projectId: req.query.projectId || null };

      const timeAnalytics = await dashboardService.getTimeStatistics(
        user.id,
        user.role,
        dashboardService.getDateFilter(options.dateRange),
        options.projectId
      );

      res.status(200).json(formatApiResponse(timeAnalytics, 'Time analytics retrieved successfully'));
    } catch (error) {
      console.error('Get time analytics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve time analytics', error.message));
    }
  }

  async getProjectAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const projectId = req.params.projectId;
      const options = { dateRange: req.query.dateRange || '30' };

      const projectAnalytics = await dashboardService.getProjectAnalytics(projectId, user.id, user.role, options);
      res.status(200).json(formatApiResponse(projectAnalytics, 'Project analytics retrieved successfully'));
    } catch (error) {
      console.error('Get project analytics error:', error);
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to retrieve project analytics', error.message));
    }
  }

  async getTeamProductivity(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const options = { dateRange: req.query.dateRange || '30', projectId: req.query.projectId || null };
      const productivity = await dashboardService.getTeamProductivity(user.id, user.role, options);

      res.status(200).json(formatApiResponse(productivity, 'Team productivity retrieved successfully'));
    } catch (error) {
      console.error('Get team productivity error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve team productivity', error.message));
    }
  }

  async getTimeDistribution(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const options = { dateRange: req.query.dateRange || '30', projectId: req.query.projectId || null };

      const timeDistribution = await dashboardService.getTimeDistribution(
        user.id,
        user.role,
        dashboardService.getDateFilter(options.dateRange),
        options.projectId
      );

      res.status(200).json(formatApiResponse(timeDistribution, 'Time distribution retrieved successfully'));
    } catch (error) {
      console.error('Get time distribution error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve time distribution', error.message));
    }
  }

  async getAnalyticsSummary(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));

      const { user } = req;
      const options = { dateRange: req.query.dateRange || '30', projectId: req.query.projectId || null };

      const [dashboardOverview, teamProductivity, timeAnalytics] = await Promise.all([
        dashboardService.getDashboardOverview(user.id, user.role, options),
        dashboardService.getTeamProductivity(user.id, user.role, options),
        dashboardService.getTimeStatistics(user.id, user.role, dashboardService.getDateFilter(options.dateRange), options.projectId),
      ]);

      const analyticsSummary = {
        overview: dashboardOverview,
        productivity: teamProductivity,
        timeTracking: timeAnalytics,
        generatedAt: new Date().toISOString(),
        dateRange: parseInt(options.dateRange, 10),
      };

      res.status(200).json(formatApiResponse(analyticsSummary, 'Analytics summary retrieved successfully'));
    } catch (error) {
      console.error('Get analytics summary error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve analytics summary', error.message));
    }
  }
}

export default new DashboardController();
