import express from 'express';
import sprintService from '../services/sprintService.js';
import Sprint from '../models/Sprint.js';
import { authenticateToken } from '../middleware/auth.js';
import { formatApiResponse, formatErrorResponse } from '../utils/helpers.js';

const router = express.Router();

router.post('/projects/:id/sprints', authenticateToken, async (req, res) => {
  try {
    const sprint = await sprintService.createSprint(req.params.id, req.body);
    return res.status(201).json(formatApiResponse(sprint, 'Sprint created successfully'));
  } catch (error) {
    console.error('createSprint error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

router.post('/sprints/:id/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const sprint = await sprintService.startSprint(req.params.id, userId);
    return res.status(200).json(formatApiResponse(sprint, 'Sprint started successfully'));
  } catch (error) {
    console.error('startSprint error:', error);
    const status = error.statusCode === 409 ? 409 : error.statusCode || 500;
    return res.status(status).json(formatErrorResponse(error.message));
  }
});

router.post('/sprints/:id/close', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const sprint = await sprintService.closeSprint(req.params.id, userId);
    return res.status(200).json(formatApiResponse(sprint, 'Sprint closed successfully'));
  } catch (error) {
    console.error('closeSprint error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

router.get('/projects/:id/sprints', authenticateToken, async (req, res) => {
  try {
    const sprints = await Sprint.findByProject(req.params.id);
    return res.status(200).json(formatApiResponse(sprints, 'Sprints retrieved successfully'));
  } catch (error) {
    console.error('findByProject error:', error);
    return res.status(error.statusCode || 500).json(formatErrorResponse(error.message));
  }
});

export default router;
