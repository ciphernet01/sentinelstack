import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { billingService } from '../services/billing.service';
import { stripe } from '../config/stripe';
import logger from '../utils/logger';
import type { Request } from 'express';
import { getBillingProvider } from '../config/billingProvider';
import crypto from 'crypto';

export class BillingController {
  /**
   * GET /api/billing/subscription
   * Get current subscription details
   */
  async getSubscription(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const subscription = await billingService.getSubscription(organizationId, req.user?.email);
      res.json(subscription);
    } catch (error: any) {
      logger.error('Error getting subscription:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/billing/checkout
   * Create a checkout session for subscription
   */
  async createCheckout(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;
      const { tier, billingPeriod = 'monthly', currency } = req.body;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      if (!tier || !['PRO', 'ENTERPRISE'].includes(tier)) {
        return res.status(400).json({ error: 'Valid tier required (PRO or ENTERPRISE)' });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const successUrl = `${baseUrl}/dashboard/settings/billing?success=true`;
      const cancelUrl = `${baseUrl}/dashboard/settings/billing?canceled=true`;

      const session = await billingService.createCheckoutSession(
        organizationId,
        tier,
        billingPeriod,
        successUrl,
        cancelUrl,
        currency
      );

      if (session.provider === 'stripe') {
        res.json({ url: session.url, sessionId: session.sessionId, provider: 'stripe' });
        return;
      }

      res.json({
        provider: 'razorpay',
        keyId: session.keyId,
        subscriptionId: session.subscriptionId,
        currency: session.currency,
      });
    } catch (error: any) {
      logger.error('Error creating checkout session:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/billing/portal
   * Create a billing portal session
   */
  async createPortal(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const returnUrl = `${baseUrl}/dashboard/settings/billing`;

      const session = await billingService.createPortalSession(organizationId, returnUrl);

      // Stripe portal returns a URL; Razorpay throws earlier.
      res.json({ url: (session as any).url });
    } catch (error: any) {
      logger.error('Error creating portal session:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/billing/webhook
   * Handle Stripe webhooks
   */
  async handleWebhook(req: Request, res: Response) {
    const provider = getBillingProvider();

    // NOTE: billing.routes.ts uses express.raw(), so req.body is a Buffer.
    const bodyBuffer = req.body as Buffer;
    const bodyString = Buffer.isBuffer(bodyBuffer) ? bodyBuffer.toString('utf8') : String(req.body || '');

    if (provider === 'razorpay') {
      const sig = (req.headers['x-razorpay-signature'] as string | undefined) || '';
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!sig || !secret) {
        return res.status(400).json({ error: 'Missing Razorpay signature or webhook secret' });
      }

      const expected = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
      if (expected !== sig) {
        return res.status(400).json({ error: 'Invalid Razorpay webhook signature' });
      }

      try {
        const payload = JSON.parse(bodyString);
        await billingService.handleWebhookEvent(payload);
        return res.json({ received: true });
      } catch (error: any) {
        logger.error('Razorpay webhook handler error:', error);
        return res.status(500).json({ error: error.message });
      }
    }

    // Stripe
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      logger.error('Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
      await billingService.handleWebhookEvent(event);
      return res.json({ received: true });
    } catch (error: any) {
      logger.error('Webhook handler error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/billing/usage
   * Get current usage stats
   */
  async getUsage(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const subscription = await billingService.getSubscription(organizationId, req.user?.email);
      
      res.json({
        usage: subscription.usage,
        limits: subscription.limits,
      });
    } catch (error: any) {
      logger.error('Error getting usage:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/billing/can-scan
   * Check if organization can perform a scan
   */
  async checkCanScan(req: AuthenticatedRequest, res: Response) {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const result = await billingService.canPerformScan(organizationId, req.user?.email);
      res.json(result);
    } catch (error: any) {
      logger.error('Error checking scan permission:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export const billingController = new BillingController();
