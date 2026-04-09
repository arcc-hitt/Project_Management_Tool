import express from 'express';
import boardService from '../services/boardService.js';
import sprintService from '../services/sprintService.js';
import { authenticateToken } from '../middleware/auth.js';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

const router = express.Router();

router.get('/projects/:id/board', authenticateToken, async (req, res) => {
  try {
    const sprintId = req.query.sprintId as string | undefined;
    const columns = await boardService.getBoardColumns(req.params.id, sprintId);
    return res.status(200).json(formatApiResponse(columns, 'Board columns retrieved successfully'));
  } catch (error) {
    console.error('getBoardColumns error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

router.get('/projects/:id/backlog', authenticateToken, async (req, res) => {
  try {
    const issues = await sprintService.getBacklog(req.params.id);
    return res.status(200).json(formatApiResponse(issues, 'Backlog retrieved successfully'));
  } catch (error) {
    console.error('getBacklog error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

export default router;
