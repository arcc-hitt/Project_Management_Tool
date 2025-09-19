import express from 'express';
import { 
  register, 
  login, 
  getCurrentUser, 
  updatePassword, 
  logout, 
  verifyToken 
} from '../controllers/authController.js';
import { 
  authenticate 
} from '../middleware/auth.js';
import { 
  validateUserRegistration, 
  validateUserLogin,
  handleValidationErrors 
} from '../middleware/validation.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { body } from 'express-validator';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */

// Password update validation
const validatePasswordUpdate = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  handleValidationErrors
];

// Public routes (no authentication required)
router.post('/register', authLimiter, validateUserRegistration, register);
router.post('/login', authLimiter, validateUserLogin, login);

// Protected routes (authentication required)
router.get('/me', authenticate, getCurrentUser);
router.put('/update-password', authenticate, validatePasswordUpdate, updatePassword);
router.post('/logout', authenticate, logout);
router.get('/verify', authenticate, verifyToken);

export default router;