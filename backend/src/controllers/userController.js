import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendError, validatePagination } from '../utils/helpers.js';
import userService from '../services/userService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     UserCreate:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *         firstName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         role:
 *           type: string
 *           enum: [admin, manager, developer]
 *           default: developer
 *         avatarUrl:
 *           type: string
 *           format: uri
 *     
 *     UserUpdate:
 *       type: object
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         firstName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         role:
 *           type: string
 *           enum: [admin, manager, developer]
 *         avatarUrl:
 *           type: string
 *           format: uri
 *         isActive:
 *           type: boolean
 *     
 *     UserRoleUpdate:
 *       type: object
 *       required:
 *         - role
 *       properties:
 *         role:
 *           type: string
 *           enum: [admin, manager, developer]
 *     
 *     UsersResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             users:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/User'
 *             pagination:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 itemsPerPage:
 *                   type: integer
 *                 hasNextPage:
 *                   type: boolean
 *                 hasPrevPage:
 *                   type: boolean
 */

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with pagination and filtering
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
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
 *         description: Items per page
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, manager, developer]
 *         description: Filter by role
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in name and email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [id, email, first_name, last_name, role, created_at]
 *           default: created_at
 *         description: Sort by field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  try {
    const { page, limit } = validatePagination(req.query.page, req.query.limit);
    const options = {
      page,
      limit,
      role: req.query.role,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };

    const result = await userService.getAllUsers(options);
    
    return sendSuccess(res, 'Users retrieved successfully', result);
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
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
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 */
export const getUserById = asyncHandler(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await userService.getUserById(userId);
    
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, 'User retrieved successfully', user);
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserCreate'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or user already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const createUser = asyncHandler(async (req, res) => {
  try {
    const user = await userService.createUser(req.body, req.user.id);
    
    return sendSuccess(res, 'User created successfully', user, 201);
  } catch (error) {
    if (error.message.includes('already exists')) {
      return sendError(res, error.message, 409);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const updateUser = asyncHandler(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await userService.updateUser(userId, req.body, req.user.id);
    
    return sendSuccess(res, 'User updated successfully', user);
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    }
    if (error.message.includes('already in use')) {
      return sendError(res, error.message, 409);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete (deactivate) user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const deleteUser = asyncHandler(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    await userService.deleteUser(userId, req.user.id);
    
    return sendSuccess(res, 'User deleted successfully');
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    }
    if (error.message.includes('Only administrators')) {
      return sendError(res, error.message, 403);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/users/{id}/reactivate:
 *   post:
 *     summary: Reactivate user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User reactivated successfully
 *       400:
 *         description: User already active
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const reactivateUser = asyncHandler(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await userService.reactivateUser(userId, req.user.id);
    
    return sendSuccess(res, 'User reactivated successfully', user);
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    }
    if (error.message.includes('already active')) {
      return sendError(res, error.message, 400);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/users/{id}/role:
 *   put:
 *     summary: Update user role
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRoleUpdate'
 *     responses:
 *       200:
 *         description: User role updated successfully
 *       400:
 *         description: Invalid role
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const updateUserRole = asyncHandler(async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role } = req.body;
    
    const user = await userService.updateUserRole(userId, role, req.user.id);
    
    return sendSuccess(res, 'User role updated successfully', user);
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    }
    if (error.message.includes('Invalid role')) {
      return sendError(res, error.message, 400);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/users/stats:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
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
 *                     totalUsers:
 *                       type: integer
 *                     activeUsers:
 *                       type: integer
 *                     inactiveUsers:
 *                       type: integer
 *                     adminCount:
 *                       type: integer
 *                     managerCount:
 *                       type: integer
 *                     developerCount:
 *                       type: integer
 *                     newToday:
 *                       type: integer
 *                     newThisWeek:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient permissions
 */
export const getUserStats = asyncHandler(async (req, res) => {
  try {
    const stats = await userService.getUserStats();
    
    return sendSuccess(res, 'User statistics retrieved successfully', stats);
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});