import { hashPassword } from '../middleware/auth.js';
import User from '../models/User.js';
import auditLogService from './auditLogService.js';
import AuditLog from '../models/AuditLog.js';

class UserService {
  async getAllUsers(options: any = {}) {
    const {
      page = 1,
      limit = 10,
      role,
      isActive,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);
    const offset = (parsedPage - 1) * parsedLimit;

    const users = await User.findAll({
      role,
      search,
      limit: parsedLimit,
      offset,
      sortBy,
      sortOrder,
    });

    const filtered = isActive === undefined
      ? users
      : users.filter((u) => u.isActive === (isActive === true || isActive === 'true'));

    const totalUsers = await User.count({ role, search });

    return {
      users: filtered.map((u) => u.toJSON()),
      pagination: {
        totalItems: totalUsers,
        totalPages: Math.ceil(totalUsers / parsedLimit),
        currentPage: parsedPage,
        itemsPerPage: parsedLimit,
        hasNextPage: parsedPage < Math.ceil(totalUsers / parsedLimit),
        hasPrevPage: parsedPage > 1,
      },
    };
  }

  async getUserById(userId) {
    const user = await User.findById(userId);
    return user ? user.toJSON() : null;
  }

  async createUser(userData, createdBy) {
    const { email, password, firstName, lastName, role = 'developer', avatarUrl } = userData;

    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const passwordHash = await hashPassword(password);

    const createdUser = await User.create({
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      avatarUrl: avatarUrl || null,
      createdBy,
    });

    if (!createdUser) {
      throw new Error('Failed to create user');
    }

    return createdUser.toJSON();
  }

  async updateUser(userId, userData, updatedBy) {
    const existingUser = await this.getUserById(userId);
    if (!existingUser) {
      throw new Error('User not found');
    }

    if (userData.email && userData.email !== existingUser.email) {
      const emailExists = await this.findUserByEmail(userData.email);
      if (emailExists && emailExists.id !== userId) {
        throw new Error('Email already in use by another user');
      }
    }

    const allowedFields = ['firstName', 'lastName', 'role', 'avatarUrl', 'isActive', 'email'];
    const updateData = {};
    for (const field of allowedFields) {
      if (userData[field] !== undefined) {
        updateData[field] = userData[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid fields to update');
    }

    const updated = await User.update(userId, updateData);
    return updated ? updated.toJSON() : null;
  }

  async deleteUser(userId, deletedBy) {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.role === 'admin' && deletedBy !== userId) {
      const deleter = await this.getUserById(deletedBy);
      if (!deleter || deleter.role !== 'admin') {
        throw new Error('Only administrators can delete admin users');
      }
    }

    await User.delete(userId);
    return true;
  }

  async reactivateUser(userId, reactivatedBy) {
    const user = await User.findById(userId, { includeInactive: true });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.isActive) {
      throw new Error('User is already active');
    }

    const updated = await User.update(userId, { isActive: true });
    return updated ? updated.toJSON() : null;
  }

  async getUserStats() {
    const users = await User.findAll({ limit: 10000 });
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      inactiveUsers: users.filter((u) => !u.isActive).length,
      adminCount: users.filter((u) => u.role === 'admin').length,
      managerCount: users.filter((u) => u.role === 'manager').length,
      developerCount: users.filter((u) => u.role === 'developer').length,
      newToday: users.filter((u) => u.createdAt && new Date(u.createdAt).toDateString() === now.toDateString()).length,
      newThisWeek: users.filter((u) => u.createdAt && new Date(u.createdAt) >= weekAgo).length,
    };

    return stats;
  }

  async findUserByEmail(email) {
    const user = await User.findByEmail(email);
    return user ? user.toJSON() : null;
  }

  async updateUserRole(userId, newRole, updatedBy, req?: any) {
    const validRoles = ['admin', 'manager', 'developer'];
    if (!validRoles.includes(newRole)) {
      throw new Error('Invalid role specified');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const oldRole = user.role;
    const updated = await User.update(userId, { role: newRole });

    // Audit log: user role change (Req 11.1)
    auditLogService.log(
      updatedBy,
      AuditLog.ACTIONS.USER_ROLE_CHANGED,
      AuditLog.ENTITY_TYPES.USER,
      userId,
      { role: oldRole },
      { role: newRole },
      req
    ).catch((err) => console.error('auditLog error (user.role_changed):', err));

    return updated ? updated.toJSON() : null;
  }
}

export default new UserService();
