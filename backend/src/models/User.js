import database from '../config/database.js';
import bcrypt from 'bcryptjs';
import { formatDateForDB } from '../utils/helpers.js';

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role || 'developer';
    this.avatar = data.avatar;
    this.lastLoginAt = data.lastLoginAt;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt;
  }

  // Static methods for database operations
  static async create(userData) {
    try {
      // Hash password before storing
      if (userData.password) {
        userData.password = await bcrypt.hash(userData.password, 10);
      }

      const query = `
        INSERT INTO users (firstName, lastName, email, password, role, avatar, isActive, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      const values = [
        userData.firstName,
        userData.lastName,
        userData.email,
        userData.password,
        userData.role || 'developer',
        userData.avatar || null,
        userData.isActive !== undefined ? userData.isActive : true
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
      const query = 'SELECT * FROM users WHERE id = ? AND isActive = TRUE';
      const [rows] = await database.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }

      return new User(rows[0]);
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = ? AND isActive = TRUE';
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
      let query = 'SELECT * FROM users WHERE isActive = TRUE';
      const values = [];

      // Add filtering options
      if (options.role) {
        query += ' AND role = ?';
        values.push(options.role);
      }

      if (options.search) {
        query += ' AND (firstName LIKE ? OR lastName LIKE ? OR email LIKE ?)';
        const searchTerm = `%${options.search}%`;
        values.push(searchTerm, searchTerm, searchTerm);
      }

      // Add ordering
      query += ' ORDER BY createdAt DESC';

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
      let query = 'SELECT COUNT(*) as total FROM users WHERE isActive = TRUE';
      const values = [];

      if (options.role) {
        query += ' AND role = ?';
        values.push(options.role);
      }

      if (options.search) {
        query += ' AND (firstName LIKE ? OR lastName LIKE ? OR email LIKE ?)';
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
        updateData.password = await bcrypt.hash(updateData.password, 10);
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
      fields.push('updatedAt = NOW()');
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
      // Soft delete - set isActive to false
      const query = 'UPDATE users SET isActive = FALSE, updatedAt = NOW() WHERE id = ?';
      const [result] = await database.query(query, [id]);
      
      return result.affectedRows > 0;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  static async updateLastLogin(id) {
    try {
      const query = 'UPDATE users SET lastLoginAt = NOW(), updatedAt = NOW() WHERE id = ?';
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
        this.createdAt = created.createdAt;
        this.updatedAt = created.updatedAt;
        return this;
      }
    } catch (error) {
      throw new Error(`Error saving user: ${error.message}`);
    }
  }

  async comparePassword(candidatePassword) {
    try {
      return await bcrypt.compare(candidatePassword, this.password);
    } catch (error) {
      throw new Error(`Error comparing password: ${error.message}`);
    }
  }

  async getProjects() {
    try {
      const query = `
        SELECT p.*, pm.role as memberRole, pm.joinedAt
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.projectId
        WHERE pm.userId = ? AND p.isActive = TRUE
        ORDER BY pm.joinedAt DESC
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
        SELECT t.*, p.name as projectName
        FROM tasks t
        INNER JOIN projects p ON t.projectId = p.id
        WHERE t.assignedTo = ?
      `;
      const values = [this.id];

      if (options.status) {
        query += ' AND t.status = ?';
        values.push(options.status);
      }

      if (options.projectId) {
        query += ' AND t.projectId = ?';
        values.push(options.projectId);
      }

      query += ' ORDER BY t.createdAt DESC';

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
      password: this.password,
      role: this.role,
      avatar: this.avatar,
      lastLoginAt: this.lastLoginAt,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toJSON() {
    const obj = this.toObject();
    // Remove password from JSON representation
    delete obj.password;
    return obj;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  // Validation methods
  static validateCreate(data) {
    const errors = [];

    if (!data.firstName || data.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!data.lastName || data.lastName.trim().length === 0) {
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

    if (data.role && !['admin', 'project_manager', 'developer', 'viewer'].includes(data.role)) {
      errors.push('Invalid role specified');
    }

    return errors;
  }

  static validateUpdate(data) {
    const errors = [];

    if (data.firstName !== undefined && data.firstName.trim().length === 0) {
      errors.push('First name cannot be empty');
    }

    if (data.lastName !== undefined && data.lastName.trim().length === 0) {
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

    if (data.role && !['admin', 'project_manager', 'developer', 'viewer'].includes(data.role)) {
      errors.push('Invalid role specified');
    }

    return errors;
  }
}

export default User;