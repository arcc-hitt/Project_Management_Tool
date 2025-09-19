import database from '../config/database.js';
import { 
  hashPassword 
} from '../middleware/auth.js';
import { 
  snakeToCamel, 
  camelToSnake,
  getPaginationSQL,
  formatDateForDB 
} from '../utils/helpers.js';

class UserService {
  /**
   * Get all users with pagination and filtering
   * @param {object} options - Query options
   * @returns {object} Users data with pagination
   */
  async getAllUsers(options = {}) {
    const { 
      page = 1, 
      limit = 10, 
      role, 
      isActive, 
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    try {
      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      let queryParams = [];

      if (role) {
        whereClause += ' AND role = ?';
        queryParams.push(role);
      }

      if (isActive !== undefined) {
        whereClause += ' AND is_active = ?';
        queryParams.push(isActive);
      }

      if (search) {
        whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
        const searchTerm = `%${search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
      }

      // Validate sort column
      const allowedSortColumns = ['id', 'email', 'first_name', 'last_name', 'role', 'created_at'];
      const sortColumn = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM users 
        ${whereClause}
      `;
      const [countResult] = await database.query(countQuery, queryParams);
      const totalUsers = countResult.total;

      // Get paginated users
      const { limit: sqlLimit, offset } = getPaginationSQL(page, limit);
      const usersQuery = `
        SELECT id, email, first_name, last_name, role, avatar_url, 
               is_active, created_at, updated_at
        FROM users 
        ${whereClause}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT ? OFFSET ?
      `;

      const users = await database.query(usersQuery, [...queryParams, sqlLimit, offset]);

      return {
        users: users.map(user => snakeToCamel(user)),
        pagination: {
          totalItems: totalUsers,
          totalPages: Math.ceil(totalUsers / limit),
          currentPage: page,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(totalUsers / limit),
          hasPrevPage: page > 1
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   * @returns {object|null} User data
   */
  async getUserById(userId) {
    try {
      const query = `
        SELECT id, email, first_name, last_name, role, avatar_url, 
               is_active, created_at, updated_at
        FROM users 
        WHERE id = ?
      `;
      
      const users = await database.query(query, [userId]);
      return users.length > 0 ? snakeToCamel(users[0]) : null;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {object} userData - User data
   * @param {number} createdBy - ID of user creating this user
   * @returns {object} Created user data
   */
  async createUser(userData, createdBy) {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      role = 'developer',
      avatarUrl 
    } = userData;

    try {
      // Check if user already exists
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Insert user
      const insertQuery = `
        INSERT INTO users (email, password_hash, first_name, last_name, role, avatar_url)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      const result = await database.query(insertQuery, [
        email, 
        passwordHash, 
        firstName, 
        lastName, 
        role,
        avatarUrl || null
      ]);

      // Get created user
      const createdUser = await this.getUserById(result.insertId);
      if (!createdUser) {
        throw new Error('Failed to create user');
      }

      return createdUser;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Update user
   * @param {number} userId - User ID
   * @param {object} userData - Updated user data
   * @param {number} updatedBy - ID of user making the update
   * @returns {object} Updated user data
   */
  async updateUser(userId, userData, updatedBy) {
    try {
      // Check if user exists
      const existingUser = await this.getUserById(userId);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Prepare update data
      const allowedFields = ['first_name', 'last_name', 'role', 'avatar_url', 'is_active'];
      const updateData = {};
      
      Object.keys(userData).forEach(key => {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        if (allowedFields.includes(snakeKey)) {
          updateData[snakeKey] = userData[key];
        }
      });

      if (Object.keys(updateData).length === 0) {
        throw new Error('No valid fields to update');
      }

      // Check email uniqueness if email is being updated
      if (userData.email && userData.email !== existingUser.email) {
        const emailExists = await this.findUserByEmail(userData.email);
        if (emailExists && emailExists.id !== userId) {
          throw new Error('Email already in use by another user');
        }
        updateData.email = userData.email;
      }

      // Build update query
      const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
      const updateQuery = `
        UPDATE users 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      await database.query(updateQuery, [...Object.values(updateData), userId]);

      // Return updated user
      return await this.getUserById(userId);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete (deactivate) user
   * @param {number} userId - User ID
   * @param {number} deletedBy - ID of user performing deletion
   * @returns {boolean} Success status
   */
  async deleteUser(userId, deletedBy) {
    try {
      // Check if user exists
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Don't allow deletion of admin users by non-admin users
      if (user.role === 'admin' && deletedBy !== userId) {
        const deleter = await this.getUserById(deletedBy);
        if (!deleter || deleter.role !== 'admin') {
          throw new Error('Only administrators can delete admin users');
        }
      }

      // Soft delete (deactivate)
      const updateQuery = `
        UPDATE users 
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      await database.query(updateQuery, [userId]);

      return true;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Reactivate user
   * @param {number} userId - User ID
   * @param {number} reactivatedBy - ID of user performing reactivation
   * @returns {object} Reactivated user data
   */
  async reactivateUser(userId, reactivatedBy) {
    try {
      // Check if user exists
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.isActive) {
        throw new Error('User is already active');
      }

      // Reactivate user
      const updateQuery = `
        UPDATE users 
        SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      await database.query(updateQuery, [userId]);

      return await this.getUserById(userId);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get user statistics
   * @returns {object} User statistics
   */
  async getUserStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN is_active = FALSE THEN 1 ELSE 0 END) as inactive_users,
          SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admin_count,
          SUM(CASE WHEN role = 'manager' THEN 1 ELSE 0 END) as manager_count,
          SUM(CASE WHEN role = 'developer' THEN 1 ELSE 0 END) as developer_count,
          SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as new_today,
          SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) as new_this_week
        FROM users
      `;

      const [stats] = await database.query(statsQuery);
      return snakeToCamel(stats);

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
        SELECT id, email, first_name, last_name, role, avatar_url, 
               is_active, created_at, updated_at
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
   * Update user role
   * @param {number} userId - User ID
   * @param {string} newRole - New role
   * @param {number} updatedBy - ID of user making the change
   * @returns {object} Updated user data
   */
  async updateUserRole(userId, newRole, updatedBy) {
    try {
      // Validate role
      const validRoles = ['admin', 'manager', 'developer'];
      if (!validRoles.includes(newRole)) {
        throw new Error('Invalid role specified');
      }

      // Check if user exists
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update role
      const updateQuery = `
        UPDATE users 
        SET role = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;

      await database.query(updateQuery, [newRole, userId]);

      return await this.getUserById(userId);

    } catch (error) {
      throw error;
    }
  }
}

export default new UserService();