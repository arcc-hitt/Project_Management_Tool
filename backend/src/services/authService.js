import { User } from '../models/index.js';
import { 
  hashPassword, 
  comparePassword, 
  generateToken,
  generateRefreshToken,
  verifyToken 
} from '../middleware/auth.js';
import { 
  sendSuccess, 
  sendError, 
  snakeToCamel 
} from '../utils/helpers.js';
import crypto from 'crypto';
import { config } from '../config/config.js';

class AuthService {
  /**
   * Register a new user
   * @param {object} userData - User registration data
   * @returns {object} User data and tokens
   */
  async register(userData) {
    const { email, password, firstName, lastName, role = 'developer' } = userData;

    try {
      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create user using model
      const user = await User.create({
        email,
        password,
        firstName,
        lastName,
        role
      });

      // Generate tokens
      const accessToken = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        email: user.email
      });

      // Get user data without password
      const userWithoutPassword = await User.findById(user.id);

      return {
        user: userWithoutPassword,
        accessToken,
        refreshToken
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {object} User data and tokens
   */
  async login(email, password) {
    try {
      // Find user by email using model
      const user = await User.findByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Verify password using model method
      const isPasswordValid = await User.verifyPassword(user.id, password);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Update last login
      await User.updateLastLogin(user.id);

      // Generate tokens
      const accessToken = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      const refreshToken = generateRefreshToken({
        id: user.id,
        email: user.email
      });

      return {
        user,
        accessToken,
        refreshToken
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {object} New access token
   */
  async refreshToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = verifyToken(refreshToken, true); // true for refresh token
      
      // Find user to ensure they still exist and are active
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        throw new Error('Invalid refresh token');
      }

      // Generate new access token
      const accessToken = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      return {
        accessToken
      };

    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get current user profile
   * @param {number} userId - User ID
   * @returns {object} User data
   */
  async getCurrentUser(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return user;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async updatePassword(userId, currentPassword, newPassword) {
    try {
      // Verify current password using model
      const isCurrentPasswordValid = await User.verifyPassword(userId, currentPassword);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Update password using model
      await User.updatePassword(userId, newPassword);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {string} Reset token
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        return null;
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token in user record
      await User.setPasswordResetToken(user.id, resetToken, resetTokenExpiry);

      return resetToken;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Reset password using reset token
   * @param {string} resetToken - Password reset token
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async resetPassword(resetToken, newPassword) {
    try {
      const user = await User.findByPasswordResetToken(resetToken);
      if (!user) {
        throw new Error('Invalid or expired reset token');
      }

      // Reset password and clear reset token
      await User.resetPasswordWithToken(user.id, newPassword);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Send email verification
   * @param {number} userId - User ID
   * @returns {string} Verification token
   */
  async sendEmailVerification(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.emailVerified) {
        throw new Error('Email already verified');
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification token
      await User.setEmailVerificationToken(userId, verificationToken, verificationExpiry);

      return verificationToken;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify email address
   * @param {string} verificationToken - Email verification token
   * @returns {boolean} Success status
   */
  async verifyEmail(verificationToken) {
    try {
      const user = await User.findByEmailVerificationToken(verificationToken);
      if (!user) {
        throw new Error('Invalid or expired verification token');
      }

      // Mark email as verified and clear verification token
      await User.verifyEmailWithToken(user.id);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout user (invalidate refresh token)
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  async logout(userId) {
    try {
      // In a more complex system, you might store refresh tokens in database
      // and invalidate them here. For now, we'll just return success
      // since JWT tokens are stateless
      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by email (legacy method for backward compatibility)
   * @param {string} email - User email
   * @returns {object|null} User data or null
   */
  async findUserByEmail(email) {
    try {
      return await User.findByEmail(email);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by ID (legacy method for backward compatibility)
   * @param {number} id - User ID
   * @returns {object|null} User data or null
   */
  async findUserById(id) {
    try {
      return await User.findById(id);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Verify user exists and is active
   * @param {number} userId - User ID
   * @returns {boolean} User exists and is active
   */
  async verifyUserExists(userId) {
    try {
      const user = await User.findById(userId);
      return user !== null && user.isActive;
    } catch (error) {
      return false;
    }
  }

  /**
   * Update user profile
   * @param {number} userId - User ID
   * @param {object} updateData - Profile data to update
   * @returns {object} Updated user data
   */
  async updateProfile(userId, updateData) {
    try {
      const allowedFields = ['firstName', 'lastName', 'phone', 'timezone', 'avatarUrl'];
      const filteredData = {};
      
      // Only allow updating specific fields
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      await User.update(userId, filteredData);
      
      // Return updated user data
      return await User.findById(userId);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Deactivate user account
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  async deactivateAccount(userId) {
    try {
      await User.update(userId, { isActive: false });
      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Reactivate user account
   * @param {number} userId - User ID
   * @returns {boolean} Success status
   */
  async reactivateAccount(userId) {
    try {
      await User.update(userId, { isActive: true });
      return true;

    } catch (error) {
      throw error;
    }
  }
}

export default new AuthService();