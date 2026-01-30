import { Router } from 'express';
import authRoutes from './auth.routes';
import assessmentRoutes from './assessment.routes';
import dashboardRoutes from './dashboard.routes';
import reportRoutes from './report.routes';
import internalRoutes from './internal.routes';
import orgRoutes from './org.routes';
import billingRoutes from './billing.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/assessments', assessmentRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/internal', internalRoutes);
router.use('/org', orgRoutes);
router.use('/billing', billingRoutes);

export default router;
