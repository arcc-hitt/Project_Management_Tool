import { body, query, param } from 'express-validator';

// Common validation rules
const searchQueryValidation = [
  query('query')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Query must be between 1 and 500 characters'),
    
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
    
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
    
  query('sortBy')
    .optional()
    .isIn(['name', 'title', 'createdAt', 'updatedAt', 'status', 'priority', 'dueDate'])
    .withMessage('Invalid sort field'),
    
  query('sortOrder')
    .optional()
    .isIn(['ASC', 'DESC', 'asc', 'desc'])
    .withMessage('Sort order must be ASC or DESC')
];

// Unified search validation
export const unifiedSearchValidation = [
  ...searchQueryValidation,
  
  query('types')
    .optional()
    .custom((value) => {
      const validTypes = ['projects', 'tasks', 'users', 'comments'];
      const types = Array.isArray(value) ? value : [value];
      
      for (const type of types) {
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid search type: ${type}`);
        }
      }
      return true;
    })
    .withMessage('Invalid search types'),
    
  query('status')
    .optional()
    .isString()
    .trim()
    .withMessage('Status must be a string'),
    
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority value'),
    
  query('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
    
  query('assigneeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assignee ID must be a positive integer'),
    
  query('role')
    .optional()
    .isIn(['admin', 'manager', 'developer', 'designer', 'tester'])
    .withMessage('Invalid role value'),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
    
  query('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date')
];

// Project search validation
export const projectSearchValidation = [
  ...searchQueryValidation,
  
  query('status')
    .optional()
    .isIn(['active', 'completed', 'on_hold', 'cancelled'])
    .withMessage('Invalid project status'),
    
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
    
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

// Task search validation
export const taskSearchValidation = [
  ...searchQueryValidation,
  
  query('status')
    .optional()
    .isIn(['todo', 'in_progress', 'review', 'done'])
    .withMessage('Invalid task status'),
    
  query('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid priority value'),
    
  query('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
    
  query('assigneeId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Assignee ID must be a positive integer'),
    
  query('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be a valid ISO 8601 date')
];

// User search validation
export const userSearchValidation = [
  ...searchQueryValidation,
  
  query('role')
    .optional()
    .isIn(['admin', 'manager', 'developer', 'designer', 'tester'])
    .withMessage('Invalid role value')
];

// Comment search validation
export const commentSearchValidation = [
  ...searchQueryValidation,
  
  query('projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Project ID must be a positive integer'),
    
  query('taskId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Task ID must be a positive integer')
];

// Search suggestions validation
export const searchSuggestionsValidation = [
  query('query')
    .notEmpty()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Query must be between 2 and 100 characters'),
    
  query('types')
    .optional()
    .custom((value) => {
      const validTypes = ['projects', 'tasks', 'users'];
      const types = Array.isArray(value) ? value : [value];
      
      for (const type of types) {
        if (!validTypes.includes(type)) {
          throw new Error(`Invalid suggestion type: ${type}`);
        }
      }
      return true;
    })
    .withMessage('Invalid suggestion types')
];

// Advanced search validation
export const advancedSearchValidation = [
  body('projects')
    .optional()
    .isObject()
    .withMessage('Projects criteria must be an object'),
    
  body('projects.query')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Project query must be a string with max 500 characters'),
    
  body('projects.filters')
    .optional()
    .isObject()
    .withMessage('Project filters must be an object'),
    
  body('projects.filters.status')
    .optional()
    .isIn(['active', 'completed', 'on_hold', 'cancelled'])
    .withMessage('Invalid project status'),
    
  body('projects.pagination')
    .optional()
    .isObject()
    .withMessage('Project pagination must be an object'),
    
  body('projects.pagination.limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Project pagination limit must be between 1 and 100'),
    
  body('projects.pagination.offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Project pagination offset must be non-negative'),
    
  body('tasks')
    .optional()
    .isObject()
    .withMessage('Tasks criteria must be an object'),
    
  body('tasks.query')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Task query must be a string with max 500 characters'),
    
  body('tasks.filters')
    .optional()
    .isObject()
    .withMessage('Task filters must be an object'),
    
  body('tasks.filters.status')
    .optional()
    .isIn(['todo', 'in_progress', 'review', 'done'])
    .withMessage('Invalid task status'),
    
  body('tasks.filters.priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent'])
    .withMessage('Invalid task priority'),
    
  body('tasks.filters.projectId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Task project ID must be a positive integer'),
    
  body('tasks.pagination')
    .optional()
    .isObject()
    .withMessage('Task pagination must be an object'),
    
  body('users')
    .optional()
    .isObject()
    .withMessage('Users criteria must be an object'),
    
  body('users.query')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('User query must be a string with max 500 characters'),
    
  body('users.filters')
    .optional()
    .isObject()
    .withMessage('User filters must be an object'),
    
  body('users.filters.role')
    .optional()
    .isIn(['admin', 'manager', 'developer', 'designer', 'tester'])
    .withMessage('Invalid user role'),
    
  body('users.pagination')
    .optional()
    .isObject()
    .withMessage('User pagination must be an object'),
    
  body('comments')
    .optional()
    .isObject()
    .withMessage('Comments criteria must be an object'),
    
  body('comments.query')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Comment query must be a string with max 500 characters'),
    
  body('comments.filters')
    .optional()
    .isObject()
    .withMessage('Comment filters must be an object'),
    
  body('comments.pagination')
    .optional()
    .isObject()
    .withMessage('Comment pagination must be an object')
];

// Custom validation for date ranges
export const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.query;
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'Start date cannot be later than end date',
        errors: [{
          field: 'dateRange',
          message: 'Invalid date range'
        }]
      });
    }
    
    // Check if date range is not too large (e.g., more than 2 years)
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 730) { // 2 years
      return res.status(400).json({
        success: false,
        message: 'Date range cannot exceed 2 years',
        errors: [{
          field: 'dateRange',
          message: 'Date range too large'
        }]
      });
    }
  }
  
  next();
};

// Custom validation for pagination
export const validatePagination = (req, res, next) => {
  const { page, limit } = req.query;
  
  if (page && limit) {
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const maxOffset = pageNum * limitNum;
    
    // Prevent very large offsets that could impact performance
    if (maxOffset > 10000) {
      return res.status(400).json({
        success: false,
        message: 'Pagination offset too large',
        errors: [{
          field: 'pagination',
          message: 'Cannot paginate beyond 10,000 records'
        }]
      });
    }
  }
  
  next();
};