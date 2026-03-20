import { Router } from 'express';
import { firebaseAuth } from '../middleware/auth';
import { aiChatLimiter } from '../middleware/rateLimit';
import { aiController } from '../controllers/ai.controller';

const router = Router();

router.use(firebaseAuth);
router.post('/chat', aiChatLimiter, aiController.chat);

export default router;
