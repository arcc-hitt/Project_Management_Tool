import type { Request } from 'express';
import AuditLog, { AuditLogFilters } from '../models/AuditLog.js';

/**
 * AuditLogService — append-only audit trail for administrative and security-sensitive actions.
 * Requirements: 11.1, 11.2, 11.4
 */
const auditLogService = {
  /**
   * Create an audit log entry.
   * Extracts ipAddress and userAgent from the Express request when provided.
   * Req 11.2
   */
  async log(
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValues: Record<string, any> | null,
    newValues: Record<string, any> | null,
    req?: Request | { ip?: string; headers?: Record<string, string | string[] | undefined>; organizationId?: string } | null
  ): Promise<AuditLog> {
    const ipAddress = req
      ? (req as any).ip ||
        (req as any).headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
        'unknown'
      : 'unknown';

    const userAgent = req
      ? (req as any).headers?.['user-agent']?.toString() || 'unknown'
      : 'unknown';

    const organizationId = req ? (req as any).organization?._id?.toString() || (req as any).organizationId || null : null;

    return AuditLog.create({
      organizationId,
      actorUserId,
      action,
      entityType,
      entityId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
    });
  },

  /**
   * Query audit logs with filters and pagination.
   * Supports filter by actorUserId, entityType, action, and date range.
   * Req 11.4
   */
  async queryLogs(
    filters: AuditLogFilters = {},
    page = 1,
    limit = 25
  ): Promise<{ logs: AuditLog[]; total: number; page: number; limit: number; totalPages: number }> {
    const { logs, total } = await AuditLog.findAll(filters, page, limit);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    return {
      logs,
      total,
      page,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit),
    };
  },
};

export default auditLogService;
