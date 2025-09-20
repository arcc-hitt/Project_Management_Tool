import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import authService from '../services/authService.js';

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: User ID
 *         email:
 *           type: string
 *           format: email
 *           description: User email
 *         firstName:
 *           type: string
 *           description: First name
 *         lastName:
 *           type: string
 *           description: Last name
 *         role:
 *           type: string
 *           enum: [admin, manager, developer]
 *           description: User role
 *         avatarUrl:
 *           type: string
 *           description: Avatar URL
 *         isActive:
 *           type: boolean
 *           description: Account status
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     UserRegistration:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - firstName
 *         - lastName
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *         firstName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         lastName:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *         role:
 *           type: string
 *           enum: [admin, manager, developer]
 *           default: developer
 *     
 *     UserLogin:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *     
 *     AuthResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             user:
 *               $ref: '#/components/schemas/User'
 *             token:
 *               type: string
 *         timestamp:
 *           type: string
 *           format: date-time
 *     
 *     PasswordUpdate:
 *       type: object
 *       required:
 *         - currentPassword
 *         - newPassword
 *       properties:
 *         currentPassword:
 *           type: string
 *         newPassword:
 *           type: string
 *           minLength: 6
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegistration'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error or user already exists
 *       500:
 *         description: Server error
 */
export const register = asyncHandler(async (req, res) => {
  try {
    const result = await authService.register(req.body);
    
    return sendSuccess(
      res, 
      'User registered successfully', 
      result, 
      201
    );
  } catch (error) {
    if (error.message.includes('already exists')) {
      return sendError(res, error.message, 409);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
export const login = asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    
    return sendSuccess(res, 'Login successful', result);
  } catch (error) {
    if (error.message.includes('Invalid email or password') || 
        error.message.includes('Account is deactivated')) {
      return sendError(res, error.message, 401);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
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
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 */
export const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    const user = await authService.getCurrentUser(req.user.id);
    
    return sendSuccess(res, 'User profile retrieved successfully', user);
  } catch (error) {
    if (error.message.includes('not found')) {
      return sendError(res, error.message, 404);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/auth/update-password:
 *   put:
 *     summary: Update user password
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PasswordUpdate'
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Invalid current password or validation error
 *       401:
 *         description: Unauthorized
 */
export const updatePassword = asyncHandler(async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    await authService.updatePassword(req.user.id, currentPassword, newPassword);
    
    return sendSuccess(res, 'Password updated successfully');
  } catch (error) {
    if (error.message.includes('Current password is incorrect')) {
      return sendError(res, error.message, 400);
    }
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (client-side token removal)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
export const logout = asyncHandler(async (req, res) => {
  // Since we're using stateless JWT tokens, logout is handled client-side
  // by removing the token from storage. This endpoint is for consistency.
  return sendSuccess(res, 'Logged out successfully');
});

/**
 * @swagger
 * /api/auth/verify:
 *   get:
 *     summary: Verify JWT token validity
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
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
 *                     valid:
 *                       type: boolean
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *       401:
 *         description: Invalid or expired token
 */
export const verifyToken = asyncHandler(async (req, res) => {
  // If we reach here, the token is valid (authentication middleware passed)
  return sendSuccess(res, 'Token is valid', {
    valid: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role
    }
  });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     accessToken:
 *                       type: string
 *       400:
 *         description: Refresh token is required
 *       401:
 *         description: Invalid refresh token
 */
export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return sendError(res, 'Refresh token is required', 400);
  }

  try {
    const result = await authService.refreshToken(refreshToken);
    return sendSuccess(res, 'Token refreshed successfully', result);
  } catch (error) {
    return sendError(res, error.message, 401);
  }
});

/**
 * @swagger
 * /api/auth/request-password-reset:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: User email
 *     responses:
 *       200:
 *         description: Password reset instructions sent
 *       400:
 *         description: Email is required
 */
export const requestPasswordReset = asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 'Email is required', 400);
  }

  try {
    const resetToken = await authService.requestPasswordReset(email);
    // In production, you would send this token via email
    // For development, we'll return it in the response
    return sendSuccess(res, 'Password reset instructions sent', { resetToken });
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *                 description: Password reset token
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: New password (minimum 6 characters)
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Reset token and new password are required
 *       401:
 *         description: Invalid or expired reset token
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;

  if (!resetToken || !newPassword) {
    return sendError(res, 'Reset token and new password are required', 400);
  }

  if (newPassword.length < 6) {
    return sendError(res, 'Password must be at least 6 characters long', 400);
  }

  try {
    await authService.resetPassword(resetToken, newPassword);
    return sendSuccess(res, 'Password reset successfully');
  } catch (error) {
    return sendError(res, error.message, 401);
  }
});

/**
 * @swagger
 * /api/auth/send-verification:
 *   post:
 *     summary: Send email verification
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Email already verified
 */
export const sendEmailVerification = asyncHandler(async (req, res) => {
  try {
    const verificationToken = await authService.sendEmailVerification(req.user.id);
    // In production, you would send this token via email
    // For development, we'll return it in the response
    return sendSuccess(res, 'Verification email sent', { verificationToken });
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     summary: Verify email address
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - verificationToken
 *             properties:
 *               verificationToken:
 *                 type: string
 *                 description: Email verification token
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Verification token is required
 *       401:
 *         description: Invalid or expired verification token
 */
export const verifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.body;

  if (!verificationToken) {
    return sendError(res, 'Verification token is required', 400);
  }

  try {
    await authService.verifyEmail(verificationToken);
    return sendSuccess(res, 'Email verified successfully');
  } catch (error) {
    return sendError(res, error.message, 401);
  }
});

/**
 * @swagger
 * /api/auth/update-profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               timezone:
 *                 type: string
 *               avatarUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Authentication required
 *       400:
 *         description: Invalid profile data
 */
export const updateProfile = asyncHandler(async (req, res) => {
  try {
    const updatedUser = await authService.updateProfile(req.user.id, req.body);
    return sendSuccess(res, 'Profile updated successfully', { user: updatedUser });
  } catch (error) {
    return sendError(res, error.message, 400);
  }
});