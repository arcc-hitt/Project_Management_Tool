import database from '../config/database.js';
import { mapDoc, toObjectId, withTimestampsOnCreate } from '../utils/mongo.js';

class Webhook {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.organizationId = data.organizationId || data.organization_id;
    this.projectId = data.projectId || data.project_id;
    this.url = data.url;
    this.events = data.events || [];
    this.secret = data.secret || null;
    this.createdBy = data.createdBy || data.created_by;
    this.createdAt = data.createdAt || data.created_at;
  }

  static async _collection() {
    return database.getCollection('webhooks');
  }

  static _fromDoc(doc: any): Webhook | null {
    return doc ? new Webhook(mapDoc(doc)) : null;
  }

  static async create(webhookData: any): Promise<Webhook> {
    try {
      const webhooks = await Webhook._collection();

      const payload = withTimestampsOnCreate({
        organizationId: webhookData.organizationId || webhookData.organization_id || null,
        projectId: webhookData.projectId || webhookData.project_id,
        url: webhookData.url,
        events: webhookData.events || [],
        secret: webhookData.secret || null,
        createdBy: webhookData.createdBy || webhookData.created_by,
      });

      const result = await webhooks.insertOne(payload);
      return await Webhook.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating webhook: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<Webhook | null> {
    try {
      const webhooks = await Webhook._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await webhooks.findOne({ _id });
      return Webhook._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding webhook by ID: ${error.message}`);
    }
  }

  static async findByProject(projectId: string): Promise<Webhook[]> {
    try {
      const webhooks = await Webhook._collection();
      const docs = await webhooks.find({ projectId }).sort({ createdAt: -1 }).toArray();
      return docs.map((doc) => Webhook._fromDoc(doc));
    } catch (error) {
      throw new Error(`Error finding webhooks by project: ${error.message}`);
    }
  }

  static async findMatchingEvent(projectId: string, event: string): Promise<Webhook[]> {
    try {
      const webhooks = await Webhook._collection();
      const docs = await webhooks.find({ projectId, events: event }).toArray();
      return docs.map((doc) => Webhook._fromDoc(doc));
    } catch (error) {
      throw new Error(`Error finding webhooks for event: ${error.message}`);
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const webhooks = await Webhook._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await webhooks.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting webhook: ${error.message}`);
    }
  }

  toObject(): object {
    return {
      id: this.id,
      organizationId: this.organizationId,
      projectId: this.projectId,
      url: this.url,
      events: this.events,
      // Omit secret from serialization for security
      createdBy: this.createdBy,
      createdAt: this.createdAt,
    };
  }

  toJSON(): object {
    return this.toObject();
  }
}

export default Webhook;
