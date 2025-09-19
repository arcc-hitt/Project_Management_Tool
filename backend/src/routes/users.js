import express from 'express';
import { 
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  reactivateUser,
  updateUserRole,
  getUserStats
} from '../controllers/userController.js';
import { 
  authenticate,
  authorize,
  authorizeOwnerOrAdmin
} from '../middleware/auth.js';
import { 
  validateUserRegistration,
  handleValidationErrors
} from '../middleware/validation.js';
import { body } from 'express-validator';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management endpoints
 */

// User update validation
const validateUserUpdate = [
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('role')
    .optional()
    .isIn(['admin', 'manager', 'developer'])
    .withMessage('Role must be admin, manager, or developer'),
  body('avatarUrl')
    .optional()
    .isURL()
    .withMessage('Avatar URL must be a valid URL'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  handleValidationErrors
];

// Role update validation
const validateRoleUpdate = [
  body('role')
    .isIn(['admin', 'manager', 'developer'])
    .withMessage('Role must be admin, manager, or developer'),
  handleValidationErrors
];

// All routes require authentication
router.use(authenticate);

// Get user statistics (admin/manager only)
router.get('/stats', authorize('admin', 'manager'), getUserStats);

// Get all users (admin/manager only)
router.get('/', authorize('admin', 'manager'), getAllUsers);

// Create user (admin/manager only)
router.post('/', authorize('admin', 'manager'), validateUserRegistration, createUser);

// Get specific user (owner, admin, or manager)
router.get('/:id', authorizeOwnerOrAdmin, getUserById);

// Update user (owner, admin, or manager)
router.put('/:id', authorizeOwnerOrAdmin, validateUserUpdate, updateUser);

// Delete user (admin only, or users can delete themselves)
router.delete('/:id', (req, res, next) => {
  const userId = parseInt(req.params.id);
  const isOwner = req.user.id === userId;
  const isAdmin = req.user.role === 'admin';
  
  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Only administrators can delete other users'
    });
  }
  
  next();
}, deleteUser);

// Reactivate user (admin only)
router.post('/:id/reactivate', authorize('admin'), reactivateUser);

// Update user role (admin only)
router.put('/:id/role', authorize('admin'), validateRoleUpdate, updateUserRole);

export default router;