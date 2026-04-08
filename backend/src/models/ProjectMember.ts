import database from '../config/database.js';
import { mapDoc, normalizeId, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class ProjectMember {
  [key: string]: any;
  constructor(data: any = {}) {
    this.id = data.id;
    this.projectId = data.projectId || data.project_id;
    this.userId = data.userId || data.user_id;
    this.role = data.role || 'developer';
    this.joinedAt = data.joinedAt || data.joined_at;
  }

  static async _collection() {
    return database.getCollection('project_members');
  }

  static async findAll(where: any = {}) {
    try {
      const col = await ProjectMember._collection();
      const filter = {};
      for (const [k, v] of Object.entries(where)) {
        const key = k === 'project_id' ? 'projectId' : k === 'user_id' ? 'userId' : k;
        filter[key] = v;
      }
      const rows = await col.find(filter).toArray();
      return rows.map((row) => new ProjectMember(mapDoc(row)));
    } catch (error) {
      throw new Error(`Failed to fetch project members: ${error.message}`);
    }
  }

  static async findByProjectId(projectId) {
    return this.findAll({ projectId });
  }

  static async findByUserId(userId) {
    return this.findAll({ userId });
  }

  static async findOne(where) {
    const results = await this.findAll(where);
    return results[0] || null;
  }

  static async create(data) {
    try {
      const col = await ProjectMember._collection();
      await col.updateOne(
        { projectId: data.projectId, userId: data.userId },
        { $set: withUpdatedAt({ role: data.role || 'developer' }), $setOnInsert: { joinedAt: new Date() } },
        { upsert: true }
      );
      return this.findOne({ projectId: data.projectId, userId: data.userId });
    } catch (error) {
      throw new Error(`Failed to create project member: ${error.message}`);
    }
  }

  async save() {
    try {
      if (this.id) {
        const col = await ProjectMember._collection();
        await col.updateOne({ _id: toObjectId(this.id) }, { $set: withUpdatedAt({ role: this.role }) });
      } else {
        const created = await ProjectMember.create(this);
        Object.assign(this, created);
      }
      return this;
    } catch (error) {
      throw new Error(`Failed to save project member: ${error.message}`);
    }
  }

  static async delete(where) {
    try {
      const col = await ProjectMember._collection();
      const filter = {};
      for (const [k, v] of Object.entries(where || {})) {
        const key = k === 'project_id' ? 'projectId' : k === 'user_id' ? 'userId' : k;
        filter[key] = v;
      }
      await col.deleteMany(filter);
    } catch (error) {
      throw new Error(`Failed to delete project member: ${error.message}`);
    }
  }
}

export default ProjectMember;


