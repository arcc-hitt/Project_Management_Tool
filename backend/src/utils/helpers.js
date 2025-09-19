// Utility functions for the application

/**
 * Generate a standardized API response
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - Response message
 * @param {any} data - Response data
 * @param {number} statusCode - HTTP status code
 * @returns {object} Formatted response object
 */
export const createResponse = (success, message, data = null, statusCode = 200) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
  };

  if (data !== null) {
    response.data = data;
  }

  return { response, statusCode };
};

/**
 * Send standardized success response
 * @param {object} res - Express response object
 * @param {string} message - Success message
 * @param {any} data - Response data
 * @param {number} statusCode - HTTP status code
 */
export const sendSuccess = (res, message, data = null, statusCode = 200) => {
  const { response } = createResponse(true, message, data, statusCode);
  return res.status(statusCode).json(response);
};

/**
 * Send standardized error response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {any} errors - Additional error details
 */
export const sendError = (res, message, statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Convert camelCase to snake_case for database queries
 * @param {object} obj - Object with camelCase keys
 * @returns {object} Object with snake_case keys
 */
export const camelToSnake = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
};

/**
 * Convert snake_case to camelCase for API responses
 * @param {object} obj - Object with snake_case keys
 * @returns {object} Object with camelCase keys
 */
export const snakeToCamel = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = snakeToCamel(value);
    }
    return result;
  }
  
  return obj;
};

/**
 * Calculate pagination metadata
 * @param {number} totalItems - Total number of items
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {object} Pagination metadata
 */
export const getPaginationData = (totalItems, page = 1, limit = 10) => {
  const totalPages = Math.ceil(totalItems / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;
  
  return {
    totalItems,
    totalPages,
    currentPage: page,
    itemsPerPage: limit,
    hasNextPage,
    hasPrevPage,
    nextPage: hasNextPage ? page + 1 : null,
    prevPage: hasPrevPage ? page - 1 : null,
  };
};

/**
 * Generate SQL for pagination
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {object} SQL LIMIT and OFFSET values
 */
export const getPaginationSQL = (page = 1, limit = 10) => {
  const offset = (page - 1) * limit;
  return { limit, offset };
};

/**
 * Validate and sanitize pagination parameters
 * @param {any} page - Page parameter from request
 * @param {any} limit - Limit parameter from request
 * @returns {object} Validated page and limit
 */
export const validatePagination = (page, limit) => {
  const validPage = Math.max(1, parseInt(page) || 1);
  const validLimit = Math.min(100, Math.max(1, parseInt(limit) || 10));
  
  return { page: validPage, limit: validLimit };
};

/**
 * Format date for database storage
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string
 */
export const formatDateForDB = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

/**
 * Check if a date is overdue
 * @param {Date|string} dueDate - Due date to check
 * @returns {boolean} True if overdue
 */
export const isOverdue = (dueDate) => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

/**
 * Generate a random string for tokens
 * @param {number} length - Length of the string
 * @returns {string} Random string
 */
export const generateRandomString = (length = 32) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Sleep utility for testing
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the specified time
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));