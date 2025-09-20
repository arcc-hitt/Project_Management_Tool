import dashboardService from '../services/dashboardService.js';
import database from '../config/database.js';
import { validationResult } from 'express-validator';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

class DashboardController {
  /**
   * Get dashboard overview with comprehensive statistics
   */
  async getDashboardOverview(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const dashboardData = await dashboardService.getDashboardOverview(user.id, user.role, options);

      res.status(200).json(formatApiResponse(dashboardData, 'Dashboard overview retrieved successfully'));

    } catch (error) {
      console.error('Get dashboard overview error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve dashboard overview', error.message));
    }
  }

  /**
   * Get team performance metrics
   */
  async getTeamPerformance(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const teamPerformance = await dashboardService.getTeamPerformance(user.id, user.role, options);

      res.status(200).json(formatApiResponse({ teamMembers: teamPerformance }, 'Team performance retrieved successfully'));

    } catch (error) {
      console.error('Get team performance error:', error);
      if (error.message.includes('Access denied')) {
        return res.status(403).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to retrieve team performance', error.message));
    }
  }

  /**
   * Get productivity analytics
   */
  async getProductivityAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const analytics = await dashboardService.getProductivityAnalytics(user.id, user.role, options);

      res.status(200).json(formatApiResponse(analytics, 'Productivity analytics retrieved successfully'));

    } catch (error) {
      console.error('Get productivity analytics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve productivity analytics', error.message));
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const { projectId } = req.params;
      const dateRange = req.query.dateRange || '30';

      // Get specific project statistics
      const projectFilter = dashboardService.getProjectFilter(user.id, user.role, parseInt(projectId));
      const dateFilter = dashboardService.getDateFilter(dateRange);

      // Verify user has access to this project
      if (user.role === 'developer') {
        const accessCheck = await database.query(
          'SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?',
          [projectId, user.id]
        );
        if (accessCheck.length === 0) {
          return res.status(403).json(formatErrorResponse('Access denied to this project'));
        }
      }

      const [projectStats, taskStats, taskDistribution] = await Promise.all([
        dashboardService.getProjectStatistics(user.id, user.role, dateFilter, projectFilter),
        dashboardService.getTaskStatistics(user.id, user.role, dateFilter, projectFilter),
        dashboardService.getTaskDistribution(user.id, user.role, projectFilter)
      ]);

      const statistics = {
        project: projectStats,
        tasks: taskStats,
        distribution: taskDistribution
      };

      res.status(200).json(formatApiResponse(statistics, 'Project statistics retrieved successfully'));

    } catch (error) {
      console.error('Get project statistics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve project statistics', error.message));
    }
  }

  /**
   * Get user dashboard (for individual user statistics)
   */
  async getUserDashboard(req, res) {
    try {
      const { user } = req;
      const dateRange = req.query.dateRange || '30';

      const dateFilter = dashboardService.getDateFilter(dateRange);
      const userStats = await dashboardService.getDeveloperStats(user.id, dateFilter);

      // Get user's recent activities
      const recentActivities = await dashboardService.getRecentActivities(user.id, user.role, '', 15);

      // Get user's task distribution
      const projectFilter = dashboardService.getProjectFilter(user.id, user.role, null);
      const taskDistribution = await dashboardService.getTaskDistribution(user.id, user.role, projectFilter);

      const dashboard = {
        statistics: userStats,
        recentActivities,
        taskDistribution,
        dateRange: parseInt(dateRange)
      };

      res.status(200).json(formatApiResponse(dashboard, 'User dashboard retrieved successfully'));

    } catch (error) {
      console.error('Get user dashboard error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve user dashboard', error.message));
    }
  }

  /**
   * Get system-wide analytics (admin only)
   */
  async getSystemAnalytics(req, res) {
    try {
      const { user } = req;

      if (user.role !== 'admin') {
        return res.status(403).json(formatErrorResponse('Admin access required for system analytics'));
      }

      const dateRange = req.query.dateRange || '30';
      const dateFilter = dashboardService.getDateFilter(dateRange);

      // Get comprehensive system statistics
      const queries = [
        // Total users by role
        `SELECT role, COUNT(id) as count FROM users WHERE is_active = TRUE GROUP BY role`,
        
        // Project creation trends
        `SELECT DATE(created_at) as date, COUNT(id) as count 
         FROM projects 
         WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(created_at)
         ORDER BY date DESC
         LIMIT 30`,
        
        // Task completion trends
        `SELECT DATE(updated_at) as date, COUNT(id) as count 
         FROM tasks 
         WHERE status = 'done' AND updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         GROUP BY DATE(updated_at)
         ORDER BY date DESC
         LIMIT 30`,
        
        // Most active users
        `SELECT u.id, u.first_name, u.last_name, u.email, u.role,
                COUNT(t.id) as tasks_completed,
                COUNT(DISTINCT p.id) as projects_involved
         FROM users u
         LEFT JOIN tasks t ON u.id = t.assigned_to AND t.status = 'done' AND t.updated_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
         LEFT JOIN project_members pm ON u.id = pm.user_id
         LEFT JOIN projects p ON pm.project_id = p.id
         WHERE u.is_active = TRUE
         GROUP BY u.id, u.first_name, u.last_name, u.email, u.role
         ORDER BY tasks_completed DESC, projects_involved DESC
         LIMIT 10`
      ];

      const [
        usersByRole,
        projectTrends,
        taskTrends,
        activeUsers
      ] = await Promise.all([
        database.query(queries[0]),
        database.query(queries[1], [parseInt(dateRange)]),
        database.query(queries[2], [parseInt(dateRange)]),
        database.query(queries[3], [parseInt(dateRange)])
      ]);

      const analytics = {
        userDistribution: usersByRole.map(row => ({ role: row.role, count: row.count })),
        trends: {
          projectCreation: projectTrends.map(row => ({ date: row.date, count: row.count })),
          taskCompletion: taskTrends.map(row => ({ date: row.date, count: row.count }))
        },
        topPerformers: activeUsers.map(user => ({
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email,
          role: user.role,
          tasksCompleted: user.tasks_completed,
          projectsInvolved: user.projects_involved
        })),
        dateRange: parseInt(dateRange)
      };

      res.status(200).json(formatApiResponse(analytics, 'System analytics retrieved successfully'));

    } catch (error) {
      console.error('Get system analytics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve system analytics', error.message));
    }
  }

  /**
   * Export dashboard data as CSV or JSON
   */
  async exportDashboardData(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const { format = 'json' } = req.query;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const dashboardData = await dashboardService.getDashboardOverview(user.id, user.role, options);

      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(dashboardData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="dashboard-export.csv"');
        res.send(csv);
      } else {
        // Return JSON with export metadata
        const exportData = {
          ...dashboardData,
          exportMetadata: {
            exportedAt: new Date().toISOString(),
            exportedBy: user.id,
            format: 'json',
            dateRange: options.dateRange
          }
        };

        res.status(200).json(formatApiResponse(exportData, 'Dashboard data exported successfully'));
      }

    } catch (error) {
      console.error('Export dashboard data error:', error);
      res.status(500).json(formatErrorResponse('Failed to export dashboard data', error.message));
    }
  }

  /**
   * Helper method to convert data to CSV format
   */
  convertToCSV(data) {
    const csv = [];
    
    // Add overview data
    csv.push('Dashboard Overview');
    csv.push('Metric,Value');
    csv.push(`Total Projects,${data.overview.projects.total}`);
    csv.push(`Active Projects,${data.overview.projects.active}`);
    csv.push(`Completed Projects,${data.overview.projects.completed}`);
    csv.push(`Total Tasks,${data.overview.tasks.total}`);
    csv.push(`Completion Rate,${data.overview.tasks.completionRate}%`);
    csv.push(`Overdue Tasks,${data.overview.tasks.overdue}`);
    csv.push('');

    // Add task distribution
    csv.push('Task Distribution by Status');
    csv.push('Status,Count');
    data.charts.taskDistribution.byStatus.forEach(item => {
      csv.push(`${item.name},${item.value}`);
    });
    csv.push('');

    // Add recent activities
    csv.push('Recent Activities');
    csv.push('Activity,Entity,User,Project,Date');
    data.recentActivities.forEach(activity => {
      csv.push(`${activity.activityType},${activity.entityName},${activity.userName},${activity.projectName},${activity.activityDate}`);
    });

    return csv.join('\n');
  }

  /**
   * Get time tracking analytics
   */
  async getTimeAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const timeAnalytics = await dashboardService.getTimeStatistics(user.id, user.role, 
        dashboardService.getDateFilter(options.dateRange), options.projectId);

      res.status(200).json(formatApiResponse(timeAnalytics, 'Time analytics retrieved successfully'));

    } catch (error) {
      console.error('Get time analytics error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve time analytics', error.message));
    }
  }

  /**
   * Get detailed project analytics
   */
  async getProjectAnalytics(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const projectId = parseInt(req.params.projectId);
      const options = {
        dateRange: req.query.dateRange || '30'
      };

      const projectAnalytics = await dashboardService.getProjectAnalytics(
        projectId, user.id, user.role, options);

      res.status(200).json(formatApiResponse(projectAnalytics, 'Project analytics retrieved successfully'));

    } catch (error) {
      console.error('Get project analytics error:', error);
      if (error.message.includes('not found') || error.message.includes('Access denied')) {
        return res.status(404).json(formatErrorResponse(error.message));
      }
      res.status(500).json(formatErrorResponse('Failed to retrieve project analytics', error.message));
    }
  }

  /**
   * Get team productivity metrics
   */
  async getTeamProductivity(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const productivity = await dashboardService.getTeamProductivity(user.id, user.role, options);

      res.status(200).json(formatApiResponse(productivity, 'Team productivity retrieved successfully'));

    } catch (error) {
      console.error('Get team productivity error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve team productivity', error.message));
    }
  }

  /**
   * Get time distribution analytics
   */
  async getTimeDistribution(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const timeDistribution = await dashboardService.getTimeDistribution(
        user.id, user.role, 
        dashboardService.getDateFilter(options.dateRange), 
        options.projectId
      );

      res.status(200).json(formatApiResponse(timeDistribution, 'Time distribution retrieved successfully'));

    } catch (error) {
      console.error('Get time distribution error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve time distribution', error.message));
    }
  }

  /**
   * Get comprehensive analytics summary
   */
  async getAnalyticsSummary(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(formatErrorResponse('Validation failed', errors.array()));
      }

      const { user } = req;
      const options = {
        dateRange: req.query.dateRange || '30',
        projectId: req.query.projectId ? parseInt(req.query.projectId) : null
      };

      const [
        dashboardOverview,
        teamProductivity,
        timeAnalytics
      ] = await Promise.all([
        dashboardService.getDashboardOverview(user.id, user.role, options),
        dashboardService.getTeamProductivity(user.id, user.role, options),
        dashboardService.getTimeStatistics(
          user.id, user.role, 
          dashboardService.getDateFilter(options.dateRange), 
          options.projectId
        )
      ]);

      const analyticsSummary = {
        overview: dashboardOverview,
        productivity: teamProductivity,
        timeTracking: timeAnalytics,
        generatedAt: new Date().toISOString(),
        dateRange: parseInt(options.dateRange)
      };

      res.status(200).json(formatApiResponse(analyticsSummary, 'Analytics summary retrieved successfully'));

    } catch (error) {
      console.error('Get analytics summary error:', error);
      res.status(500).json(formatErrorResponse('Failed to retrieve analytics summary', error.message));
    }
  }
}

export default new DashboardController();