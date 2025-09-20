import { body, param, query } from 'express-validator';

export const createTaskValidation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Task title is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Task title must be between 2 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('status')
    .optional()
    .isIn(['todo', 'in_progress', 'in_review', 'done'])
    .withMessage('Invalid task status'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid task priority'),

  body('projectId')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),

  body('assignedTo')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assigned user ID must be a positive integer'),

  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),

  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number')
];

export const updateTaskValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Task ID must be a positive integer'),

  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Task title cannot be empty')
    .isLength({ min: 2, max: 200 })
    .withMessage('Task title must be between 2 and 200 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description cannot exceed 2000 characters'),

  body('status')
    .optional()
    .isIn(['todo', 'in_progress', 'in_review', 'done'])
    .withMessage('Invalid task status'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid task priority'),

  body('assignedTo')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assigned user ID must be a positive integer'),

  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid date'),

  body('estimatedHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Estimated hours must be a positive number'),

  body('actualHours')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Actual hours must be a positive number')
];

export const taskIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Task ID must be a positive integer')
];

export const projectIdValidation = [
  param('projectId')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer')
];

export const addCommentValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Task ID must be a positive integer'),

  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
];

export const updateCommentValidation = [
  param('commentId')
    .isInt({ min: 1 })
    .withMessage('Comment ID must be a positive integer'),

  body('content')
    .trim()
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
];

export const deleteCommentValidation = [
  param('commentId')
    .isInt({ min: 1 })
    .withMessage('Comment ID must be a positive integer')
];

export const getTasksQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(['todo', 'in_progress', 'in_review', 'done'])
    .withMessage('Invalid status filter'),

  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority filter'),

  query('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),

  query('assignedTo')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assigned user ID must be a positive integer'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('sortBy')
    .optional()
    .isIn(['id', 'title', 'status', 'priority', 'due_date', 'created_at'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Sort order must be ASC or DESC'),

  query('overdue')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Overdue filter must be true or false')
];