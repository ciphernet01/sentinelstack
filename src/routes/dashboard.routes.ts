import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { firebaseAuth } from '../middleware/auth';

const router = Router();

// @route   GET /api/dashboard/summary
// @desc    Get summary data for the dashboard
// @access  Private
router.get('/summary', firebaseAuth, dashboardController.getDashboardSummary);

// @route   GET /api/dashboard/analytics
// @desc    Get risk analytics data (charts/tables)
// @access  Private
router.get('/analytics', firebaseAuth, dashboardController.getRiskAnalytics);

// @route   GET /api/dashboard/target
// @desc    Get per-target drilldown analytics (risk timeline + recurring findings)
// @access  Private
router.get('/target', firebaseAuth, dashboardController.getTargetAnalytics);


export default router;
