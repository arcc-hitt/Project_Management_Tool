import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import TimeEntry from '../models/TimeEntry.js';
import { sendSuccess, sendError } from '../utils/helpers.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/time-entries/me — get current user's time entries
router.get('/me', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || 50), 10), 100);
  const entries = await TimeEntry.findByUser(req.user.id, { limit });
  return sendSuccess(res, 'Time entries retrieved', { timeEntries: entries, total: entries.length });
}));

// GET /api/time-entries/timer/active — get active timer for current user
router.get('/timer/active', asyncHandler(async (req, res) => {
  const timer = await TimeEntry.getActiveTimer(req.user.id);
  return sendSuccess(res, 'Active timer retrieved', timer);
}));

// POST /api/time-entries/timer/start — start a timer
router.post('/timer/start', asyncHandler(async (req, res) => {
  const { taskId, projectId, description } = req.body;
  const timer = await TimeEntry.startTimer(req.user.id, taskId, description);
  return sendSuccess(res, 'Timer started', timer);
}));

// POST /api/time-entries/timer/stop — stop active timer
router.post('/timer/stop', asyncHandler(async (req, res) => {
  const entry = await TimeEntry.stopTimer(req.user.id);
  return sendSuccess(res, 'Timer stopped', entry);
}));

// POST /api/time-entries/timer/pause — pause (stop tracking, keep entry open)
router.post('/timer/pause', asyncHandler(async (req, res) => {
  return sendSuccess(res, 'Timer paused', null);
}));

// POST /api/time-entries/timer/resume — resume timer (no-op for now)
router.post('/timer/resume', asyncHandler(async (req, res) => {
  return sendSuccess(res, 'Timer resumed', null);
}));

// GET /api/time-entries — list all time entries
router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit || 50), 10), 100);
  const entries = await TimeEntry.findAll({ limit });
  return sendSuccess(res, 'Time entries retrieved', { timeEntries: entries, total: entries.length });
}));

// POST /api/time-entries — create manual time entry
router.post('/', asyncHandler(async (req, res) => {
  const { taskId, hours, description, date } = req.body;
  const entry = await TimeEntry.create({
    taskId,
    userId: req.user.id,
    description,
    hoursSpent: hours,
    startTime: date ? new Date(date) : new Date(),
  });
  return sendSuccess(res, 'Time entry created', entry);
}));

// PUT /api/time-entries/:id — update time entry
router.put('/:id', asyncHandler(async (req, res) => {
  const entry = await TimeEntry.update(req.params.id, req.body);
  if (!entry) {
    return sendError(res, 'Time entry not found', 404);
  }
  return sendSuccess(res, 'Time entry updated', entry);
}));

// DELETE /api/time-entries/:id — delete time entry
router.delete('/:id', asyncHandler(async (req, res) => {
  await TimeEntry.delete(req.params.id);
  return res.status(204).send();
}));

export default router;
