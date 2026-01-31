import { Router } from 'express';
import { scheduledScanController } from '../controllers/scheduled-scan.controller';
import { firebaseAuth } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(firebaseAuth);

// @route   GET /api/scheduled-scans
// @desc    List all scheduled scans for the organization
// @access  Private
router.get('/', scheduledScanController.list);

// @route   GET /api/scheduled-scans/:id
// @desc    Get a scheduled scan by ID
// @access  Private
router.get('/:id', scheduledScanController.getById);

// @route   POST /api/scheduled-scans
// @desc    Create a new scheduled scan
// @access  Private
router.post('/', scheduledScanController.create);

// @route   PATCH /api/scheduled-scans/:id
// @desc    Update a scheduled scan
// @access  Private
router.patch('/:id', scheduledScanController.update);

// @route   DELETE /api/scheduled-scans/:id
// @desc    Delete a scheduled scan
// @access  Private
router.delete('/:id', scheduledScanController.delete);

// @route   POST /api/scheduled-scans/:id/toggle
// @desc    Enable/disable a scheduled scan
// @access  Private
router.post('/:id/toggle', scheduledScanController.toggle);

export default router;
