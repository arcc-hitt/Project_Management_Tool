import express from 'express';
import searchController from '../controllers/searchController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  unifiedSearchValidation,
  projectSearchValidation,
  taskSearchValidation,
  userSearchValidation,
  commentSearchValidation,
  searchSuggestionsValidation,
  advancedSearchValidation,
  validateDateRange,
  validatePagination
} from '../middleware/searchValidation.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SearchQuery:
 *       type: object
 *       properties:
 *         query:
 *           type: string
 *           description: Search query text
 *           example: "project management"
 *         types:
 *           type: array
 *           items:
 *             type: string
 *             enum: [projects, tasks, users, comments]
 *           description: Types of entities to search
 *           example: ["projects", "tasks"]
 *         page:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *           description: Page number for pagination
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *           description: Number of results per page
 *         sortBy:
 *           type: string
 *           enum: [name, title, createdAt, updatedAt, status, priority, dueDate]
 *           default: createdAt
 *           description: Field to sort by
 *         sortOrder:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *           description: Sort order
 *     
 *     SearchFilters:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           description: Filter by status
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           description: Filter by priority
 *         projectId:
 *           type: integer
 *           description: Filter by project ID
 *         assigneeId:
 *           type: integer
 *           description: Filter by assignee ID
 *         role:
 *           type: string
 *           enum: [admin, manager, developer, designer, tester]
 *           description: Filter by user role
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Filter by start date
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: Filter by end date
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: Filter by due date
 *     
 *     SearchResults:
 *       type: object
 *       properties:
 *         results:
 *           type: object
 *           description: Search results grouped by type
 *         query:
 *           type: string
 *           description: Original search query
 *         types:
 *           type: array
 *           items:
 *             type: string
 *           description: Searched entity types
 *         filters:
 *           $ref: '#/components/schemas/SearchFilters'
 *         pagination:
 *           type: object
 *           properties:
 *             limit:
 *               type: integer
 *             offset:
 *               type: integer
 */

/**
 * @swagger
 * /api/search:
 *   get:
 *     summary: Perform unified search across multiple entity types
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: types
 *         style: form
 *         explode: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [projects, tasks, users, comments]
 *         description: Types of entities to search
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: integer
 *         description: Filter by assignee ID
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, developer, designer, tester]
 *         description: Filter by user role
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: dueDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by due date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, title, createdAt, updatedAt, status, priority, dueDate]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Results per page
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/SearchResults'
 *       400:
 *         description: Invalid search parameters
 *       401:
 *         description: Authentication required
 */
router.get('/', 
  authenticateToken, 
  unifiedSearchValidation, 
  validateDateRange,
  validatePagination,
  searchController.unifiedSearch
);

/**
 * @swagger
 * /api/search/projects:
 *   get:
 *     summary: Search projects specifically
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, completed, on_hold, cancelled]
 *         description: Filter by project status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, createdAt, updatedAt, status]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Project search completed successfully
 *       400:
 *         description: Invalid search parameters
 *       401:
 *         description: Authentication required
 */
router.get('/projects', 
  authenticateToken, 
  projectSearchValidation,
  validateDateRange,
  validatePagination,
  searchController.searchProjects
);

/**
 * @swagger
 * /api/search/tasks:
 *   get:
 *     summary: Search tasks specifically
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, in_progress, review, done]
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by priority
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *       - in: query
 *         name: assigneeId
 *         schema:
 *           type: integer
 *         description: Filter by assignee ID
 *       - in: query
 *         name: dueDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by due date
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, createdAt, updatedAt, status, priority, dueDate]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Task search completed successfully
 *       400:
 *         description: Invalid search parameters
 *       401:
 *         description: Authentication required
 */
router.get('/tasks', 
  authenticateToken, 
  taskSearchValidation,
  validateDateRange,
  validatePagination,
  searchController.searchTasks
);

/**
 * @swagger
 * /api/search/users:
 *   get:
 *     summary: Search users specifically
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, developer, designer, tester]
 *         description: Filter by user role
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [firstName, lastName, createdAt]
 *           default: firstName
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: ASC
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: User search completed successfully
 *       400:
 *         description: Invalid search parameters
 *       401:
 *         description: Authentication required
 */
router.get('/users', 
  authenticateToken, 
  userSearchValidation,
  validatePagination,
  searchController.searchUsers
);

