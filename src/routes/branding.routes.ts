import { Router } from 'express';
import { brandingController } from '../controllers/branding.controller';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(firebaseAuth);

// Get branding (all members can view)
router.get('/', requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']), brandingController.get.bind(brandingController));

// Get public branding (safe for client-side)
router.get('/public', requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']), brandingController.getPublic.bind(brandingController));

// Update branding (owner/admin only)
router.put('/', requireOrganizationRole(['OWNER', 'ADMIN']), brandingController.update.bind(brandingController));

// Get domain verification instructions
router.get('/domain/verify', requireOrganizationRole(['OWNER', 'ADMIN']), brandingController.getVerificationInstructions.bind(brandingController));

// Verify custom domain
router.post('/domain/verify', requireOrganizationRole(['OWNER', 'ADMIN']), brandingController.verifyDomain.bind(brandingController));

// Reset branding to defaults
router.delete('/', requireOrganizationRole(['OWNER', 'ADMIN']), brandingController.delete.bind(brandingController));

export default router;
