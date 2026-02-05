import { stripe, PRICING_TIERS, TierName } from '../config/stripe';
import { prisma } from '../config/db';
import logger from '../utils/logger';

// Define types locally since the migration hasn't been run
type SubscriptionStatus = 'FREE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'TRIALING';
type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE';

export class BillingService {
  private isAdminBypassEmail(userEmail?: string): boolean {
    const adminEmailsEnv = process.env.ADMIN_EMAILS || '';
    const adminEmails = adminEmailsEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    return Boolean(userEmail && adminEmails.includes(userEmail.toLowerCase()));
  }
  /**
   * Create a Stripe customer for an organization
   */
  async createCustomer(organizationId: string, email: string, name: string) {
    if (!stripe) {
      logger.warn('Stripe not configured, skipping customer creation');
      return null;
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (org?.stripeCustomerId) {
      return org.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        organizationId,
      },
    });

    await prisma.organization.update({
      where: { id: organizationId },
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  /**
   * Create a checkout session for subscription
   */
  async createCheckoutSession(
    organizationId: string,
    tier: 'PRO' | 'ENTERPRISE',
    billingPeriod: 'monthly' | 'yearly',
    successUrl: string,
    cancelUrl: string
  ) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          where: { role: 'OWNER' },
          include: { user: true },
        },
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get or create customer
    let customerId = org.stripeCustomerId;
    if (!customerId) {
      const ownerEmail = org.members[0]?.user?.email || 'unknown@example.com';
      customerId = await this.createCustomer(organizationId, ownerEmail, org.name);
    }

    const tierConfig = PRICING_TIERS[tier];
    const priceId = billingPeriod === 'monthly' 
      ? tierConfig.stripePriceIdMonthly 
      : tierConfig.stripePriceIdYearly;

    if (!priceId) {
      throw new Error(`Price ID not configured for ${tier} ${billingPeriod}`);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId!,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: {
        organizationId,
        tier,
        billingPeriod,
      },
      subscription_data: {
        // 14-day free trial for Pro tier only
        ...(tier === 'PRO' && { trial_period_days: 14 }),
        metadata: {
          organizationId,
          tier,
        },
      },
      // Enable automatic tax calculation if configured
      automatic_tax: { enabled: Boolean(process.env.STRIPE_TAX_ENABLED) },
      // Collect billing address for invoices
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      // Send invoice emails via Stripe
      invoice_creation: {
        enabled: true,
        invoice_data: {
          footer: 'Thank you for choosing SentinelStack!',
        },
      },
    });

