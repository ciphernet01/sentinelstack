import { Router } from 'express';
import { firebaseAuth, adminOnly } from '../middleware/auth';
import { adminScanQueueController } from '../controllers/adminScanQueue.controller';
import { billingActionLimiter } from '../middleware/rateLimit';

const router = Router();

router.use(firebaseAuth);
router.use(adminOnly);

// Minimal ops endpoint: scan queue health.
router.get('/scan-queue', billingActionLimiter, (req, res) => adminScanQueueController.getQueueStats(req, res));

export default router;
