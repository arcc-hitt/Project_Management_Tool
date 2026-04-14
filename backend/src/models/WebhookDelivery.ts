import database from '../config/database.js';
import { mapDoc, toObjectId, withTimestampsOnCreate } from '../utils/mongo.js';

class WebhookDelivery {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.webhookId = data.webhookId || data.webhook_id;
    this.event = data.event;
    this.statusCode = data.statusCode !== undefined ? data.statusCode : data.status_code;
    this.responseBody = data.responseBody !== undefined ? data.responseBody : data.response_body;
    this.attemptCount = data.attemptCount !== undefined ? data.attemptCount : (data.attempt_count || 0);
    this.deliveredAt = data.deliveredAt || data.delivered_at || null;
    this.createdAt = data.createdAt || data.created_at;
  }

  static async _collection() {
    return database.getCollection('webhook_deliveries');
  }

  static _fromDoc(doc: any): WebhookDelivery | null {
    return doc ? new WebhookDelivery(mapDoc(doc)) : null;
  }

  static async create(deliveryData: any): Promise<WebhookDelivery> {
    try {
      const deliveries = await WebhookDelivery._collection();

      const payload = withTimestampsOnCreate({
        webhookId: deliveryData.webhookId || deliveryData.webhook_id,
        event: deliveryData.event,
        statusCode: deliveryData.statusCode !== undefined ? deliveryData.statusCode : null,
        responseBody: deliveryData.responseBody !== undefined ? deliveryData.responseBody : null,
        attemptCount: deliveryData.attemptCount || 0,
        deliveredAt: deliveryData.deliveredAt || null,
      });

      const result = await deliveries.insertOne(payload);
      return await WebhookDelivery.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating webhook delivery: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<WebhookDelivery | null> {
    try {
      const deliveries = await WebhookDelivery._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await deliveries.findOne({ _id });
      return WebhookDelivery._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding webhook delivery by ID: ${error.message}`);
    }
  }

  static async findByWebhook(webhookId: string): Promise<WebhookDelivery[]> {
    try {
      const deliveries = await WebhookDelivery._collection();
      const docs = await deliveries.find({ webhookId }).sort({ createdAt: -1 }).toArray();
      return docs.map((doc) => WebhookDelivery._fromDoc(doc));
    } catch (error) {
      throw new Error(`Error finding deliveries by webhook: ${error.message}`);
    }
  }

  toObject(): object {
    return {
      id: this.id,
      webhookId: this.webhookId,
      event: this.event,
      statusCode: this.statusCode,
      responseBody: this.responseBody,
      attemptCount: this.attemptCount,
      deliveredAt: this.deliveredAt,
      createdAt: this.createdAt,
    };
  }

  toJSON(): object {
    return this.toObject();
  }
}

export default WebhookDelivery;
