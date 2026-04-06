import express from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/rbac.js';
import {
  dashboardQueryValidation,
  projectStatsValidation,
  exportValidation,
  teamPerformanceValidation,
  systemAnalyticsValidation
} from '../validators/dashboardValidators.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardOverview:
 *       type: object
 *       properties:
 *         overview:
 *           type: object
 *           properties:
 *             projects:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 active:
 *                   type: integer
 *                 completed:
 *                   type: integer
 *                 overdue:
 *                   type: integer
 *                 onTrack:
 *                   type: integer
 *             tasks:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 byStatus:
 *                   type: object
 *                   properties:
 *                     todo:
 *                       type: integer
 *                     inProgress:
 *                       type: integer
 *                     inReview:
 *                       type: integer
 *                     done:
 *                       type: integer
 *                 overdue:
 *                   type: integer
 *                 highPriority:
 *                   type: integer
 *                 completionRate:
 *                   type: integer
 *                 averageCompletionTime:
 *                   type: number
 *             users:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 active:
 *                   type: integer
 *                 roleDistribution:
 *                   type: object
 *         charts:
 *           type: object
 *           properties:
 *             taskDistribution:
 *               type: object
 *               properties:
 *                 byStatus:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       value:
 *                         type: integer
 *                 byPriority:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       value:
 *                         type: integer
 *                 byProject:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       value:
 *                         type: integer
 *             projectProgress:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   name:
 *                     type: string
 *                   status:
 *                     type: string
 *                   progress:
 *                     type: integer
 *                   totalTasks:
 *                     type: integer
 *                   completedTasks:
 *                     type: integer
 *                   overdueTasks:
 *                     type: integer
 *                   isOverdue:
 *                     type: boolean
 *         recentActivities:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               activityType:
 *                 type: string
 *               entityName:
 *                 type: string
 *               userName:
 *                 type: string
 *               projectName:
 *                 type: string
 *               activityDate:
 *                 type: string
 *                 format: date-time
 *         dateRange:
 *           type: integer
 *     
 *     TeamPerformance:
 *       type: object
 *       properties:
 *         teamMembers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *               assignedTasks:
 *                 type: integer
 *               completedTasks:
 *                 type: integer
 *               overdueTasks:
 *                 type: integer
 *               completionRate:
 *                 type: integer
 *               averageCompletionTime:
 *                 type: number
 *               activeProjects:
 *                 type: integer
 *     
 *     ProductivityAnalytics:
 *       type: object
 *       properties:
 *         completionTrends:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               completed:
 *                 type: integer
 *               total:
 *                 type: integer
 *               completionRate:
 *                 type: integer
 *         timeAllocation:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               priority:
 *                 type: string
 *               totalHours:
 *                 type: number
 *               taskCount:
 *                 type: integer
 *               averageHours:
 *                 type: number
 */

/**
 * @swagger
 * /api/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard overview
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7, 14, 30, 60, 90]
 *           default: 30
 *         description: Number of days to include in the analysis
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter data by specific project ID
 *     responses:
 *       200:
 *         description: Dashboard overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardOverview'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       401:
 *         description: Authentication required
 */
router.get('/', 
  authenticateToken, 
  dashboardQueryValidation, 
  dashboardController.getDashboardOverview
);

/**
 * @swagger
 * /api/dashboard/team:
 *   get:
 *     summary: Get team performance metrics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7, 14, 30, 60, 90]
 *           default: 30
 *         description: Number of days to include in the analysis
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter data by specific project ID
 *     responses:
 *       200:
 *         description: Team performance retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TeamPerformance'
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied - insufficient permissions
 */
router.get('/team', 
  authenticateToken, 
  teamPerformanceValidation, 
  dashboardController.getTeamPerformance
);

/**
 * @swagger
 * /api/dashboard/analytics:
 *   get:
 *     summary: Get productivity analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7, 14, 30, 60, 90]
 *           default: 30
 *         description: Number of days to include in the analysis
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter data by specific project ID
 *     responses:
 *       200:
 *         description: Productivity analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/ProductivityAnalytics'
 *                 message:
 *                   type: string
 */
router.get('/analytics', 
  authenticateToken, 
  dashboardQueryValidation, 
  dashboardController.getProductivityAnalytics
);

