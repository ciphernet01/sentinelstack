import { Router } from 'express';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';
import { cyberRiskController } from '../controllers/cyber-risk.controller';

const router = Router();

// ─── Legacy endpoints (preserved, backward-compatible) ────────────────────────

// @route   GET /api/cyber-risk/enterprise
// @desc    Enterprise financial cyber exposure, EAL, VaR, drivers, scenarios, optimization
//          Now enriched with _provenance block (riskRunId, hashes, version metadata).
// @access  Private
router.get(
  '/enterprise',
  firebaseAuth,
  requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']),
  cyberRiskController.getEnterpriseRisk.bind(cyberRiskController),
);

// @route   POST /api/cyber-risk/snapshots
// @desc    Persist the current deterministic risk calculation for trend/reporting use
// @access  Private
router.post(
  '/snapshots',
  firebaseAuth,
  requireOrganizationRole(['OWNER', 'ADMIN']),
  cyberRiskController.createSnapshot.bind(cyberRiskController),
);

// ─── PS 26105 v1 endpoints ─────────────────────────────────────────────────────

// @route   POST /api/cyber-risk/v1/recalculate
// @desc    Trigger a full risk calculation run; returns RiskRun provenance metadata.
//          P2 will change this to async (202 + job poll). Today it runs synchronously.
// @access  Private (OWNER / ADMIN only)
router.post(
  '/v1/recalculate',
  firebaseAuth,
  requireOrganizationRole(['OWNER', 'ADMIN']),
  cyberRiskController.recalculate.bind(cyberRiskController),
);

// @route   GET /api/cyber-risk/v1/current
// @desc    Returns the latest succeeded RiskRun + RiskAssessment for the org.
//          Does NOT trigger a new calculation.
// @access  Private
router.get(
  '/v1/current',
  firebaseAuth,
  requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']),
  cyberRiskController.getCurrent.bind(cyberRiskController),
);

export default router;
