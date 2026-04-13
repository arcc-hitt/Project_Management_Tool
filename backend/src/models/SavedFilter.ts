import database from '../config/database.js';
import { mapDoc, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

export interface FilterCriteria {
  query?: string;
  issueType?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  projectId?: string;
  sprintId?: string;
  label?: string[];
  componentId?: string;
  bugSeverity?: string;
  versionId?: string;
  epicId?: string;
  storyPointsMin?: number;
  storyPointsMax?: number;
  createdAtFrom?: string;
  createdAtTo?: string;
  updatedAtFrom?: string;
  updatedAtTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

class SavedFilter {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.organizationId = data.organizationId || data.organization_id;
    this.userId = data.userId || data.user_id;
    this.name = data.name;
    this.criteria = data.criteria || {};
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  static async _collection() {
    return database.getCollection('filters');
  }

  static _fromDoc(doc: any): SavedFilter | null {
    return doc ? new SavedFilter(mapDoc(doc)) : null;
  }

  static async create(filterData: any): Promise<SavedFilter> {
    try {
      const filters = await SavedFilter._collection();
      const payload = withTimestampsOnCreate({
        organizationId: filterData.organizationId || filterData.organization_id || null,
        userId: filterData.userId || filterData.user_id,
        name: filterData.name,
        criteria: filterData.criteria || {},
      });

      const result = await filters.insertOne(payload);
      return await SavedFilter.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating saved filter: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<SavedFilter | null> {
    try {
      const filters = await SavedFilter._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await filters.findOne({ _id });
      return SavedFilter._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding saved filter by ID: ${error.message}`);
    }
  }

  static async findByUser(userId: string, organizationId?: string): Promise<SavedFilter[]> {
    try {
      const filters = await SavedFilter._collection();
      const query: Record<string, any> = { userId };
      if (organizationId) query.organizationId = organizationId;

      const docs = await filters.find(query).sort({ createdAt: -1 }).toArray();
      return docs.map((doc) => SavedFilter._fromDoc(doc)).filter(Boolean) as SavedFilter[];
    } catch (error) {
      throw new Error(`Error finding saved filters by user: ${error.message}`);
    }
  }

  static async update(id: string, updateData: any): Promise<SavedFilter | null> {
    try {
      const filters = await SavedFilter._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid saved filter ID');

      const mapped: Record<string, any> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined || key === 'id') continue;
        mapped[key] = value;
      }

      if (Object.keys(mapped).length === 0) {
        throw new Error('No fields to update');
      }

      await filters.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return await SavedFilter.findById(id);
    } catch (error) {
      throw new Error(`Error updating saved filter: ${error.message}`);
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const filters = await SavedFilter._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await filters.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting saved filter: ${error.message}`);
    }
  }

  toObject() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      userId: this.userId,
      name: this.name,
      criteria: this.criteria,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toJSON() {
    return this.toObject();
  }
}

export default SavedFilter;
