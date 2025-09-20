import { Comment, ActivityLog } from '../models/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { validationResult } from 'express-validator';

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       required:
 *         - taskId
 *         - comment
 *       properties:
 *         id:
 *           type: integer
 *           description: Comment ID
 *         taskId:
 *           type: integer
 *           description: Task ID this comment belongs to
 *         userId:
 *           type: integer
 *           description: User who created the comment
 *         comment:
 *           type: string
 *           description: Comment text
 *           maxLength: 2000
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         userName:
 *           type: string
 *           description: Name of the user who created the comment
 *         userEmail:
 *           type: string
 *           description: Email of the user who created the comment
 *         userAvatar:
 *           type: string
 *           description: Avatar URL of the user who created the comment
 *     
 *     CommentCreate:
 *       type: object
 *       required:
 *         - taskId
 *         - comment
 *       properties:
 *         taskId:
 *           type: integer
 *           description: Task ID
 *         comment:
 *           type: string
 *           description: Comment text
 *           maxLength: 2000
 *           minLength: 1
 *     
 *     CommentUpdate:
 *       type: object
 *       required:
 *         - comment
 *       properties:
 *         comment:
 *           type: string
 *           description: Updated comment text
 *           maxLength: 2000
 *           minLength: 1
 */

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentCreate'
 *     responses:
 *       201:
 *         description: Comment created successfully
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
 *                     comment:
 *                       $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Task not found
 */
export const createComment = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const { taskId, comment } = req.body;
  const userId = req.user.id;

  try {
    // Create the comment
    const newComment = await Comment.create({
      taskId,
      userId,
      comment
    });

    // Log the activity
    await ActivityLog.logCommentActivity(
      userId,
      ActivityLog.ACTIONS.CREATE,
      newComment.id,
      null,
      { comment: comment.substring(0, 100) + (comment.length > 100 ? '...' : '') }
    );

    return sendSuccess(res, 'Comment created successfully', { comment: newComment }, 201);

  } catch (error) {
    if (error.message.includes('Task not found')) {
      return sendError(res, 'Task not found', 404);
    }
    throw error;
  }
});

/**
 * @swagger
 * /api/comments/task/{taskId}:
 *   get:
 *     summary: Get all comments for a task
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: taskId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Task ID
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
 *         description: Number of comments per page
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
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
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Comment'
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
 *       404:
 *         description: Task not found
 */
export const getCommentsByTask = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const taskId = parseInt(req.params.taskId);
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  try {
    const comments = await Comment.findByTaskId(taskId, { page, limit });
    const total = await Comment.countByTaskId(taskId);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };

    return sendSuccess(res, 'Comments retrieved successfully', {
      comments,
      pagination
    });

  } catch (error) {
    if (error.message.includes('Task not found')) {
      return sendError(res, 'Task not found', 404);
    }
    throw error;
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     summary: Get a comment by ID
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
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
 *                     comment:
 *                       $ref: '#/components/schemas/Comment'
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Comment not found
 */
export const getCommentById = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const commentId = parseInt(req.params.id);

  try {
    const comment = await Comment.findById(commentId);

    if (!comment) {
      return sendError(res, 'Comment not found', 404);
    }

    return sendSuccess(res, 'Comment retrieved successfully', { comment });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentUpdate'
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
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     comment:
 *                       $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to update this comment
 *       404:
 *         description: Comment not found
 */
export const updateComment = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const commentId = parseInt(req.params.id);
  const { comment } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Get existing comment
    const existingComment = await Comment.findById(commentId);

    if (!existingComment) {
      return sendError(res, 'Comment not found', 404);
    }

    // Check permissions (only comment author or admin can update)
    if (existingComment.userId !== userId && userRole !== 'admin') {
      return sendError(res, 'Not authorized to update this comment', 403);
    }

    const oldValues = { comment: existingComment.comment };

    // Update the comment
    const updatedComment = await Comment.update(commentId, { comment });

    // Log the activity
    await ActivityLog.logCommentActivity(
      userId,
      ActivityLog.ACTIONS.UPDATE,
      commentId,
      oldValues,
      { comment: comment.substring(0, 100) + (comment.length > 100 ? '...' : '') }
    );

    return sendSuccess(res, 'Comment updated successfully', { comment: updatedComment });

  } catch (error) {
    throw error;
  }
});

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *                 message:
 *                   type: string
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Not authorized to delete this comment
 *       404:
 *         description: Comment not found
 */
export const deleteComment = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }

  const commentId = parseInt(req.params.id);
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Get existing comment
    const existingComment = await Comment.findById(commentId);

    if (!existingComment) {
      return sendError(res, 'Comment not found', 404);
    }

    // Check permissions (only comment author or admin can delete)
    if (existingComment.userId !== userId && userRole !== 'admin') {
      return sendError(res, 'Not authorized to delete this comment', 403);
    }

    const oldValues = { comment: existingComment.comment };

    // Delete the comment
    await Comment.delete(commentId);

    // Log the activity
    await ActivityLog.logCommentActivity(
      userId,
      ActivityLog.ACTIONS.DELETE,
      commentId,
      oldValues,
      null
    );

    return sendSuccess(res, 'Comment deleted successfully');

  } catch (error) {
    throw error;
  }
});