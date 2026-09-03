import { Router } from 'express';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';
import { cyberRiskController } from '../controllers/cyber-risk.controller';

const router = Router();

// @route   GET /api/cyber-risk/enterprise
// @desc    Calculate current enterprise financial cyber exposure, EAL, VaR, drivers, scenarios, and optimized allocation
// @access  Private
router.get(
  '/enterprise',
  firebaseAuth,
  requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']),
  cyberRiskController.getEnterpriseRisk,
);

// @route   POST /api/cyber-risk/snapshots
// @desc    Persist the current deterministic risk calculation for trend/reporting use
// @access  Private
router.post(
  '/snapshots',
  firebaseAuth,
  requireOrganizationRole(['OWNER', 'ADMIN']),
  cyberRiskController.createSnapshot,
);

export default router;
