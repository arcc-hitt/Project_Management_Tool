import { formatErrorResponse } from '../utils/helpers.js';

/**
 * Role-based access control middleware
 * @param {Array} allowedRoles - Array of roles that can access the endpoint
 * @returns {Function} Middleware function
 */
export const authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Check if user exists in request (should be set by authenticateToken middleware)
      if (!req.user) {
        return res.status(401).json(
          formatErrorResponse('Authentication required')
        );
      }

      const { role } = req.user;

      // Check if user role is in allowed roles
      if (!allowedRoles.includes(role)) {
        return res.status(403).json(
          formatErrorResponse(
            'Insufficient permissions to access this resource',
            `Required roles: ${allowedRoles.join(', ')}`
          )
        );
      }

      // User has required role, proceed
      next();

    } catch (error) {
      console.error('RBAC middleware error:', error);
      return res.status(500).json(
        formatErrorResponse('Authorization check failed')
      );
    }
  };
};

/**
 * Check if user has admin role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireAdmin = (req, res, next) => {
  return authorizeRoles(['admin'])(req, res, next);
};

/**
 * Check if user has admin or manager role
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireManagerOrAdmin = (req, res, next) => {
  return authorizeRoles(['admin', 'manager'])(req, res, next);
};

/**
 * Check if user can manage other users (admin or manager)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const canManageUsers = (req, res, next) => {
  return authorizeRoles(['admin', 'manager'])(req, res, next);
};

/**
 * Check if user can access user data (admin, manager, or the user themselves)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const canAccessUserData = (req, res, next) => {
  try {
    const { user } = req;
    const targetUserId = parseInt(req.params.id || req.params.userId);

    // Admin and managers can access any user data
    if (user.role === 'admin' || user.role === 'manager') {
      return next();
    }

    // Users can access their own data
    if (user.id === targetUserId) {
      return next();
    }

    // Access denied
    return res.status(403).json(
      formatErrorResponse('Access denied to this user data')
    );

  } catch (error) {
    console.error('User access check error:', error);
    return res.status(500).json(
      formatErrorResponse('Access check failed')
    );
  }
};

/**
 * Check if user owns the resource or has admin/manager role
 * @param {string} userIdField - Field name in request that contains the owner user ID
 * @returns {Function} Middleware function
 */
export const requireOwnershipOrRole = (userIdField = 'createdBy') => {
  return (req, res, next) => {
    try {
      const { user } = req;
      const resourceOwnerId = req.resource ? req.resource[userIdField] : null;

      // Admin and managers can access any resource
      if (user.role === 'admin' || user.role === 'manager') {
        return next();
      }

      // Resource owner can access their own resource
      if (resourceOwnerId && user.id === resourceOwnerId) {
        return next();
      }

      // Access denied
      return res.status(403).json(
        formatErrorResponse('Access denied to this resource')
      );

    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json(
        formatErrorResponse('Ownership check failed')
      );
    }
  };
};

/**
 * Check if user has project access (admin, manager, or project member)
 * This middleware expects project data to be loaded in req.project
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const requireProjectAccess = (req, res, next) => {
  try {
    const { user } = req;

    // Admin can access all projects
    if (user.role === 'admin') {
      return next();
    }

    // For developers, check if they are project members
    if (user.role === 'developer') {
      // This check would typically be done in the service layer
      // For now, we'll pass through and let the service handle it
      return next();
    }

    // Managers can access projects (service layer will handle specific restrictions)
    if (user.role === 'manager') {
      return next();
    }

    // Default deny
    return res.status(403).json(
      formatErrorResponse('Access denied to this project')
    );

  } catch (error) {
    console.error('Project access check error:', error);
    return res.status(500).json(
      formatErrorResponse('Project access check failed')
    );
  }
};