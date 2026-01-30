import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { firebaseAuth } from '../middleware/auth';

const router = Router();

// @route   POST /api/auth/login
// @desc    Authenticate user and return token
// @access  Public
router.post('/login', authController.login);

// @route   POST /api/auth/init
// @desc    Initialize user in DB on first login
// @access  Private (requires valid Firebase token)
router.post('/init', firebaseAuth, authController.initUser);

// @route   POST /api/auth/verify-email
// @desc    Verify user email with token
// @access  Public
router.post('/verify-email', authController.verifyEmail);

// @route   POST /api/auth/resend-verification
// @desc    Resend email verification link
// @access  Public
router.post('/resend-verification', authController.resendVerificationEmail);

// @route   POST /api/auth/request-password-reset
// @desc    Request password reset link
// @access  Public
router.post('/request-password-reset', authController.requestPasswordReset);

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', authController.resetPassword);

// @route   POST /api/auth/change-password
// @desc    Change password for authenticated user
// @access  Private
router.post('/change-password', firebaseAuth, authController.changePassword);

// @route   GET /api/auth/onboarding-status
// @desc    Get user's onboarding status
// @access  Private
router.get('/onboarding-status', firebaseAuth, authController.getOnboardingStatus);

// @route   POST /api/auth/complete-onboarding
// @desc    Mark user's onboarding as complete
// @access  Private
router.post('/complete-onboarding', firebaseAuth, authController.completeOnboarding);

export default router;
