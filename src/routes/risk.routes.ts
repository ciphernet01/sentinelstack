/**
 * PS 26105 v1 Risk API
 *
 * Firebase-authenticated, organisation-scoped risk endpoints.
 *
 *   POST /api/v1/risk/recalculate                 — run a new calculation (OWNER/ADMIN)
 *   GET  /api/v1/risk/current                     — latest succeeded assessment
 *   GET  /api/v1/risk/assessments                 — assessment history
 *   GET  /api/v1/risk/assessments/:id             — a single historical assessment
 *   GET  /api/v1/risk/assessments/:id/changes     — why risk changed (P3)
 *
 *   GET  /api/v1/risk/drivers                     — normalized risk drivers (P3)
 *   GET  /api/v1/risk/drivers/:id                 — driver drill-down (P3)
 *   POST /api/v1/risk/drivers/:id/review          — human review annotation (P3)
 *   GET  /api/v1/risk/evidence/:id                — evidence record (P3)
 *
 * NOTE: these endpoints deliberately do NOT accept an `?organizationId=`
 * query override.  Tenant scope always comes from the authenticated user.
 */

import { Router } from 'express';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';
import { cyberRiskController } from '../controllers/cyber-risk.controller';
import { riskDriverController } from '../controllers/risk-driver.controller';

const router = Router();

const anyRole = requireOrganizationRole(['OWNER', 'ADMIN', 'MEMBER']);
const adminOnly = requireOrganizationRole(['OWNER', 'ADMIN']);

// POST /api/v1/risk/recalculate
router.post(
  '/recalculate',
  firebaseAuth,
  adminOnly,
  cyberRiskController.recalculate.bind(cyberRiskController),
);

// GET /api/v1/risk/current
router.get(
  '/current',
  firebaseAuth,
  anyRole,
  cyberRiskController.getCurrent.bind(cyberRiskController),
);

// GET /api/v1/risk/assessments
router.get(
  '/assessments',
  firebaseAuth,
  anyRole,
  cyberRiskController.listAssessments.bind(cyberRiskController),
);

// GET /api/v1/risk/assessments/:id
// Registered before /assessments/:id/changes would otherwise be shadowed by
// the single-segment :id route.
router.get(
  '/assessments/:id/changes',
  firebaseAuth,
  anyRole,
  riskDriverController.getAssessmentChanges.bind(riskDriverController),
);

router.get(
  '/assessments/:id',
  firebaseAuth,
  anyRole,
  cyberRiskController.getAssessment.bind(cyberRiskController),
);

// ── P3 — risk drivers & evidence ───────────────────────────────────────────

// GET /api/v1/risk/drivers
router.get(
  '/drivers',
  firebaseAuth,
  anyRole,
  riskDriverController.listDrivers.bind(riskDriverController),
);

// GET /api/v1/risk/drivers/:driverId
router.get(
  '/drivers/:driverId',
  firebaseAuth,
  anyRole,
  riskDriverController.getDriver.bind(riskDriverController),
);

// POST /api/v1/risk/drivers/:driverId/review
// A governance annotation, so it is admin-gated: it writes to the audit ledger.
router.post(
  '/drivers/:driverId/review',
  firebaseAuth,
  adminOnly,
  riskDriverController.reviewDriver.bind(riskDriverController),
);

// GET /api/v1/risk/evidence/:evidenceId
router.get(
  '/evidence/:evidenceId',
  firebaseAuth,
  anyRole,
  riskDriverController.getEvidence.bind(riskDriverController),
);

export default router;
