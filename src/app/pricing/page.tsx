'use client';

import { useState } from 'react';
import { Check, Zap, Building2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

const tiers = [
  {
    name: 'Free',
    id: 'FREE',
    description: 'Perfect for trying out SentinelStack',
    monthlyPrice: 0,
    yearlyPrice: 0,
    icon: Zap,
    featured: false,
    features: [
      '3 security scans per month',
      'Basic vulnerability reports',
      'Email support',
      '1 team member',
      '7-day scan history',
    ],
    cta: 'Get Started',
  },
  {
    name: 'Pro',
    id: 'PRO',
    description: 'For growing security teams',
    monthlyPrice: 99,
    yearlyPrice: 990,
    icon: Crown,
    featured: true,
    badge: 'Most Popular',
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
    cta: 'Start Pro Trial',
  },
  {
    name: 'Enterprise',
    id: 'ENTERPRISE',
    description: 'For large organizations',
    monthlyPrice: 299,
    yearlyPrice: 2990,
    icon: Building2,
    featured: false,
    features: [
      'Unlimited security scans',
      'Enterprise vulnerability reports',
      'AI-powered risk summaries',
      'Dedicated account manager',
      'Unlimited team members',
      'Unlimited scan history',
      'White-label PDF reports',
      'All integrations',
      'API access',
      'Custom scanning presets',
      'SOC2 compliance reports',
    ],
    cta: 'Contact Sales',
  },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const handleSubscribe = async (tierId: string) => {
    if (tierId === 'FREE') {
      window.location.href = '/signup';
      return;
    }

    if (tierId === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@sentinelstack.io?subject=Enterprise%20Inquiry';
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          tier: tierId,
          billingPeriod,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        // Not logged in, redirect to signup
        window.location.href = '/signup?plan=' + tierId.toLowerCase();
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      window.location.href = '/signup?plan=' + tierId.toLowerCase();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Simple, Transparent{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Pricing
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Choose the plan that fits your security needs. Start free and scale as you grow.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                billingPeriod === 'monthly' ? 'text-white' : 'text-slate-400'
              )}
            >
              Monthly
            </span>
            <button
              onClick={() =>
                setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')
              }
              className="relative w-14 h-7 bg-slate-700 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 bg-cyan-500 rounded-full transition-all',
                  billingPeriod === 'yearly' ? 'left-8' : 'left-1'
                )}
              />
            </button>
            <span
              className={cn(
                'text-sm font-medium transition-colors',
                billingPeriod === 'yearly' ? 'text-white' : 'text-slate-400'
              )}
            >
              Yearly
              <span className="ml-2 text-xs text-cyan-400 font-semibold">Save 17%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid md:grid-cols-3 gap-8">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const price =
              billingPeriod === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice / 12;
            const isPopular = tier.featured;

            return (
              <div
                key={tier.id}
                className={cn(
                  'relative rounded-2xl p-8 transition-all duration-300',
                  isPopular
                    ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/20 border-2 border-cyan-500/50 shadow-xl shadow-cyan-500/10 scale-105'
                    : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                )}
              >
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      isPopular ? 'bg-cyan-500/20' : 'bg-slate-700'
                    )}
                  >
                    <Icon
                      className={cn('w-5 h-5', isPopular ? 'text-cyan-400' : 'text-slate-400')}
                    />
                  </div>
                  <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                </div>

                <p className="text-slate-400 text-sm mb-6">{tier.description}</p>

                <div className="mb-6">
                  <span className="text-4xl font-bold text-white">
                    ${Math.round(price)}
                  </span>
                  {price > 0 && (
                    <span className="text-slate-400 ml-2">/month</span>
                  )}
                  {billingPeriod === 'yearly' && price > 0 && (
                    <p className="text-sm text-slate-500 mt-1">
                      Billed ${tier.yearlyPrice}/year
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleSubscribe(tier.id)}
                  className={cn(
                    'w-full py-3 px-4 rounded-lg font-semibold transition-all mb-8',
                    isPopular
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  )}
                >
                  {tier.cta}
                </button>

                <ul className="space-y-3">
                  {tier.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check
                        className={cn(
                          'w-5 h-5 mt-0.5 flex-shrink-0',
                          isPopular ? 'text-cyan-400' : 'text-slate-500'
                        )}
                      />
                      <span className="text-slate-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Frequently Asked Questions
        </h2>
        <div className="space-y-6">
          {[
            {
              q: 'Can I change plans later?',
              a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
            },
            {
              q: 'What payment methods do you accept?',
              a: 'We accept all major credit cards through our secure payment processor, Stripe.',
            },
            {
              q: 'Is there a free trial?',
              a: 'Yes! Pro plans come with a 14-day free trial. No credit card required to start.',
            },
            {
              q: 'What happens if I exceed my scan limit?',
              a: "You'll receive a notification when you're close to your limit. You can upgrade your plan or wait until your monthly allowance resets.",
            },
            {
              q: 'Can I cancel anytime?',
              a: "Absolutely. You can cancel your subscription at any time and you'll retain access until the end of your billing period.",
            },
          ].map((faq, idx) => (
            <div key={idx} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
              <p className="text-slate-400">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 text-center">
        <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl p-12 border border-cyan-500/20">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to secure your applications?
          </h2>
          <p className="text-slate-400 mb-8">
            Start your free trial today. No credit card required.
          </p>
          <button
            onClick={() => handleSubscribe('PRO')}
            className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold py-3 px-8 rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/25"
          >
            Start Free Trial
          </button>
        </div>
      </div>
    </div>
  );
}
