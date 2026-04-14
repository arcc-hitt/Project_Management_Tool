import express from 'express';
import webhookService from '../services/webhookService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/webhooks — register a webhook
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const webhook = await webhookService.registerWebhook(req.body, req.user.id);
    return res.status(201).json({ success: true, data: webhook });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

// GET /api/webhooks?projectId=:projectId — list webhooks for a project
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    if (!projectId) {
      return res.status(400).json({ success: false, message: 'projectId query parameter is required' });
    }
    const webhooks = await webhookService.listWebhooks(projectId, req.user.id);
    return res.status(200).json({ success: true, data: webhooks });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

// DELETE /api/webhooks/:id — delete a webhook
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    await webhookService.deleteWebhook(req.params.id, req.user.id);
    return res.status(204).send();
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return next(error);
  }
});

export default router;
