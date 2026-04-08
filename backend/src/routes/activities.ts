import express from 'express';
import { 
  getActivities,
  getActivityById,
  getEntityActivities,
  getUserActivities,
  cleanupOldActivities
} from '../controllers/activityController.js';
import { 
  authenticateToken,
  authorize
} from '../middleware/auth.js';
import { param, query } from 'express-validator';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Activities
 *   description: Activity log and audit trail management
 */

// Validation middleware
const validateActivityId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Activity ID must be a positive integer')
];

const validateEntityParams = [
  param('entityType')
    .isIn(['project', 'task', 'user', 'comment', 'file', 'time_entry'])
    .withMessage('Invalid entity type'),
  param('entityId')
    .isInt({ min: 1 })
    .withMessage('Entity ID must be a positive integer')
];

const validateUserId = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const validateDateFilters = [
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO 8601 date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO 8601 date')
];

const validateCleanup = [
  query('daysToKeep')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Days to keep must be a positive integer')
];

// All activity routes require authentication
router.use(authenticateToken);

// Activity routes
router.get('/', validatePagination, validateDateFilters, getActivities);
router.get('/:id', validateActivityId, getActivityById);
router.get('/entity/:entityType/:entityId', validateEntityParams, validatePagination, getEntityActivities);
router.get('/user/:userId', validateUserId, validatePagination, getUserActivities);

// Admin-only cleanup route
router.delete('/cleanup', authorize('admin'), validateCleanup, cleanupOldActivities);

export default router;