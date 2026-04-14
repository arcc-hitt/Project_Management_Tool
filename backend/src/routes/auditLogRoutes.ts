import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/rbac.js';
import auditLogService from '../services/auditLogService.js';

const router = express.Router();

/**
 * GET /api/admin/audit-logs
 * Admin-only: query audit logs with optional filters and pagination.
 * Requirements: 11.4, 11.5
 */
router.get('/', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const {
      actorUserId,
      entityType,
      action,
      dateFrom,
      dateTo,
      page = '1',
      limit = '25',
    } = req.query as Record<string, string>;

    const filters: Record<string, any> = {};
    if (actorUserId) filters.actorUserId = actorUserId;
    if (entityType) filters.entityType = entityType;
    if (action) filters.action = action;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    // Scope to organization if available
    if ((req as any).organization?._id) {
      filters.organizationId = (req as any).organization._id.toString();
    }

    const result = await auditLogService.queryLogs(
      filters,
      parseInt(page, 10),
      parseInt(limit, 10)
    );

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    return next(error);
  }
});

export default router;