    return session;
  }

  /**
   * Create a billing portal session for managing subscription
   */
  async createPortalSession(organizationId: string, returnUrl: string) {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this organization');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripeCustomerId,
      return_url: returnUrl,
    });

    return session;
  }

  /**
   * Handle Stripe webhook events
   */
  async handleWebhookEvent(event: any) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        await this.handleCheckoutComplete(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        await this.handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        await this.handleSubscriptionCanceled(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await this.handlePaymentFailed(invoice);
        break;
      }
      default:
        logger.info(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private async handleCheckoutComplete(session: any) {
    const organizationId = session.metadata?.organizationId;
    const tier = session.metadata?.tier as TierName;

    if (!organizationId) {
      logger.error('No organizationId in checkout session metadata');
      return;
    }

    logger.info(`Checkout completed for org ${organizationId}, tier: ${tier}`);
    
    // Send subscription confirmation email
    try {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        include: {
          members: {
            where: { role: 'OWNER' },
            include: { user: true },
          },
        },
      });
      
      const ownerEmail = org?.members[0]?.user?.email;
      if (ownerEmail && org) {
        const { emailService } = await import('./email.service');
        // Pro tier gets 14-day trial
        const trialDays = tier === 'PRO' ? 14 : undefined;
        await emailService.sendSubscriptionConfirmationEmail(ownerEmail, org.name, tier, trialDays);
      }
    } catch (emailError) {
      logger.error('Failed to send subscription confirmation email:', emailError);
    }
  }

  private async handleSubscriptionUpdate(subscription: any) {
    const organizationId = subscription.metadata?.organizationId;
    
    if (!organizationId) {
      // Try to find by customer ID
      const customer = await prisma.organization.findFirst({
        where: { stripeCustomerId: subscription.customer },
      });
      if (!customer) {
        logger.error('Could not find organization for subscription update');
        return;
      }
    }

    const tier = subscription.metadata?.tier as SubscriptionTier || 'PRO';
    const status = this.mapStripeStatus(subscription.status);

    await prisma.organization.update({
      where: { stripeCustomerId: subscription.customer },
      data: {
        subscriptionId: subscription.id,
        subscriptionStatus: status,
        subscriptionTier: tier,
        subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000),
      },
    });

    logger.info(`Subscription updated for customer ${subscription.customer}: ${tier} - ${status}`);
  }

  private async handleSubscriptionCanceled(subscription: any) {
    const org = await prisma.organization.update({
      where: { stripeCustomerId: subscription.customer },
      data: {
        subscriptionStatus: 'CANCELED',
        subscriptionTier: 'FREE',
        subscriptionId: null,
        subscriptionPeriodEnd: null,
      },
      include: {
        members: {
          where: { role: 'OWNER' },
          include: { user: true },
        },
      },
    });

    logger.info(`Subscription canceled for customer ${subscription.customer}`);
    
    // Send cancellation email
    try {
      const ownerEmail = org.members[0]?.user?.email;
      if (ownerEmail) {
        const { emailService } = await import('./email.service');
        const endDate = new Date(subscription.current_period_end * 1000);
        await emailService.sendSubscriptionCanceledEmail(ownerEmail, org.name, endDate);
      }
    } catch (emailError) {
      logger.error('Failed to send subscription canceled email:', emailError);
    }
  }

  private async handlePaymentFailed(invoice: any) {
    const org = await prisma.organization.update({
      where: { stripeCustomerId: invoice.customer },
      data: {
        subscriptionStatus: 'PAST_DUE',
      },
      include: {
        members: {
          where: { role: 'OWNER' },
          include: { user: true },
        },
      },
    });

    logger.warn(`Payment failed for customer ${invoice.customer}`);
    
    // Send email notification to org owner
    try {
      const ownerEmail = org.members[0]?.user?.email;
      if (ownerEmail) {
        const { emailService } = await import('./email.service');
        await emailService.sendPaymentFailedEmail(
          ownerEmail,
          org.name,
          invoice.amount_due / 100, // Convert cents to dollars
          invoice.hosted_invoice_url // Link to retry payment
        );
      }
    } catch (emailError) {
      logger.error('Failed to send payment failed email:', emailError);
    }
  }

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return 'ACTIVE';
      case 'past_due':
        return 'PAST_DUE';
      case 'canceled':
        return 'CANCELED';
      case 'trialing':
        return 'TRIALING';
      default:
        return 'FREE';
    }
  }

  /**
   * Get subscription details for an organization
   */
  async getSubscription(organizationId: string, userEmail?: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionStatus: true,
        subscriptionTier: true,
        subscriptionPeriodEnd: true,
        scansUsedThisMonth: true,
        scansResetAt: true,
      },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    const tierConfig = PRICING_TIERS[org.subscriptionTier];
    const isBypass = this.isAdminBypassEmail(userEmail);
    const effectiveScansLimit =
      isBypass || tierConfig.limits.scansPerMonth === -1 ? -1 : tierConfig.limits.scansPerMonth;

    const scansRemaining = effectiveScansLimit === -1
      ? 'unlimited'
      : Math.max(0, effectiveScansLimit - org.scansUsedThisMonth);

    return {
      status: org.subscriptionStatus,
      tier: org.subscriptionTier,
      tierName: tierConfig.name,
      periodEnd: org.subscriptionPeriodEnd,
      usage: {
        scansUsed: org.scansUsedThisMonth,
        scansLimit: effectiveScansLimit,
        scansRemaining,
        resetAt: org.scansResetAt,
      },
      limits: tierConfig.limits,
      features: tierConfig.features,
    };
  }

  /**
   * Increment scan usage for an organization
   */
  async incrementScanUsage(organizationId: string) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Check if we need to reset monthly usage
    const now = new Date();
    const resetAt = new Date(org.scansResetAt);
    const monthsSinceReset = (now.getFullYear() - resetAt.getFullYear()) * 12 
      + (now.getMonth() - resetAt.getMonth());

    if (monthsSinceReset >= 1) {
      // Reset usage for new month
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          scansUsedThisMonth: 1,
          scansResetAt: now,
        },
      });
    } else {
      // Increment usage
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          scansUsedThisMonth: { increment: 1 },
        },
      });
    }
  }

  /**
   * Check if organization can perform a scan
   * Admin emails bypass billing restrictions (configured via ADMIN_EMAILS env var)
   */
  async canPerformScan(organizationId: string, userEmail?: string): Promise<{ allowed: boolean; reason?: string }> {
    // Admin bypass - unlimited access for admin accounts (comma-separated in env)
    if (this.isAdminBypassEmail(userEmail)) {
      return { allowed: true };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      return { allowed: false, reason: 'Organization not found' };
    }

    const tierConfig = PRICING_TIERS[org.subscriptionTier];
    
    // Unlimited scans for enterprise
    if (tierConfig.limits.scansPerMonth === -1) {
      return { allowed: true };
    }

    // Check if we need to reset monthly usage
    const now = new Date();
    const resetAt = new Date(org.scansResetAt);
    const monthsSinceReset = (now.getFullYear() - resetAt.getFullYear()) * 12 
      + (now.getMonth() - resetAt.getMonth());

    const currentUsage = monthsSinceReset >= 1 ? 0 : org.scansUsedThisMonth;

    if (currentUsage >= tierConfig.limits.scansPerMonth) {
      return {
        allowed: false,
        reason: `You've used all ${tierConfig.limits.scansPerMonth} scans for this month. Upgrade to get more scans.`,
      };
    }

    return { allowed: true };
  }
}

export const billingService = new BillingService();
