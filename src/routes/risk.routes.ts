/**
 * PS 26105 v1 Risk API
 *
 * Firebase-authenticated, organisation-scoped risk endpoints.
 *
 *   POST /api/v1/risk/recalculate        — run a new calculation (OWNER/ADMIN)
 *   GET  /api/v1/risk/current            — latest succeeded assessment
 *   GET  /api/v1/risk/assessments        — assessment history
 *   GET  /api/v1/risk/assessments/:id    — a single historical assessment
 *
 * NOTE: these endpoints deliberately do NOT accept an `?organizationId=`
 * query override.  Tenant scope always comes from the authenticated user.
 */

import { Router } from 'express';
import { firebaseAuth, requireOrganizationRole } from '../middleware/auth';
import { cyberRiskController } from '../controllers/cyber-risk.controller';

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
router.get(
  '/assessments/:id',
  firebaseAuth,
  anyRole,
  cyberRiskController.getAssessment.bind(cyberRiskController),
);

export default router;
