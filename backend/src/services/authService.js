import { User } from '../models/index.js';
import { 
  hashPassword, 
  comparePassword, 
  generateToken 
} from '../middleware/auth.js';
import { 
  sendSuccess, 
  sendError, 
  snakeToCamel 
} from '../utils/helpers.js';

class AuthService {
  /**
   * Register a new user
   * @param {object} userData - User registration data
   * @returns {object} User data and token
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

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      // Get user data without password
      const userWithoutPassword = await User.findById(user.id);

      return {
        user: userWithoutPassword,
        token
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {object} User data and token
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

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      return {
        user,
        token
      };

    } catch (error) {
      throw error;
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
      return user !== null;
    } catch (error) {
      return false;
    }
  }
}

export default new AuthService();