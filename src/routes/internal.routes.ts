import { Router } from 'express';
import { prisma } from '../config/db';
import { internalAuth } from '../middleware/internalAuth';
import { emailService } from '../services/email.service';

const router = Router();

// Internal-only routes used by the PDF rendering pipeline.
// Protected via `PDF_RENDER_SECRET` and `x-internal-secret` header.

// @route   GET /api/internal/assessments/:id/report
// @desc    Get assessment + findings for server-side report rendering
// @access  Internal (secret header)
router.get('/assessments/:id/report', internalAuth, async (req, res, next) => {
  const { id } = req.params;

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: { findings: true },
    });

    if (!assessment) {
      return res.status(404).json({ message: 'Assessment not found.' });
    }

    return res.status(200).json(assessment);
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/internal/test-email
// @desc    Send a test email to verify SMTP configuration
// @access  Internal (secret header)
router.post('/test-email', internalAuth, async (req, res, next) => {
  const { to } = req.body as { to?: string };

  try {
    if (!to || typeof to !== 'string') {
      return res.status(400).json({ message: 'Missing required field: to' });
    }

    const ok = await emailService.sendEmail({
      to,
      subject: 'SentinelStack SMTP Test Email',
      text: 'If you received this email, SMTP is configured correctly.',
      html: '<p>If you received this email, <strong>SMTP is configured correctly</strong>.</p>',
    });

    if (!ok) {
      return res.status(500).json({ message: 'Failed to send test email.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
