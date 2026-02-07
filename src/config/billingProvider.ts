export type BillingProvider = 'stripe' | 'razorpay';

export function getBillingProvider(): BillingProvider {
  const raw = (process.env.BILLING_PROVIDER || '').trim().toLowerCase();
  if (raw === 'razorpay') return 'razorpay';
  return 'stripe';
}
