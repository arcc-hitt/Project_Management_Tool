import database from '../config/database.js';
import bcrypt from 'bcryptjs';
import { formatDateForDB, snakeToCamel, camelToSnake } from '../utils/helpers.js';

class User {
  constructor(data = {}) {
    // Accept both camelCase (from services) and snake_case (from database)
    this.id = data.id;
    this.firstName = data.firstName || data.first_name;
    this.lastName = data.lastName || data.last_name;
    this.email = data.email;
    this.passwordHash = data.passwordHash || data.password_hash;
    this.role = data.role || 'developer';
    this.avatarUrl = data.avatarUrl || data.avatar_url;
    this.lastLogin = data.lastLogin || data.last_login;
    this.phone = data.phone;
    this.timezone = data.timezone || 'UTC';
    this.emailVerified = data.emailVerified || data.email_verified || false;
    this.emailVerifiedAt = data.emailVerifiedAt || data.email_verified_at;
    this.isActive = data.isActive !== undefined ? data.isActive : (data.is_active !== undefined ? data.is_active : true);
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  // Static methods for database operations
  static async create(userData) {
    try {
      // Hash password before storing
      let passwordHash = null;
      if (userData.password) {
        passwordHash = await bcrypt.hash(userData.password, 10);
      }

      const query = `
        INSERT INTO users (first_name, last_name, email, password_hash, role, avatar_url, phone, timezone, email_verified, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const values = [
        userData.firstName || userData.first_name,
        userData.lastName || userData.last_name,
        userData.email,
        passwordHash,
        userData.role || 'developer',
        userData.avatarUrl || userData.avatar_url || null,
        userData.phone || null,
        userData.timezone || 'UTC',
        userData.emailVerified || userData.email_verified || false,
        userData.isActive !== undefined ? userData.isActive : (userData.is_active !== undefined ? userData.is_active : true)
      ];

      const [result] = await database.query(query, values);
      
      // Fetch and return the created user
      return await User.findById(result.insertId);
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = ? AND is_active = TRUE';
      const [rows] = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }

      // Convert from snake_case to camelCase for the model
      return new User(rows[0]);
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = ? AND is_active = TRUE';
      const [rows] = await database.query(query, [email]);
      
      if (rows.length === 0) {
        return null;
      }

      return new User(rows[0]);
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  static async findAll(options = {}) {
    try {
      let query = 'SELECT * FROM users WHERE is_active = TRUE';
      const values = [];

      // Add filtering options
      if (options.role) {
        query += ' AND role = ?';
        values.push(options.role);
      }

      if (options.search) {
        query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
        const searchTerm = `%${options.search}%`;
        values.push(searchTerm, searchTerm, searchTerm);
      }

      // Add ordering
      query += ' ORDER BY created_at DESC';

      // Add pagination
      if (options.limit) {
        query += ' LIMIT ?';
        values.push(parseInt(options.limit));
        
        if (options.offset) {
          query += ' OFFSET ?';
          values.push(parseInt(options.offset));
        }
      }

      const [rows] = await database.query(query, values);
      return rows.map(row => new User(row));
    } catch (error) {
      throw new Error(`Error finding users: ${error.message}`);
    }
  }

  static async count(options = {}) {
    try {
      let query = 'SELECT COUNT(*) as total FROM users WHERE is_active = TRUE';
      const values = [];

      if (options.role) {
        query += ' AND role = ?';
        values.push(options.role);
      }

      if (options.search) {
        query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
        const searchTerm = `%${options.search}%`;
        values.push(searchTerm, searchTerm, searchTerm);
      }

      const [rows] = await database.query(query, values);
      return rows[0].total;
    } catch (error) {
      throw new Error(`Error counting users: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      // Hash password if it's being updated
      if (updateData.password) {
        updateData.password_hash = await bcrypt.hash(updateData.password, 10);
        delete updateData.password; // Remove plain password
      }

      const fields = [];
      const values = [];

      // Build dynamic update query
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined && key !== 'id') {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      // Add updated timestamp
      fields.push('updated_at = NOW()');
      values.push(id);

      const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
      await database.query(query, values);

      return await User.findById(id);
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      // Soft delete - set is_active to false
      const query = 'UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE id = ?';
      const [result] = await database.query(query, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  static async updateLastLogin(id) {
    try {
      const query = 'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = ?';
      await database.query(query, [id]);
    } catch (error) {
      throw new Error(`Error updating last login: ${error.message}`);
    }
  }

  // Instance methods
  async save() {
    try {
      if (this.id) {
        // Update existing user
        return await User.update(this.id, this.toObject());
      } else {
        // Create new user
        const created = await User.create(this.toObject());
        this.id = created.id;
        this.created_at = created.created_at;
        this.updated_at = created.updated_at;
        return this;
      }
    } catch (error) {
      throw new Error(`Error saving user: ${error.message}`);
    }
  }

  async comparePassword(candidatePassword) {
    try {
      return await bcrypt.compare(candidatePassword, this.passwordHash);
    } catch (error) {
      throw new Error(`Error comparing password: ${error.message}`);
    }
  }

  async getProjects() {
    try {
      const query = `
        SELECT p.*, pm.role as member_role, pm.joined_at
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = ? AND p.status != 'cancelled'
        ORDER BY pm.joined_at DESC
      `;
      
      const [rows] = await database.query(query, [this.id]);
      return rows;
    } catch (error) {
      throw new Error(`Error getting user projects: ${error.message}`);
    }
  }

  async getTasks(options = {}) {
    try {
      let query = `
        SELECT t.*, p.name as project_name
        FROM tasks t
        INNER JOIN projects p ON t.project_id = p.id
        WHERE t.assigned_to = ?
      `;
      const values = [this.id];

      if (options.status) {
        query += ' AND t.status = ?';
        values.push(options.status);
      }

      if (options.project_id) {
        query += ' AND t.project_id = ?';
        values.push(options.project_id);
      }

      query += ' ORDER BY t.created_at DESC';

      if (options.limit) {
        query += ' LIMIT ?';
        values.push(parseInt(options.limit));
      }

      const [rows] = await database.query(query, values);
      return rows;
    } catch (error) {
      throw new Error(`Error getting user tasks: ${error.message}`);
    }
  }

  toObject() {
    return {
      id: this.id,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      passwordHash: this.passwordHash,
      role: this.role,
      avatarUrl: this.avatarUrl,
      lastLogin: this.lastLogin,
      phone: this.phone,
      timezone: this.timezone,
      emailVerified: this.emailVerified,
      emailVerifiedAt: this.emailVerifiedAt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    const obj = this.toObject();
    // Remove password_hash from JSON representation
    delete obj.passwordHash;
    return obj;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  // Email verification methods
  static async verifyEmail(userId) {
    try {
      const query = `
        UPDATE users 
        SET email_verified = true, email_verified_at = NOW(), updated_at = NOW()
        WHERE id = ?
      `;
      
      await database.query(query, [userId]);
      return true;
    } catch (error) {
      throw new Error(`Error verifying email: ${error.message}`);
    }
  }

  // Validation methods
  static validateCreate(data) {
    const errors = [];

    const firstName = data.firstName || data.first_name;
    const lastName = data.lastName || data.last_name;

    if (!firstName || firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!lastName || lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    if (!data.email || data.email.trim().length === 0) {
      errors.push('Email is required');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Invalid email format');
    }

    if (!data.password || data.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (data.role && !['admin', 'manager', 'developer'].includes(data.role)) {
      errors.push('Invalid role specified');
    }

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    const firstName = data.firstName || data.first_name;
    const lastName = data.lastName || data.last_name;

    if (firstName !== undefined && firstName.trim().length === 0) {
      errors.push('First name cannot be empty');
    }

    if (lastName !== undefined && lastName.trim().length === 0) {
      errors.push('Last name cannot be empty');
    }

    if (data.email !== undefined) {
      if (data.email.trim().length === 0) {
        errors.push('Email cannot be empty');
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('Invalid email format');
      }
    }

    if (data.password !== undefined && data.password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }

    if (data.role && !['admin', 'manager', 'developer'].includes(data.role)) {
      errors.push('Invalid role specified');
    }

    return errors;
  }
}

export default User;