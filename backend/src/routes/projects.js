import express from 'express';
import projectController from '../controllers/projectController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authorizeRoles } from '../middleware/rbac.js';
import {
  createProjectValidation,
  updateProjectValidation,
  projectIdValidation,
  addTeamMemberValidation,
  removeTeamMemberValidation,
  updateMemberRoleValidation,
  getProjectsQueryValidation
} from '../validators/projectValidators.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Project:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: Project ID
 *         name:
 *           type: string
 *           description: Project name
 *           minLength: 2
 *           maxLength: 100
 *         description:
 *           type: string
 *           description: Project description
 *           maxLength: 1000
 *         status:
 *           type: string
 *           enum: [planning, active, on_hold, completed, cancelled]
 *           description: Project status
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Project priority
 *         startDate:
 *           type: string
 *           format: date
 *           description: Project start date
 *         endDate:
 *           type: string
 *           format: date
 *           description: Project end date
 *         createdBy:
 *           type: integer
 *           description: ID of user who created the project
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         teamMembers:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProjectMember'
 *         statistics:
 *           type: object
 *           properties:
 *             totalTasks:
 *               type: integer
 *             completedTasks:
 *               type: integer
 *             inProgressTasks:
 *               type: integer
 *             pendingTasks:
 *               type: integer
 *             overdueTasks:
 *               type: integer
 *     
 *     ProjectMember:
 *       type: object
 *       properties:
 *         userId:
 *           type: integer
 *           description: User ID
 *         firstName:
 *           type: string
 *           description: User first name
 *         lastName:
 *           type: string
 *           description: User last name
 *         email:
 *           type: string
 *           description: User email
 *         role:
 *           type: string
 *           enum: [manager, developer, tester, designer]
 *           description: Role in the project
 *         joinedAt:
 *           type: string
 *           format: date-time
 *           description: When user joined the project
 *     
 *     CreateProject:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         description:
 *           type: string
 *           maxLength: 1000
 *         status:
 *           type: string
 *           enum: [planning, active, on_hold, completed, cancelled]
 *           default: planning
 *         priority:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           default: medium
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         teamMembers:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               role:
 *                 type: string
 *                 enum: [manager, developer, tester, designer]
 *                 default: developer
 */

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects with filtering and pagination
 *     tags: [Projects]
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
 *           enum: [planning, active, on_hold, completed, cancelled]
 *         description: Filter by project status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by project priority
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           maxLength: 100
 *         description: Search in project name and description
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, name, status, priority, start_date, end_date, created_at]
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
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
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
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
  getProjectsQueryValidation, 
  projectController.getAllProjects
);

/**
 * @swagger
 * /api/projects/my:
 *   get:
 *     summary: Get current user's projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User projects retrieved successfully
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
 *                     projects:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Project'
 *                 message:
 *                   type: string
 */
router.get('/my', 
  authenticateToken, 
  projectController.getUserProjects
);

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get project by ID
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *                 message:
 *                   type: string
 *       404:
 *         description: Project not found
 *       403:
 *         description: Access denied to this project
 */
router.get('/:id', 
  authenticateToken, 
  projectIdValidation, 
  projectController.getProjectById
);

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProject'
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error
 *       403:
 *         description: Insufficient permissions
 */
router.post('/', 
  authenticateToken, 
  authorizeRoles(['admin', 'manager']), 
  createProjectValidation, 
  projectController.createProject
);

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     summary: Update project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               status:
 *                 type: string
 *                 enum: [planning, active, on_hold, completed, cancelled]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *                 message:
 *                   type: string
 *       400:
 *         description: Validation error or no valid fields to update
 *       404:
 *         description: Project not found or access denied
 */
router.put('/:id', 
  authenticateToken, 
  updateProjectValidation, 
  projectController.updateProject
);

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     summary: Delete project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     responses:
 *       200:
 *         description: Project deleted successfully
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
 *         description: Only project creator or admin can delete this project
 *       404:
 *         description: Project not found or access denied
 */
router.delete('/:id', 
  authenticateToken, 
  projectIdValidation, 
  projectController.deleteProject
);

/**
 * Compatibility endpoints used by frontend services
 */
router.get('/:id/members', 
  authenticateToken,
  projectIdValidation,
  projectController.getProjectMembers
);

router.get('/:id/tasks',
  authenticateToken,
  projectIdValidation,
  projectController.getProjectTasks
);

/**
 * @swagger
 * /api/projects/{id}/members:
 *   post:
 *     summary: Add team member to project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: integer
 *                 description: ID of user to add to project
 *               role:
 *                 type: string
 *                 enum: [manager, developer, tester, designer]
 *                 default: developer
 *                 description: Role for the user in this project
 *     responses:
 *       200:
 *         description: Team member added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *                 message:
 *                   type: string
 *       400:
 *         description: User not found or validation error
 *       404:
 *         description: Project not found or access denied
 *       409:
 *         description: User is already a member of this project
 */
router.post('/:id/members', 
  authenticateToken, 
  addTeamMemberValidation, 
  projectController.addTeamMember
);

/**
 * @swagger
 * /api/projects/{id}/members/{userId}:
 *   delete:
 *     summary: Remove team member from project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID to remove from project
 *     responses:
 *       200:
 *         description: Team member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *                 message:
 *                   type: string
 *       400:
 *         description: Cannot remove project creator or user is not a member
 *       404:
 *         description: Project not found or access denied
 */
router.delete('/:id/members/:userId', 
  authenticateToken, 
  removeTeamMemberValidation, 
  projectController.removeTeamMember
);

/**
 * @swagger
 * /api/projects/{id}/members/{userId}/role:
 *   put:
 *     summary: Update team member role
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Project ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID whose role to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [manager, developer, tester, designer]
 *                 description: New role for the user
 *     responses:
 *       200:
 *         description: Member role updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Project'
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid role or user is not a member
 *       404:
 *         description: Project not found or access denied
 */
router.put('/:id/members/:userId/role', 
  authenticateToken, 
  updateMemberRoleValidation, 
  projectController.updateMemberRole
);

// Compatibility route: allow updating member role without the `/role` suffix
// Some clients/tests may call PUT /api/projects/:id/members/:userId
router.put('/:id/members/:userId',
  authenticateToken,
  updateMemberRoleValidation,
  projectController.updateMemberRole
);

export default router;