/**
 * @swagger
 * /api/dashboard/user:
 *   get:
 *     summary: Get current user's personal dashboard
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7, 14, 30, 60, 90]
 *           default: 30
 *         description: Number of days to include in the analysis
 *     responses:
 *       200:
 *         description: User dashboard retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     statistics:
 *                       type: object
 *                       properties:
 *                         assignedTasks:
 *                           type: integer
 *                         completedTasks:
 *                           type: integer
 *                         activeProjects:
 *                           type: integer
 *                         completionRate:
 *                           type: integer
 *                         averageTaskTime:
 *                           type: number
 *                     recentActivities:
 *                       type: array
 *                     taskDistribution:
 *                       type: object
 *                     dateRange:
 *                       type: integer
 *                 message:
 *                   type: string
 */
router.get('/user', 
  authenticateToken, 
  dashboardController.getUserDashboard
);

/**
 * @swagger
 * /api/dashboard/project/{projectId}:
 *   get:
 *     summary: Get specific project statistics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7, 14, 30, 60, 90]
 *           default: 30
 *         description: Number of days to include in the analysis
 *     responses:
 *       200:
 *         description: Project statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     project:
 *                       type: object
 *                     tasks:
 *                       type: object
 *                     distribution:
 *                       type: object
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied to this project
 */
router.get('/project/:projectId', 
  authenticateToken, 
  projectStatsValidation, 
  dashboardController.getProjectStatistics
);

/**
 * @swagger
 * /api/dashboard/system:
 *   get:
 *     summary: Get system-wide analytics (Admin only)
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7, 14, 30, 60, 90]
 *           default: 30
 *         description: Number of days to include in the analysis
 *     responses:
 *       200:
 *         description: System analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     userDistribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           role:
 *                             type: string
 *                           count:
 *                             type: integer
 *                     trends:
 *                       type: object
 *                       properties:
 *                         projectCreation:
 *                           type: array
 *                         taskCompletion:
 *                           type: array
 *                     topPerformers:
 *                       type: array
 *                     dateRange:
 *                       type: integer
 *                 message:
 *                   type: string
 *       403:
 *         description: Admin access required
 */
router.get('/system', 
  authenticateToken, 
  authorizeRoles(['admin']), 
  systemAnalyticsValidation, 
  dashboardController.getSystemAnalytics
);

/**
 * @swagger
 * /api/dashboard/export:
 *   get:
 *     summary: Export dashboard data
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           enum: [7, 14, 30, 60, 90]
 *           default: 30
 *         description: Number of days to include in the analysis
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter data by specific project ID
 *     responses:
 *       200:
 *         description: Dashboard data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *           text/csv:
 *             schema:
 *               type: string
 *       400:
 *         description: Validation error
 */
router.get('/export', 
  authenticateToken, 
  exportValidation, 
  dashboardController.exportDashboardData
);

/**
 * @swagger
 * /api/dashboard/time-analytics:
 *   get:
 *     summary: Get time tracking analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           default: "30"
 *         description: Date range in days
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by specific project
 *     responses:
 *       200:
 *         description: Time analytics retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/time-analytics', 
  authenticateToken, 
  dashboardQueryValidation, 
  dashboardController.getTimeAnalytics
);

/**
 * @swagger
 * /api/dashboard/project-analytics/{projectId}:
 *   get:
 *     summary: Get detailed project analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           default: "30"
 *         description: Date range in days
 *     responses:
 *       200:
 *         description: Project analytics retrieved successfully
 *       404:
 *         description: Project not found or access denied
 *       401:
 *         description: Authentication required
 */
router.get('/project-analytics/:projectId', 
  authenticateToken, 
  dashboardQueryValidation, 
  dashboardController.getProjectAnalytics
);

/**
 * @swagger
 * /api/dashboard/team-productivity:
 *   get:
 *     summary: Get team productivity metrics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           default: "30"
 *         description: Date range in days
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by specific project
 *     responses:
 *       200:
 *         description: Team productivity retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/team-productivity', 
  authenticateToken, 
  dashboardQueryValidation, 
  dashboardController.getTeamProductivity
);

/**
 * @swagger
 * /api/dashboard/time-distribution:
 *   get:
 *     summary: Get time distribution analytics
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           default: "30"
 *         description: Date range in days
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by specific project
 *     responses:
 *       200:
 *         description: Time distribution retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/time-distribution', 
  authenticateToken, 
  dashboardQueryValidation, 
  dashboardController.getTimeDistribution
);

/**
 * @swagger
 * /api/dashboard/analytics-summary:
 *   get:
 *     summary: Get comprehensive analytics summary
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: dateRange
 *         schema:
 *           type: string
 *           default: "30"
 *         description: Date range in days
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by specific project
 *     responses:
 *       200:
 *         description: Analytics summary retrieved successfully
 *       401:
 *         description: Authentication required
 */
router.get('/analytics-summary', 
  authenticateToken, 
  dashboardQueryValidation, 
  dashboardController.getAnalyticsSummary
);

export default router;
