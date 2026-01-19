
import { Router } from 'express';
import { assessmentController } from '../controllers/assessment.controller';
import { firebaseAuth, adminOnly } from '../middleware/auth';
import { validateAssessmentCreation } from '../middleware/validators';

const router = Router();

// === CLIENT & ADMIN Routes ===

// @route   POST /api/assessments
// @desc    Create a new assessment
// @access  Private (Client or Admin)
router.post('/', firebaseAuth, validateAssessmentCreation, assessmentController.createAssessment);

// @route   POST /api/assessments/reset
// @desc    DEV ONLY: Delete all assessments for the current org
// @access  Private
router.post('/reset', firebaseAuth, assessmentController.resetAssessmentsForOrg);

// @route   GET /api/assessments
// @desc    Get all assessments for the logged-in user (or all for admin)
// @access  Private
router.get('/', firebaseAuth, assessmentController.getAllAssessments);

// @route   GET /api/assessments/:id
// @desc    Get a single assessment by ID
// @access  Private (Owner or Admin)
router.get('/:id', firebaseAuth, assessmentController.getAssessmentById);


// === ADMIN ONLY Routes ===

// @route   PATCH /api/assessments/:id/status
// @desc    Update assessment status
// @access  Private (Admin only)
router.patch('/:id/status', firebaseAuth, adminOnly, assessmentController.updateAssessmentStatus);

// @route   POST /api/assessments/:id/findings
// @desc    Upload findings for an assessment
// @access  Private (Admin only)
router.post('/:id/findings', firebaseAuth, adminOnly, assessmentController.addFindings);

export default router;
