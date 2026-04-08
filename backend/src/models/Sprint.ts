import database from '../config/database.js';
import { mapDoc, toObjectId, withTimestampsOnCreate, withUpdatedAt } from '../utils/mongo.js';

class Sprint {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.organizationId = data.organizationId || data.organization_id;
    this.projectId = data.projectId || data.project_id;
    this.name = data.name;
    this.goal = data.goal;
    this.startDate = data.startDate || data.start_date;
    this.endDate = data.endDate || data.end_date;
    this.state = data.state || 'created';
    this.completedStoryPoints = data.completedStoryPoints !== undefined ? data.completedStoryPoints : null;
    this.completedIssueCount = data.completedIssueCount !== undefined ? data.completedIssueCount : null;
    this.createdAt = data.createdAt || data.created_at;
    this.updatedAt = data.updatedAt || data.updated_at;
  }

  static async _collection() {
    return database.getCollection('sprints');
  }

  static _fromDoc(doc) {
    return doc ? new Sprint(mapDoc(doc)) : null;
  }

  static async create(sprintData): Promise<Sprint> {
    try {
      const sprints = await Sprint._collection();

      // Validate startDate < endDate if both provided
      if (sprintData.startDate && sprintData.endDate) {
        const start = new Date(sprintData.startDate);
        const end = new Date(sprintData.endDate);
        if (start >= end) {
          throw new Error('startDate must be strictly before endDate');
        }
      }

      const payload = withTimestampsOnCreate({
        organizationId: sprintData.organizationId || sprintData.organization_id || null,
        projectId: sprintData.projectId || sprintData.project_id,
        name: sprintData.name,
        goal: sprintData.goal || null,
        startDate: sprintData.startDate || sprintData.start_date || null,
        endDate: sprintData.endDate || sprintData.end_date || null,
        state: sprintData.state || 'created',
        completedStoryPoints: sprintData.completedStoryPoints !== undefined ? sprintData.completedStoryPoints : null,
        completedIssueCount: sprintData.completedIssueCount !== undefined ? sprintData.completedIssueCount : null,
      });

      const result = await sprints.insertOne(payload);
      return await Sprint.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating sprint: ${error.message}`);
    }
  }

  static async findById(id): Promise<Sprint | null> {
    try {
      const sprints = await Sprint._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await sprints.findOne({ _id });
      return Sprint._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding sprint by ID: ${error.message}`);
    }
  }

  static async findByProject(projectId: string, options: any = {}): Promise<Sprint[]> {
    try {
      const sprints = await Sprint._collection();
      const filter: Record<string, any> = { projectId };

      if (options.state) {
        filter.state = options.state;
      }

      const docs = await sprints.find(filter).sort({ createdAt: -1 }).toArray();
      return docs.map((doc) => Sprint._fromDoc(doc));
    } catch (error) {
      throw new Error(`Error finding sprints by project: ${error.message}`);
    }
  }

  static async findActiveByProject(projectId: string): Promise<Sprint | null> {
    try {
      const sprints = await Sprint._collection();
      const doc = await sprints.findOne({ projectId, state: 'active' });
      return Sprint._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding active sprint by project: ${error.message}`);
    }
  }

  static async update(id: string, updateData: any): Promise<Sprint> {
    try {
      const sprints = await Sprint._collection();
      const _id = toObjectId(id);
      if (!_id) throw new Error('Invalid sprint ID');

      const mapped: Record<string, any> = {};
      const keyMap = {
        project_id: 'projectId',
        start_date: 'startDate',
        end_date: 'endDate',
        organization_id: 'organizationId',
        completed_story_points: 'completedStoryPoints',
        completed_issue_count: 'completedIssueCount',
      };

      for (const [key, value] of Object.entries(updateData)) {
        if (value === undefined || key === 'id') continue;
        mapped[keyMap[key] || key] = value;
      }

      // Validate date ordering if both dates are being updated
      const startDate = mapped.startDate;
      const endDate = mapped.endDate;
      if (startDate && endDate) {
        if (new Date(startDate) >= new Date(endDate)) {
          throw new Error('startDate must be strictly before endDate');
        }
      }

      if (Object.keys(mapped).length === 0) {
        throw new Error('No fields to update');
      }

      await sprints.updateOne({ _id }, { $set: withUpdatedAt(mapped) });
      return await Sprint.findById(id);
    } catch (error) {
      throw new Error(`Error updating sprint: ${error.message}`);
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const sprints = await Sprint._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await sprints.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting sprint: ${error.message}`);
    }
  }

  toObject(): object {
    return {
      id: this.id,
      organizationId: this.organizationId,
      projectId: this.projectId,
      name: this.name,
      goal: this.goal,
      startDate: this.startDate,
      endDate: this.endDate,
      state: this.state,
      completedStoryPoints: this.completedStoryPoints,
      completedIssueCount: this.completedIssueCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toJSON(): object {
    return this.toObject();
  }
}

export default Sprint;
