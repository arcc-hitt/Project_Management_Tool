import database from '../config/database.js';
import { mapDoc, toObjectId, withTimestampsOnCreate } from '../utils/mongo.js';

export interface AuditLogData {
  organizationId?: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, any> | null;
  newValues?: Record<string, any> | null;
  ipAddress: string;
  userAgent: string;
}

export interface AuditLogFilters {
  actorUserId?: string;
  entityType?: string;
  action?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  organizationId?: string;
}

class AuditLog {
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id;
    this.organizationId = data.organizationId;
    this.actorUserId = data.actorUserId;
    this.action = data.action;
    this.entityType = data.entityType;
    this.entityId = data.entityId;
    this.oldValues = data.oldValues ?? null;
    this.newValues = data.newValues ?? null;
    this.ipAddress = data.ipAddress;
    this.userAgent = data.userAgent;
    this.createdAt = data.createdAt;
  }

  static async _collection() {
    return database.getCollection('audit_logs');
  }

  /** Append-only create — no update or delete methods exist. Req 11.2, 11.3 */
  static async create(data: AuditLogData): Promise<AuditLog> {
    try {
      const col = await AuditLog._collection();
      const payload = withTimestampsOnCreate({
        organizationId: data.organizationId || null,
        actorUserId: data.actorUserId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        oldValues: data.oldValues ?? null,
        newValues: data.newValues ?? null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      });
      // Remove updatedAt — audit logs are immutable
      delete (payload as any).updatedAt;

      const result = await col.insertOne(payload);
      const doc = await col.findOne({ _id: result.insertedId });
      return new AuditLog(mapDoc(doc));
    } catch (error: any) {
      throw new Error(`Error creating audit log: ${error.message}`);
    }
  }

  /**
   * Query audit logs with optional filters and pagination. Req 11.4
   * Returns { logs, total } for pagination support.
   */
  static async findAll(
    filters: AuditLogFilters = {},
    page = 1,
    limit = 25
  ): Promise<{ logs: AuditLog[]; total: number }> {
    try {
      const col = await AuditLog._collection();
      const query: Record<string, any> = {};

      if (filters.organizationId) query.organizationId = filters.organizationId;
      if (filters.actorUserId) query.actorUserId = filters.actorUserId;
      if (filters.entityType) query.entityType = filters.entityType;
      if (filters.action) query.action = filters.action;

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
        if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
      }

      const safePage = Math.max(1, page);
      const safeLimit = Math.min(Math.max(1, limit), 100);
      const skip = (safePage - 1) * safeLimit;

      const [docs, total] = await Promise.all([
        col.find(query).sort({ createdAt: 1 }).skip(skip).limit(safeLimit).toArray(),
        col.countDocuments(query),
      ]);

      const logs = docs.map((doc) => new AuditLog(mapDoc(doc)));
      return { logs, total };
    } catch (error: any) {
      throw new Error(`Error querying audit logs: ${error.message}`);
    }
  }

  // ── Action constants ──────────────────────────────────────────────────────

  static get ACTIONS() {
    return {
      USER_ROLE_CHANGED: 'user.role_changed',
      PROJECT_MEMBER_ADDED: 'project.member_added',
      PROJECT_MEMBER_REMOVED: 'project.member_removed',
      PROJECT_SETTINGS_UPDATED: 'project.settings_updated',
      WEBHOOK_REGISTERED: 'webhook.registered',
      WEBHOOK_DELETED: 'webhook.deleted',
      SPRINT_STARTED: 'sprint.started',
      SPRINT_CLOSED: 'sprint.closed',
      SSO_LINKED: 'sso.linked',
      SSO_UNLINKED: 'sso.unlinked',
    } as const;
  }

  static get ENTITY_TYPES() {
    return {
      USER: 'user',
      PROJECT: 'project',
      WEBHOOK: 'webhook',
      SPRINT: 'sprint',
      SSO_PROVIDER: 'sso_provider',
    } as const;
  }
}

export default AuditLog;
