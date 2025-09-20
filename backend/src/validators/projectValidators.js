import { body, param, query } from 'express-validator';

export const createProjectValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Project name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Project name must be between 2 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('status')
    .optional()
    .isIn(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
    .withMessage('Invalid project status'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid project priority'),

  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .custom((value, { req }) => {
      if (value && req.body.endDate) {
        const startDate = new Date(value);
        const endDate = new Date(req.body.endDate);
        if (startDate >= endDate) {
          throw new Error('Start date must be before end date');
        }
      }
      return true;
    }),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
    .custom((value) => {
      if (value) {
        const endDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (endDate < today) {
          throw new Error('End date cannot be in the past');
        }
      }
      return true;
    }),

  body('teamMembers')
    .optional()
    .isArray()
    .withMessage('Team members must be an array'),

  body('teamMembers.*.userId')
    .if(body('teamMembers').exists())
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),

  body('teamMembers.*.role')
    .if(body('teamMembers').exists())
    .optional()
    .isIn(['manager', 'developer', 'tester', 'designer'])
    .withMessage('Invalid team member role')
];

export const updateProjectValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),

  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Project name cannot be empty')
    .isLength({ min: 2, max: 100 })
    .withMessage('Project name must be between 2 and 100 characters'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),

  body('status')
    .optional()
    .isIn(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
    .withMessage('Invalid project status'),

  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid project priority'),

  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid date')
    .custom((value, { req }) => {
      if (value && req.body.endDate) {
        const startDate = new Date(value);
        const endDate = new Date(req.body.endDate);
        if (startDate >= endDate) {
          throw new Error('Start date must be before end date');
        }
      }
      return true;
    }),

  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid date')
];

export const projectIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer')
];

export const addTeamMemberValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),

  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),

  body('role')
    .optional()
    .isIn(['manager', 'developer', 'tester', 'designer'])
    .withMessage('Invalid role specified')
];

export const removeTeamMemberValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),

  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

export const updateMemberRoleValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),

  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),

  body('role')
    .isIn(['manager', 'developer', 'tester', 'designer'])
    .withMessage('Invalid role specified')
];

export const getProjectsQueryValidation = [
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
    .isIn(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),

  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid priority filter'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters'),

  query('sortBy')
    .optional()
    .isIn(['id', 'name', 'status', 'priority', 'start_date', 'end_date', 'created_at'])
    .withMessage('Invalid sort field'),

  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Sort order must be ASC or DESC')
];