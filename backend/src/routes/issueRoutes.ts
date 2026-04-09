import express from 'express';
import issueController from '../controllers/issueController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, issueController.listIssues);
router.post('/', authenticateToken, issueController.createIssue);
// PUT /reorder must be before /:id to avoid route conflict
router.put('/reorder', authenticateToken, issueController.reorderIssues);
router.get('/:id', authenticateToken, issueController.getIssue);
router.put('/:id', authenticateToken, issueController.updateIssue);
router.delete('/:id', authenticateToken, issueController.deleteIssue);
router.post('/:id/transition', authenticateToken, issueController.transitionIssue);

export default router;
