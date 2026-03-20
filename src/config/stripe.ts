import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn('Warning: STRIPE_SECRET_KEY not set. Stripe functionality will be disabled.');
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    })
  : null;

// Pricing configuration
export const PRICING_TIERS = {
  FREE: {
    name: 'Free',
    description: 'Perfect for trying out SentinelStack',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      '3 security scans per month',
      'Basic vulnerability reports',
      'Email support',
      '1 team member',
      '7-day scan history',
    ],
    limits: {
      scansPerMonth: 3,
      teamMembers: 1,
      historyDays: 7,
      apiAccess: false,
      customBranding: false,
      prioritySupport: false,
      scheduledScans: false,
    },
    stripePriceIdMonthly: null,
    stripePriceIdYearly: null,
  },
  PRO: {
    name: 'Pro',
    description: 'For growing security teams',
    monthlyPrice: 99,
    yearlyPrice: 990, // 2 months free
    features: [
      '50 security scans per month',
      'Advanced vulnerability reports',
      'AI-powered risk summaries',
      'Priority email support',
      'Up to 5 team members',
      '90-day scan history',
      'PDF report exports',
      'Slack notifications',
    ],
    limits: {
      scansPerMonth: 50,
      teamMembers: 5,
      historyDays: 90,
      apiAccess: false,
      customBranding: false,
      prioritySupport: true,
      scheduledScans: true,
    },
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || null,
    stripePriceIdYearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || null,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    description: 'For large organizations with advanced needs',
    monthlyPrice: 299,
    yearlyPrice: 2990, // 2 months free
    features: [
      'Unlimited security scans',
      'Enterprise vulnerability reports',
      'AI-powered risk summaries',
      'Dedicated account manager',
      'Unlimited team members',
      'Unlimited scan history',
      'White-label PDF reports',
      'All integrations (Slack, Jira, etc.)',
      'API access',
      'Custom scanning presets',
      'SOC2 compliance reports',
      'SSO/SAML (coming soon)',
    ],
    limits: {
      scansPerMonth: -1, // Unlimited
      teamMembers: -1, // Unlimited
      historyDays: -1, // Unlimited
      apiAccess: true,
      customBranding: true,
      prioritySupport: true,
      scheduledScans: true,
    },
    stripePriceIdMonthly: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID || null,
    stripePriceIdYearly: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID || null,
  },
} as const;

export type TierName = keyof typeof PRICING_TIERS;

export function getTierLimits(tier: TierName) {
  return PRICING_TIERS[tier].limits;
}

export function canPerformScan(tier: TierName, scansUsedThisMonth: number): boolean {
  const limits = getTierLimits(tier);
  if (limits.scansPerMonth === -1) return true; // Unlimited
  return scansUsedThisMonth < limits.scansPerMonth;
}

export function getScansRemaining(tier: TierName, scansUsedThisMonth: number): number | 'unlimited' {
  const limits = getTierLimits(tier);
  if (limits.scansPerMonth === -1) return 'unlimited';
  return Math.max(0, limits.scansPerMonth - scansUsedThisMonth);
}
