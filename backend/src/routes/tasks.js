import express from 'express';
import taskController from '../controllers/taskController.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  createTaskValidation,
  updateTaskValidation,
  taskIdValidation,
  projectIdValidation,
  addCommentValidation,
  updateCommentValidation,
  deleteCommentValidation,
  getTasksQueryValidation
} from '../validators/taskValidators.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       required:
 *         - title
 *         - projectId
 *       properties:
 *         id:
 *           type: integer
 *           description: Task ID
 *         title:
 *           type: string
 *           description: Task title
 *           minLength: 2
 *           maxLength: 200
 *         description:
 *           type: string
 *           description: Task description
 *           maxLength: 2000
 *         status:
 *           type: string
 *           enum: [todo, in_progress, in_review, done]
 *           description: Task status
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Task priority
 *         projectId:
 *           type: integer
 *           description: ID of the project this task belongs to
 *         assignedTo:
 *           type: integer
 *           description: ID of user assigned to this task
 *         dueDate:
 *           type: string
 *           format: date-time
 *           description: Task due date
 *         estimatedHours:
 *           type: number
 *           minimum: 0
 *           description: Estimated hours to complete
 *         actualHours:
 *           type: number
 *           minimum: 0
 *           description: Actual hours spent
 *         createdBy:
 *           type: integer
 *           description: ID of user who created the task
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         isOverdue:
 *           type: boolean
 *           description: Whether the task is overdue
 *         projectName:
 *           type: string
 *           description: Name of the project
 *         assigneeFirstName:
 *           type: string
 *           description: First name of assigned user
 *         assigneeLastName:
 *           type: string
 *           description: Last name of assigned user
 *         commentCount:
 *           type: integer
 *           description: Number of comments on the task
 *         comments:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/TaskComment'
 *     
 *     TaskComment:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Comment ID
 *         content:
 *           type: string
 *           description: Comment content
 *           maxLength: 1000
 *         firstName:
 *           type: string
 *           description: First name of comment author
 *         lastName:
 *           type: string
 *           description: Last name of comment author
 *         email:
 *           type: string
 *           description: Email of comment author
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     
 *     CreateTask:
 *       type: object
 *       required:
 *         - title
 *         - projectId
 *       properties:
 *         title:
 *           type: string
 *           minLength: 2
 *           maxLength: 200
 *         description:
 *           type: string
 *           maxLength: 2000
 *         status:
 *           type: string
 *           enum: [todo, in_progress, in_review, done]
 *           default: todo
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           default: medium
 *         projectId:
 *           type: integer
 *           minimum: 1
 *         assignedTo:
 *           type: integer
 *           minimum: 1
 *         dueDate:
 *           type: string
 *           format: date-time
 *         estimatedHours:
 *           type: number
 *           minimum: 0
 */

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Get all tasks with filtering and pagination
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, in_progress, in_review, done]
 *         description: Filter by task status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by task priority
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by project ID
 *       - in: query
 *         name: assignedTo
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Filter by assigned user ID
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search in task title and description
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, title, status, priority, due_date, created_at]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *       - in: query
 *         name: overdue
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter overdue tasks
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
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
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         totalItems:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         currentPage:
 *                           type: integer
 *                         itemsPerPage:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *                 message:
 *                   type: string
 */
router.get('/', 
  authenticateToken, 
  getTasksQueryValidation, 
  taskController.getAllTasks
);

/**
 * @swagger
 * /api/tasks/my:
 *   get:
 *     summary: Get current user's assigned tasks
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User tasks retrieved successfully
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
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 */
router.get('/my', 
  authenticateToken, 
  taskController.getUserTasks
);

/**
 * @swagger
 * /api/tasks/project/{projectId}:
 *   get:
 *     summary: Get tasks by project
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project tasks retrieved successfully
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
 *                     tasks:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 *       403:
 *         description: Access denied to this project
 */
router.get('/project/:projectId', 
  authenticateToken, 
  projectIdValidation, 
  taskController.getTasksByProject
);

// Compatibility route expected by some clients: GET /api/tasks/:id/comments
router.get('/:id/comments',
  authenticateToken,
  taskIdValidation,
  taskController.getTaskComments
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   get:
 *     summary: Get task by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 *       404:
 *         description: Task not found
 *       403:
 *         description: Access denied to this task
 */
router.get('/:id', 
  authenticateToken, 
  taskIdValidation, 
  taskController.getTaskById
);

/**
 * @swagger
 * /api/tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTask'
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or assignee not a project member
 *       403:
 *         description: Access denied to project
 */
router.post('/', 
  authenticateToken, 
  createTaskValidation, 
  taskController.createTask
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   put:
 *     summary: Update task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 2000
 *               status:
 *                 type: string
 *                 enum: [todo, in_progress, in_review, done]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               assignedTo:
 *                 type: integer
 *                 minimum: 1
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *               estimatedHours:
 *                 type: number
 *                 minimum: 0
 *               actualHours:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or no valid fields to update
 *       404:
 *         description: Task not found or access denied
 */
router.put('/:id', 
  authenticateToken, 
  updateTaskValidation, 
  taskController.updateTask
);

// Compatibility: assign a task to a user via /api/tasks/:id/assign with { assigneeId }
router.put('/:id/assign',
  authenticateToken,
  async (req, res, next) => {
    // Map assigneeId -> assignedTo then call the regular update flow
    if (req.body && req.body.assigneeId && !req.body.assignedTo) {
      req.body.assignedTo = req.body.assigneeId;
      delete req.body.assigneeId;
    }
    return taskController.updateTask(req, res, next);
  }
);

// Compatibility: update task status via /api/tasks/:id/status with { status }
router.put('/:id/status',
  authenticateToken,
  // normalize status for compatibility before validation inside controller
  async (req, res, next) => {
    // Normalize 'review' -> 'in_review' to match backend enum
    if (req.body && req.body.status === 'review') {
      req.body.status = 'in_review';
    }
    return taskController.updateTask(req, res, next);
  }
);

/**
 * @swagger
 * /api/tasks/{id}:
 *   delete:
 *     summary: Delete task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: null
 *                 message:
 *                   type: string
 *       403:
 *         description: Only task creator or admin can delete this task
 *       404:
 *         description: Task not found or access denied
 */
router.delete('/:id', 
  authenticateToken, 
  taskIdValidation, 
  taskController.deleteTask
);

/**
 * @swagger
 * /api/tasks/{id}/comments:
 *   post:
 *     summary: Add comment to task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Comment content
 *     responses:
 *       201:
 *         description: Comment added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       404:
 *         description: Task not found or access denied
 */
router.post('/:id/comments', 
  authenticateToken, 
  addCommentValidation, 
  taskController.addComment
);

/**
 * @swagger
 * /api/tasks/comments/{commentId}:
 *   put:
 *     summary: Update comment
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Updated comment content
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TaskComment'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       403:
 *         description: Only comment owner or admin can update this comment
 *       404:
 *         description: Comment not found
 */
router.put('/comments/:commentId', 
  authenticateToken, 
  updateCommentValidation, 
  taskController.updateComment
);

/**
 * @swagger
 * /api/tasks/comments/{commentId}:
 *   delete:
 *     summary: Delete comment
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: null
 *                 message:
 *                   type: string
 *       403:
 *         description: Only comment owner or admin can delete this comment
 *       404:
 *         description: Comment not found
 */
router.delete('/comments/:commentId', 
  authenticateToken, 
  deleteCommentValidation, 
  taskController.deleteComment
);

export default router;