import database from '../config/database.js';
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
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Insert user into database
      const insertQuery = `
        INSERT INTO users (email, password_hash, first_name, last_name, role)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      const result = await database.query(insertQuery, [
        email, 
        passwordHash, 
        firstName, 
        lastName, 
        role
      ]);

      // Get the created user
      const user = await this.findUserById(result.insertId);
      if (!user) {
        throw new Error('Failed to create user');
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        user: snakeToCamel(userWithoutPassword),
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
      // Find user by email
      const user = await this.findUserByEmail(email);
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Account is deactivated');
      }

      // Compare password
      const isPasswordValid = await comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Generate token
      const token = generateToken({
        id: user.id,
        email: user.email,
        role: user.role
      });

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = user;

      return {
        user: snakeToCamel(userWithoutPassword),
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
      const user = await this.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Remove password hash from response
      const { passwordHash: _, ...userWithoutPassword } = user;

      return snakeToCamel(userWithoutPassword);

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
      // Get user with password hash
      const user = await this.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Hash new password
      const newPasswordHash = await hashPassword(newPassword);

      // Update password in database
      const updateQuery = `
        UPDATE users 
        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      await database.query(updateQuery, [newPasswordHash, userId]);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by email
   * @param {string} email - User email
   * @returns {object|null} User data or null
   */
  async findUserByEmail(email) {
    try {
      const query = `
        SELECT id, email, password_hash, first_name, last_name, 
               role, avatar_url, is_active, created_at, updated_at
        FROM users 
        WHERE email = ?
      `;
      
      const users = await database.query(query, [email]);
      return users.length > 0 ? snakeToCamel(users[0]) : null;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Find user by ID
   * @param {number} id - User ID
   * @returns {object|null} User data or null
   */
  async findUserById(id) {
    try {
      const query = `
        SELECT id, email, password_hash, first_name, last_name, 
               role, avatar_url, is_active, created_at, updated_at
        FROM users 
        WHERE id = ? AND is_active = TRUE
      `;
      
      const users = await database.query(query, [id]);
      return users.length > 0 ? snakeToCamel(users[0]) : null;

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
      const user = await this.findUserById(userId);
      return user !== null;
    } catch (error) {
      return false;
    }
  }
}

export default new AuthService();