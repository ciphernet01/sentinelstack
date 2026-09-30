import { Router } from 'express';
import authRoutes from './auth.routes';
import assessmentRoutes from './assessment.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import internalRoutes from './internal.routes';
import orgRoutes from './org.routes';
import billingRoutes from './billing.routes';
import scheduledScanRoutes from './scheduled-scan.routes';
import webhookRoutes from './webhook.routes';
import apiKeyRoutes from './api-key.routes';
import publicApiRoutes from './public-api.routes';
import brandingRoutes from './branding.routes';
import complianceRoutes from './compliance.routes';
import adminRoutes from './admin.routes';
import aiRoutes from './ai.routes';
import cyberRiskRoutes from './cyber-risk.routes';
import riskRoutes from './risk.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/internal', internalRoutes);
router.use('/org', orgRoutes);
router.use('/billing', billingRoutes);
router.use('/scheduled-scans', scheduledScanRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/api-keys', apiKeyRoutes);
// PS 26105 risk API — Firebase-authenticated. Mounted before the API-key
// public API at /v1 so /api/v1/risk/* is not intercepted by apiKeyAuth.
router.use('/v1/risk', riskRoutes);
router.use('/v1', publicApiRoutes); // Public API endpoints
router.use('/branding', brandingRoutes);
router.use('/compliance', complianceRoutes);
router.use('/admin', adminRoutes);
router.use('/ai', aiRoutes);
router.use('/cyber-risk', cyberRiskRoutes);

export default router;