/**
 * @swagger
 * /api/search/comments:
 *   get:
 *     summary: Search comments specifically
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *         description: Search query text
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *         description: Filter by project ID
 *       - in: query
 *         name: taskId
 *         schema:
 *           type: integer
 *         description: Filter by task ID
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Comment search completed successfully
 *       400:
 *         description: Invalid search parameters
 *       401:
 *         description: Authentication required
 */
router.get('/comments', 
  authenticateToken, 
  commentSearchValidation,
  validatePagination,
  searchController.searchComments
);

/**
 * @swagger
 * /api/search/suggestions:
 *   get:
 *     summary: Get search suggestions for autocomplete
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         description: Partial search query for suggestions
 *       - in: query
 *         name: types
 *         style: form
 *         explode: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             enum: [projects, tasks, users]
 *           default: [projects, tasks, users]
 *         description: Types of entities to get suggestions for
 *     responses:
 *       200:
 *         description: Search suggestions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     suggestions:
 *                       type: object
 *                       properties:
 *                         projects:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                         tasks:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               type:
 *                                 type: string
 *                               project:
 *                                 type: string
 *                         users:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: integer
 *                               name:
 *                                 type: string
 *                               type:
 *                                 type: string
 *       400:
 *         description: Invalid query parameters
 *       401:
 *         description: Authentication required
 */
router.get('/suggestions', 
  authenticateToken, 
  searchSuggestionsValidation,
  searchController.getSearchSuggestions
);

/**
 * @swagger
 * /api/search/filter-options:
 *   get:
 *     summary: Get available filter options for advanced search
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filter options retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     projects:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           name:
 *                             type: string
 *                     projectStatuses:
 *                       type: array
 *                       items:
 *                         type: string
 *                     taskStatuses:
 *                       type: array
 *                       items:
 *                         type: string
 *                     taskPriorities:
 *                       type: array
 *                       items:
 *                         type: string
 *                     userRoles:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         description: Authentication required
 */
router.get('/filter-options', 
  authenticateToken, 
  searchController.getFilterOptions
);

/**
 * @swagger
 * /api/search/advanced:
 *   post:
 *     summary: Perform advanced search with multiple criteria
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projects:
 *                 type: object
 *                 properties:
 *                   query:
 *                     type: string
 *                   filters:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                         enum: [active, completed, on_hold, cancelled]
 *                       startDate:
 *                         type: string
 *                         format: date-time
 *                       endDate:
 *                         type: string
 *                         format: date-time
 *                   pagination:
 *                     type: object
 *                     properties:
 *                       limit:
 *                         type: integer
 *                         minimum: 1
 *                         maximum: 100
 *                       offset:
 *                         type: integer
 *                         minimum: 0
 *               tasks:
 *                 type: object
 *                 properties:
 *                   query:
 *                     type: string
 *                   filters:
 *                     type: object
 *                     properties:
 *                       status:
 *                         type: string
 *                         enum: [todo, in_progress, review, done]
 *                       priority:
 *                         type: string
 *                         enum: [low, medium, high, urgent]
 *                       projectId:
 *                         type: integer
 *                   pagination:
 *                     type: object
 *                     properties:
 *                       limit:
 *                         type: integer
 *                       offset:
 *                         type: integer
 *               users:
 *                 type: object
 *                 properties:
 *                   query:
 *                     type: string
 *                   filters:
 *                     type: object
 *                     properties:
 *                       role:
 *                         type: string
 *                         enum: [admin, manager, developer, designer, tester]
 *                   pagination:
 *                     type: object
 *                     properties:
 *                       limit:
 *                         type: integer
 *                       offset:
 *                         type: integer
 *               comments:
 *                 type: object
 *                 properties:
 *                   query:
 *                     type: string
 *                   filters:
 *                     type: object
 *                   pagination:
 *                     type: object
 *                     properties:
 *                       limit:
 *                         type: integer
 *                       offset:
 *                         type: integer
 *           example:
 *             projects:
 *               query: "mobile app"
 *               filters:
 *                 status: "active"
 *               pagination:
 *                 limit: 5
 *                 offset: 0
 *             tasks:
 *               query: "bug fix"
 *               filters:
 *                 status: "in_progress"
 *                 priority: "high"
 *               pagination:
 *                 limit: 10
 *                 offset: 0
 *     responses:
 *       200:
 *         description: Advanced search completed successfully
 *       400:
 *         description: Invalid search criteria
 *       401:
 *         description: Authentication required
 */
router.post('/advanced', 
  authenticateToken, 
  advancedSearchValidation,
  searchController.advancedSearch
);

export default router;