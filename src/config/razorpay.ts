import Razorpay from 'razorpay';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || !keySecret) {
  // Keep startup non-fatal: billing provider might be Stripe or disabled.
  // Missing keys will be handled at call sites.
  // eslint-disable-next-line no-console
  console.warn('Warning: RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET not set. Razorpay functionality will be disabled.');
}

export const razorpay = keyId && keySecret ? new Razorpay({ key_id: keyId, key_secret: keySecret }) : null;

export type SupportedCurrency = 'INR' | 'USD';

export const DEFAULT_CURRENCY: SupportedCurrency =
  (process.env.BILLING_DEFAULT_CURRENCY || '').toUpperCase() === 'USD' ? 'USD' : 'INR';

type Tier = 'PRO' | 'ENTERPRISE';

export function getRazorpayPlanId(params: { tier: Tier; billingPeriod: 'monthly' | 'yearly'; currency: SupportedCurrency }): string {
  const { tier, billingPeriod, currency } = params;

  const key = `RAZORPAY_${tier}_${currency}_${billingPeriod.toUpperCase()}_PLAN_ID`;
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing Razorpay plan id env var: ${key}`);
  }
  return value;
}

export function getRazorpayCheckoutKeyId(): string {
  if (!process.env.RAZORPAY_KEY_ID) throw new Error('RAZORPAY_KEY_ID not set');
  return process.env.RAZORPAY_KEY_ID;
}
