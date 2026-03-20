import { Router } from 'express';
import { apiKeyController } from '../controllers/api-key.controller';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';

const router = Router();

// All routes require authentication and at least MEMBER role
router.use(firebaseAuth);

// List all API keys for organization (all members can view)
router.get('/', requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']), apiKeyController.list.bind(apiKeyController));

// Get single API key
router.get('/:id', requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']), apiKeyController.getById.bind(apiKeyController));

// Create new API key (admin only)
router.post('/', requireOrganizationRole(['OWNER', 'ADMIN']), apiKeyController.create.bind(apiKeyController));

// Update API key (admin only)
router.patch('/:id', requireOrganizationRole(['OWNER', 'ADMIN']), apiKeyController.update.bind(apiKeyController));

// Revoke API key (admin only)
router.post('/:id/revoke', requireOrganizationRole(['OWNER', 'ADMIN']), apiKeyController.revoke.bind(apiKeyController));

// Delete API key (admin only)
router.delete('/:id', requireOrganizationRole(['OWNER', 'ADMIN']), apiKeyController.delete.bind(apiKeyController));

export default router;
