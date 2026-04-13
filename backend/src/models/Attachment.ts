import database from '../config/database.js';
import { mapDoc, toObjectId, withTimestampsOnCreate } from '../utils/mongo.js';

class Attachment {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.organizationId = data.organizationId || data.organization_id;
    this.issueId = data.issueId || data.issue_id;
    this.uploadedBy = data.uploadedBy || data.uploaded_by;
    this.filename = data.filename;
    this.originalName = data.originalName || data.original_name;
    this.mimeType = data.mimeType || data.mime_type;
    this.sizeBytes = data.sizeBytes !== undefined ? data.sizeBytes : data.size_bytes;
    this.storagePath = data.storagePath || data.storage_path;
    this.createdAt = data.createdAt || data.created_at;
  }

  static async _collection() {
    return database.getCollection('attachments');
  }

  static _fromDoc(doc: any): Attachment | null {
    return doc ? new Attachment(mapDoc(doc)) : null;
  }

  static async create(attachmentData: any): Promise<Attachment> {
    try {
      const attachments = await Attachment._collection();

      const payload = withTimestampsOnCreate({
        organizationId: attachmentData.organizationId || attachmentData.organization_id || null,
        issueId: attachmentData.issueId || attachmentData.issue_id,
        uploadedBy: attachmentData.uploadedBy || attachmentData.uploaded_by,
        filename: attachmentData.filename,
        originalName: attachmentData.originalName || attachmentData.original_name,
        mimeType: attachmentData.mimeType || attachmentData.mime_type,
        sizeBytes: attachmentData.sizeBytes !== undefined ? attachmentData.sizeBytes : attachmentData.size_bytes,
        storagePath: attachmentData.storagePath || attachmentData.storage_path,
      });

      const result = await attachments.insertOne(payload);
      return await Attachment.findById(result.insertedId.toHexString());
    } catch (error) {
      throw new Error(`Error creating attachment: ${error.message}`);
    }
  }

  static async findById(id: string): Promise<Attachment | null> {
    try {
      const attachments = await Attachment._collection();
      const _id = toObjectId(id);
      if (!_id) return null;

      const doc = await attachments.findOne({ _id });
      return Attachment._fromDoc(doc);
    } catch (error) {
      throw new Error(`Error finding attachment by ID: ${error.message}`);
    }
  }

  static async findByIssue(issueId: string): Promise<Attachment[]> {
    try {
      const attachments = await Attachment._collection();
      const docs = await attachments.find({ issueId }).sort({ createdAt: 1 }).toArray();
      return docs.map((doc) => Attachment._fromDoc(doc));
    } catch (error) {
      throw new Error(`Error finding attachments by issue: ${error.message}`);
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const attachments = await Attachment._collection();
      const _id = toObjectId(id);
      if (!_id) return false;

      const result = await attachments.deleteOne({ _id });
      return result.deletedCount > 0;
    } catch (error) {
      throw new Error(`Error deleting attachment: ${error.message}`);
    }
  }

  toObject(): object {
    return {
      id: this.id,
      organizationId: this.organizationId,
      issueId: this.issueId,
      uploadedBy: this.uploadedBy,
      filename: this.filename,
      originalName: this.originalName,
      mimeType: this.mimeType,
      sizeBytes: this.sizeBytes,
      storagePath: this.storagePath,
      createdAt: this.createdAt,
    };
  }

  toJSON(): object {
    return this.toObject();
  }
}

export default Attachment;
