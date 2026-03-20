import { Router } from 'express';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';
import * as complianceController from '../controllers/compliance.controller';

const router = Router();

// Public endpoints (no auth required)
router.get('/public/:organizationId/badges', complianceController.listPublicBadges);
router.get('/public/:organizationId/trust-page', complianceController.getTrustPage);

// Badge type metadata (no auth required)
router.get('/types', complianceController.getBadgeTypes);

// Protected endpoints (require auth + org membership)
router.use(firebaseAuth);
router.use(requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']));

// Get all badges for current org
router.get('/', complianceController.listBadges);

// Get compliance stats
router.get('/stats', complianceController.getStats);

// Get single badge
router.get('/:id', complianceController.getBadge);

// Create badge (admin/owner only)
router.post('/', requireOrganizationRole(['OWNER', 'ADMIN']), complianceController.createBadge);

// Reorder badges (admin/owner only)
router.put('/reorder', requireOrganizationRole(['OWNER', 'ADMIN']), complianceController.reorderBadges);

// Update badge (admin/owner only)
router.put('/:id', requireOrganizationRole(['OWNER', 'ADMIN']), complianceController.updateBadge);

// Delete badge (admin/owner only)
router.delete('/:id', requireOrganizationRole(['OWNER', 'ADMIN']), complianceController.deleteBadge);

export default router;
