import { Router, raw } from 'express';
import { billingController } from '../controllers/billing.controller';
import { firebaseAuth } from '../middleware/auth';

const router = Router();

// Webhook route - no auth, raw body for signature verification
router.post('/webhook', raw({ type: 'application/json' }), (req, res) => 
  billingController.handleWebhook(req, res)
);

// Protected routes
router.use(firebaseAuth);

router.get('/subscription', (req, res) => 
  billingController.getSubscription(req, res)
);

router.post('/checkout', (req, res) => 
  billingController.createCheckout(req, res)
);

router.post('/portal', (req, res) => 
  billingController.createPortal(req, res)
);

router.get('/usage', (req, res) => 
  billingController.getUsage(req, res)
);

router.post('/can-scan', (req, res) => 
  billingController.checkCanScan(req, res)
);

export default router;
