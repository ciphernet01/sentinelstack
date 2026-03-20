
import { Router } from 'express';
import { reportController } from '../controllers/report.controller';
import { firebaseAuth, adminOnly } from '../middleware/auth';

const router = Router();

// === CLIENT & ADMIN Routes ===

// @route   GET /api/reports/:id/download
// @desc    Download a generated PDF report
// @access  Private (Owner or Admin)
router.get('/:id/download', firebaseAuth, reportController.downloadReport);


// @route   POST /api/reports/assessments/:id/generate
// @desc    Generate a PDF report for an assessment
// @access  Private (Owner or Admin)
// The user must be the owner of the assessment or an admin to generate it.
router.post('/assessments/:id/generate', firebaseAuth, reportController.generateReport);


export default router;


