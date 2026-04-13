import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import searchController from '../controllers/searchController.js';

const router = Router();

router.use(authenticate);

router.post('/', (req, res) => searchController.saveFilter(req, res));
router.get('/', (req, res) => searchController.listFilters(req, res));
router.get('/:id/run', (req, res) => searchController.runFilter(req, res));
router.delete('/:id', (req, res) => searchController.deleteFilter(req, res));

export default router;
