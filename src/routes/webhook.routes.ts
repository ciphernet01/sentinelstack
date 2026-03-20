import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';
import { firebaseAuth } from '../middleware/auth';
import { writeOperationLimiter } from '../middleware/rateLimit';

const router = Router();

// All routes require authentication
router.use(firebaseAuth);

// List all webhooks
router.get('/', webhookController.list);

// Get single webhook with delivery history
router.get('/:id', webhookController.getById);

// Create webhook
router.post('/', writeOperationLimiter, webhookController.create);

// Update webhook
router.patch('/:id', webhookController.update);

// Delete webhook
router.delete('/:id', webhookController.delete);

// Toggle webhook enabled/disabled
router.post('/:id/toggle', webhookController.toggle);

// Regenerate webhook secret
router.post('/:id/regenerate-secret', webhookController.regenerateSecret);

// Test webhook
router.post('/:id/test', webhookController.test);

// Get delivery history
router.get('/:id/deliveries', webhookController.getDeliveries);

export default router;
