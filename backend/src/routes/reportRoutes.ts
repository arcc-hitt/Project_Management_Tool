import express from 'express';
import dashboardService from '../services/dashboardService.js';
import { authenticateToken } from '../middleware/auth.js';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

const router = express.Router();

/**
 * GET /api/projects/:id/reports/burndown?sprintId=:sprintId
 * Returns daily burndown data (remaining story points + issue count) for a sprint.
 * Requirements: 14.1, 14.4, 14.5
 */
router.get('/projects/:id/reports/burndown', authenticateToken, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { sprintId } = req.query as { sprintId?: string };

    if (!sprintId) {
      return res.status(400).json(formatErrorResponse('sprintId query parameter is required'));
    }

    const data = await dashboardService.getBurndown(projectId as string, sprintId);
    return res.status(200).json(formatApiResponse(data, 'Burndown data retrieved successfully'));
  } catch (error: any) {
    console.error('getBurndown error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

/**
 * GET /api/projects/:id/reports/velocity
 * Returns per-sprint completed story points and issue count for the last 10 closed sprints.
 * Requirements: 14.2
 */
router.get('/projects/:id/reports/velocity', authenticateToken, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const data = await dashboardService.getVelocity(projectId as string);
    return res.status(200).json(formatApiResponse(data, 'Velocity data retrieved successfully'));
  } catch (error: any) {
    console.error('getVelocity error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

/**
 * GET /api/projects/:id/reports/issue-stats
 * Returns issue counts grouped by issueType, status, priority, and assigneeId.
 * Requirements: 14.3
 */
router.get('/projects/:id/reports/issue-stats', authenticateToken, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const data = await dashboardService.getIssueStats(projectId as string);
    return res.status(200).json(formatApiResponse(data, 'Issue stats retrieved successfully'));
  } catch (error: any) {
    console.error('getIssueStats error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

export default router;
