import { ActivityLog } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { validationResult } from 'express-validator';

/**
 * @swagger
 * components:
 *   schemas:
 *     Activity:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Activity ID
 *         userId:
 *           type: integer
 *           description: User who performed the action
 *         action:
 *           type: string
 *           description: Action performed
 *           enum: [create, update, delete, assign, unassign, complete, reopen, archive, restore, comment, upload, download, login, logout]
 *         entityType:
 *           type: string
 *           description: Type of entity the action was performed on
 *           enum: [project, task, user, comment, file, time_entry]
 *         entityId:
 *           type: integer
 *           description: ID of the entity the action was performed on
 *         oldValues:
 *           type: object
 *           description: Previous values before the action (for updates)
 *         newValues:
 *           type: object
 *           description: New values after the action (for updates/creates)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         userName:
 *           type: string
 *           description: Name of the user who performed the action
 *         userEmail:
 *           type: string
 *           description: Email of the user who performed the action
 *         userAvatar:
 *           type: string
 *           description: Avatar URL of the user who performed the action
 */

/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: Get all activities with filtering and pagination
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of activities per page
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [project, task, user, comment, file, time_entry]
 *         description: Filter by entity type
 *       - in: query
 *         name: entityId
 *         schema:
 *           type: integer
 *         description: Filter by entity ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: Filter by user who performed the action
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter activities from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter activities to this date
 *     responses:
 *       200:
 *         description: Activities retrieved successfully
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
 *                     activities:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Activity'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Authentication required
 */
export const getActivities = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const filters = {
    entityType: req.query.entityType,
    entityId: req.query.entityId ? parseInt(req.query.entityId) : null,
    userId: req.query.userId ? parseInt(req.query.userId) : null,
    action: req.query.action,
    dateFrom: req.query.dateFrom,
    dateTo: req.query.dateTo,
    limit,
    offset
  };

  try {
    const activities = await ActivityLog.findAll(filters);
    const total = await ActivityLog.count(filters);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };

    return sendSuccess(res, 'Activities retrieved successfully', {
      activities,
      pagination
    });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/activities/{id}:
 *   get:
 *     summary: Get an activity by ID
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Activity ID
 *     responses:
 *       200:
 *         description: Activity retrieved successfully
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
 *                     activity:
 *                       $ref: '#/components/schemas/Activity'
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Activity not found
 */
export const getActivityById = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const activityId = parseInt(req.params.id);

  try {
    const activity = await ActivityLog.findById(activityId);

    if (!activity) {
      return sendError(res, 'Activity not found', 404);
    }

    return sendSuccess(res, 'Activity retrieved successfully', { activity });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/activities/entity/{entityType}/{entityId}:
 *   get:
 *     summary: Get activities for a specific entity
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [project, task, user, comment, file, time_entry]
 *         description: Entity type
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Entity ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of activities per page
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: Entity activities retrieved successfully
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
 *                     activities:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Activity'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Invalid entity type
 */
export const getEntityActivities = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const { entityType, entityId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  // Validate entity type
  const validEntityTypes = Object.values(ActivityLog.ENTITY_TYPES);
  if (!validEntityTypes.includes(entityType)) {
    return sendError(res, `Invalid entity type. Must be one of: ${validEntityTypes.join(', ')}`, 400);
  }

  const options = {
    action: req.query.action,
    limit,
    offset
  };

  try {
    const activities = await ActivityLog.findByEntity(entityType, parseInt(entityId), options);
    
    const countFilters = {
      entityType,
      entityId: parseInt(entityId),
      action: req.query.action
    };
    const total = await ActivityLog.count(countFilters);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };

    return sendSuccess(res, 'Entity activities retrieved successfully', {
      activities,
      pagination
    });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/activities/user/{userId}:
 *   get:
 *     summary: Get activities for a specific user
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of activities per page
 *       - in: query
 *         name: entityType
 *         schema:
 *           type: string
 *           enum: [project, task, user, comment, file, time_entry]
 *         description: Filter by entity type
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: Filter by action type
 *     responses:
 *       200:
 *         description: User activities retrieved successfully
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
 *                     activities:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Activity'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Authentication required
 */
export const getUserActivities = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const userId = parseInt(req.params.userId);
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const offset = (page - 1) * limit;

  const options = {
    entityType: req.query.entityType,
    action: req.query.action,
    limit,
    offset
  };

  try {
    const activities = await ActivityLog.findByUser(userId, options);
    
    const countFilters = {
      userId,
      entityType: req.query.entityType,
      action: req.query.action
    };
    const total = await ActivityLog.count(countFilters);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };

    return sendSuccess(res, 'User activities retrieved successfully', {
      activities,
      pagination
    });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/activities/cleanup:
 *   delete:
 *     summary: Clean up old activity logs (Admin only)
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: daysToKeep
 *         schema:
 *           type: integer
 *           default: 90
 *           minimum: 1
 *         description: Number of days of activity logs to keep
 *     responses:
 *       200:
 *         description: Old activities cleaned up successfully
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
 *                     deletedCount:
 *                       type: integer
 *                       description: Number of activity logs deleted
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Admin access required
 */
export const cleanupOldActivities = asyncHandler(async (req, res) => {
  // Only admins can clean up activity logs
  if (req.user.role !== 'admin') {
    return sendError(res, 'Admin access required', 403);
  }

  const daysToKeep = parseInt(req.query.daysToKeep) || 90;

  if (daysToKeep < 1) {
    return sendError(res, 'Days to keep must be at least 1', 400);
  }

  try {
    const deletedCount = await ActivityLog.deleteOld(daysToKeep);

    return sendSuccess(res, 'Old activities cleaned up successfully', {
      deletedCount
    });

  } catch (error) {
    throw error;
  }
});