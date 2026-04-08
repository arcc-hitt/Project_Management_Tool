import express from 'express';
import { 
  createComment,
  getCommentsByTask,
  getCommentById,
  updateComment,
  deleteComment
} from '../controllers/commentController.js';
import { 
  authenticateToken,
  authorize
} from '../middleware/auth.js';
import { body, param } from 'express-validator';

const router = express.Router();
const isValidId = (value) => /^[a-fA-F0-9]{24}$/.test(String(value)) || /^\d+$/.test(String(value));

/**
 * @swagger
 * tags:
 *   name: Comments
 *   description: Task comment management
 */

// Validation middleware
const validateCommentCreate = [
  body('taskId')
    .custom(isValidId)
    .withMessage('Task ID must be a valid identifier'),
  body('comment')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters')
];

const validateCommentUpdate = [
  body('comment')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters')
];

const validateCommentId = [
  param('id')
    .custom(isValidId)
    .withMessage('Comment ID must be a valid identifier')
];

const validateTaskId = [
  param('taskId')
    .custom(isValidId)
    .withMessage('Task ID must be a valid identifier')
];

// All comment routes require authentication
router.use(authenticateToken);

// Comment CRUD routes
router.post('/', validateCommentCreate, createComment);
router.get('/task/:taskId', validateTaskId, getCommentsByTask);
router.get('/:id', validateCommentId, getCommentById);
router.put('/:id', validateCommentId, validateCommentUpdate, updateComment);
router.delete('/:id', validateCommentId, deleteComment);

export default router;