import bcrypt from 'bcryptjs';
import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class User {
  [key: string]: any;

  constructor(data: any = {}) {
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
    this.organizationId = data.organizationId || data.organization_id;
    this.ssoProviders = data.ssoProviders || data.sso_providers || [];
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  static async _collection() {
    return database.getCollection('users');
  }

  static _fromDoc(doc) {
    return doc ? new User(mapDoc(doc)) : null;
  }

  static async create(userData) {
    try {
      const users = await User._collection();
      const passwordHash = userData.password ? await bcrypt.hash(userData.password, 10) : null;

      const payload = withTimestampsOnCreate({
        firstName: userData.firstName || userData.first_name,
        lastName: userData.lastName || userData.last_name,
        email: userData.email,
        passwordHash,
        role: userData.role || 'developer',
        avatarUrl: userData.avatarUrl || userData.avatar_url || null,
        phone: userData.phone || null,
        timezone: userData.timezone || 'UTC',
        emailVerified: userData.emailVerified || userData.email_verified || false,
        emailVerifiedAt: userData.emailVerifiedAt || userData.email_verified_at || null,
        isActive: userData.isActive !== undefined ? userData.isActive : (userData.is_active !== undefined ? userData.is_active : true),
        organizationId: userData.organizationId || userData.organization_id || null,
        ssoProviders: userData.ssoProviders || userData.sso_providers || [],
      });

      const result = await users.insertOne(payload);
      return await User.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating user: ${error.message}`);
    }
  }

  static async findById(id, options: any = {}) {
    try {
      const users = await User._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const filter: Record<string, any> = { _id };
      if (!options.includeInactive) {
        filter.isActive = true;
      }

      const doc = await users.findOne(filter);
      return User._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding user by ID: ${error.message}`);
    }
  }

  static async findByEmail(email) {
    try {
      const users = await User._collection();
      const doc = await users.findOne({ email, isActive: true });
      return User._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding user by email: ${error.message}`);
    }
  }

  static async findAll(options: any = {}) {
    try {
      const users = await User._collection();
      const filter: Record<string, any> = { isActive: true };

      if (options.role) {
        filter.role = options.role;
      }

      if (options.search) {
        const regex = new RegExp(options.search, 'i');
        filter.$or = [
          { firstName: regex },
          { lastName: regex },
          { email: regex },
        ];
      }

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const offset = options.offset ? parseInt(options.offset, 10) : 0;

      const docs = await users
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit || 0)
        .toArray();

      return docs.map((doc) => User._fromDoc(doc));
    } catch (error) {
      throw new Error(`Error finding users: ${error.message}`);
    }
  }

  static async count(options: any = {}) {
    try {
      const users = await User._collection();
      const filter: Record<string, any> = { isActive: true };

      if (options.role) {
        filter.role = options.role;
      }

      if (options.search) {
        const regex = new RegExp(options.search, 'i');
        filter.$or = [
          { firstName: regex },
          { lastName: regex },
          { email: regex },
        ];
      }

      return await users.countDocuments(filter);
    } catch (error) {
      throw new Error(`Error counting users: ${error.message}`);
    }
  }

  static async update(id, updateData) {
    try {
      const users = await User._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid user ID');

      const normalized = { ...updateData };
      if (normalized.password) {
        normalized.passwordHash = await bcrypt.hash(normalized.password, 10);
        delete normalized.password;
      }

      const mapped: Record<string, any> = {};
      const keyMap = {
        first_name: 'firstName',
        last_name: 'lastName',
        password_hash: 'passwordHash',
        avatar_url: 'avatarUrl',
        last_login: 'lastLogin',
        email_verified: 'emailVerified',
        email_verified_at: 'emailVerifiedAt',
        is_active: 'isActive',
      };

      for (const [key, value] of Object.entries(normalized)) {
        if (value === undefined || key === 'id') continue;
        mapped[keyMap[key] || key] = value;
      }

      if (Object.keys(mapped).length === 0) {
        throw new Error('No fields to update');
      }

      await users.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return await User.findById(id, { includeInactive: true });
    } catch (error) {
      throw new Error(`Error updating user: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const users = await User._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await users.updateOne({ _id }, { $set: withUpdatedAt({ isActive: false }) });
      return result.modifiedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting user: ${error.message}`);
    }
  }

  static async updateLastLogin(id) {
    try {
      const users = await User._collection();
      const _id = toObjectId(id);
      if (!_id) return;

      await users.updateOne({ _id }, { $set: withUpdatedAt({ lastLogin: new Date() }) });
    } catch (error) {
      throw new Error(`Error updating last login: ${error.message}`);
    }
  }

  async save() {
    try {
      if (this.id) {
        return await User.update(this.id, this.toObject());
      }

      const created = await User.create(this.toObject());
      this.id = created.id;
      this.createdAt = created.createdAt;
      this.updatedAt = created.updatedAt;
      return this;
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
      const projectMembers = await database.getCollection('project_members');
      const projects = await database.getCollection('projects');

      const memberships = await projectMembers.find({ userId: this.id }).sort({ joinedAt: -1 }).toArray();
      if (memberships.length === 0) return [];

      const projectIds = memberships.map((m) => toObjectId(m.projectId)).filter(Boolean);
      const docs = await projects.find({ _id: { $in: projectIds }, status: { $ne: 'cancelled' } }).toArray();
      const byId = new Map(docs.map((doc) => [normalizeId(doc._id), mapDoc(doc)]));

      return memberships
        .map((m) => {
          const p = byId.get(m.projectId);
          return p ? { ...p, member_role: m.role, joined_at: m.joinedAt } : null;
        })
        .filter(Boolean);
    } catch (error) {
      throw new Error(`Error getting user projects: ${error.message}`);
    }
  }

  async getTasks(options: any = {}) {
    try {
      const tasks = await database.getCollection('tasks');
      const projects = await database.getCollection('projects');

      const filter: Record<string, any> = { assignedTo: this.id };
      if (options.status) filter.status = options.status;
      if (options.project_id) filter.projectId = options.project_id;

      const limit = options.limit ? parseInt(options.limit, 10) : 0;
      const docs = await tasks.find(filter).sort({ createdAt: -1 }).limit(limit || 0).toArray();
      if (docs.length === 0) return [];

      const projectIds = [...new Set(docs.map((d) => d.projectId).filter(Boolean))]
        .map((id) => toObjectId(id))
        .filter(Boolean);
      const projectDocs = await projects.find({ _id: { $in: projectIds } }).toArray();
      const projectMap = new Map(projectDocs.map((p) => [normalizeId(p._id), p.name]));

      return docs.map((doc) => ({
        ...mapDoc(doc),
        project_name: projectMap.get(doc.projectId) || null,
      }));
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
      organizationId: this.organizationId,
      ssoProviders: this.ssoProviders,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toJSON() {
    const obj = this.toObject();
    delete obj.passwordHash;
    return obj;
  }

  get fullName() {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  static async verifyEmail(userId) {
    try {
      const users = await User._collection();
      const _id = toObjectId(userId);
      if (!_id) return false;

      await users.updateOne(
        { _id },
        { $set: withUpdatedAt({ emailVerified: true, emailVerifiedAt: new Date() }) }
      );
      return true;
    } catch (error) {
      throw new Error(`Error verifying email: ${error.message}`);
    }
  }

  static async verifyPassword(userId, candidatePassword) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.passwordHash) return false;
      return await bcrypt.compare(candidatePassword, user.passwordHash);
    } catch (error) {
      throw new Error(`Error verifying password: ${error.message}`);
    }
  }

  static async updatePassword(userId, newPassword) {
    try {
      const users = await User._collection();
      const _id = toObjectId(userId);
      if (!_id) return false;

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await users.updateOne({ _id }, { $set: withUpdatedAt({ passwordHash }) });
      return true;
    } catch (error) {
      throw new Error(`Error updating password: ${error.message}`);
    }
  }

  static async setPasswordResetToken(userId, token, expiry) {
    try {
      const users = await User._collection();
      const _id = toObjectId(userId);
      if (!_id) return false;
      await users.updateOne(
        { _id },
        { $set: withUpdatedAt({ passwordResetToken: token, passwordResetExpires: expiry }) }
      );
      return true;
    } catch (error) {
      throw new Error(`Error setting password reset token: ${error.message}`);
    }
  }

  static async findByPasswordResetToken(token) {
    try {
      const users = await User._collection();
      const now = new Date();
      const doc = await users.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: now },
        isActive: true,
      });
      return User._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding user by password reset token: ${error.message}`);
    }
  }

  static async resetPasswordWithToken(userId, newPassword) {
    try {
      const users = await User._collection();
      const _id = toObjectId(userId);
      if (!_id) return false;

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await users.updateOne(
        { _id },
        {
          $set: withUpdatedAt({ passwordHash }),
          $unset: { passwordResetToken: '', passwordResetExpires: '' },
        }
      );
      return true;
    } catch (error) {
      throw new Error(`Error resetting password with token: ${error.message}`);
    }
  }

  static async setEmailVerificationToken(userId, token, expiry) {
    try {
      const users = await User._collection();
      const _id = toObjectId(userId);
      if (!_id) return false;
      await users.updateOne(
        { _id },
        { $set: withUpdatedAt({ emailVerificationToken: token, emailVerificationExpires: expiry }) }
      );
      return true;
    } catch (error) {
      throw new Error(`Error setting email verification token: ${error.message}`);
    }
  }

  static async findByEmailVerificationToken(token) {
    try {
      const users = await User._collection();
      const now = new Date();
      const doc = await users.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: now },
        isActive: true,
      });
      return User._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding user by email verification token: ${error.message}`);
    }
  }

  static async verifyEmailWithToken(userId) {
    try {
      const users = await User._collection();
      const _id = toObjectId(userId);
      if (!_id) return false;
      await users.updateOne(
        { _id },
        {
          $set: withUpdatedAt({ emailVerified: true, emailVerifiedAt: new Date() }),
          $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
        }
      );
      return true;
    } catch (error) {
      throw new Error(`Error verifying email with token: ${error.message}`);
    }
  }

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

  static async addSSOProvider(userId: string, provider: 'google' | 'github', providerId: string): Promise<User> {
    try {
      const users = await User._collection();
      const _id = toObjectId(userId);
      if (!_id) throw new Error('Invalid user ID');

      // Check if already exists to avoid duplicates
      const existing = await users.findOne({
        _id,
        'ssoProviders.provider': provider,
        'ssoProviders.providerId': providerId,
      });

      if (!existing) {
        await users.updateOne(
          { _id },
          {
            $push: { ssoProviders: { provider, providerId } } as any,
            $set: { updatedAt: new Date() },
          }
        );
      }

      return await User.findById(userId, { includeInactive: true });
    } catch (error) {
      throw new Error(`Error adding SSO provider: ${error.message}`);
    }
  }

  static async findBySSOProvider(provider: string, providerId: string): Promise<User | null> {
    try {
      const users = await User._collection();
      const doc = await users.findOne({
        'ssoProviders.provider': provider,
        'ssoProviders.providerId': providerId,
      });
      return User._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding user by SSO provider: ${error.message}`);
    }
  }
}

export default User;


