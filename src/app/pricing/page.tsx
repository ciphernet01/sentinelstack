'use client';

import { useState } from 'react';
import { Check, Zap, Building2, Crown, ArrowRight, Shield, Clock, CreditCard, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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
    cta: 'Get Started Free',
    ctaLink: '/signup',
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
    cta: 'Start 14-Day Free Trial',
    ctaLink: null,
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
    ctaLink: 'mailto:sales@sentinelstack.io?subject=Enterprise%20Inquiry',
  },
];

const faqs = [
  {
    q: 'Can I change plans later?',
    a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
  },
  {
    q: 'What payment methods do you accept?',
    a: 'We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.',
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
  {
    q: 'Do you offer refunds?',
    a: "We offer a 30-day money-back guarantee. If you're not satisfied, contact our support team for a full refund.",
  },
];

const trustBadges = [
  { icon: Shield, text: 'SOC 2 Compliant' },
  { icon: CreditCard, text: 'Secure Payments' },
  { icon: Clock, text: '99.9% Uptime SLA' },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleSubscribe = async (tierId: string) => {
    if (tierId === 'FREE') {
      window.location.href = '/signup';
      return;
    }

    if (tierId === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@sentinelstack.io?subject=Enterprise%20Inquiry';
      return;
    }

    setIsLoading(tierId);

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
        window.location.href = '/signup?plan=' + tierId.toLowerCase();
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      window.location.href = '/signup?plan=' + tierId.toLowerCase();
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-cyan-400" />
            <span className="text-xl font-bold text-white">SentinelStack</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-slate-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link 
              href="/signup" 
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-2 mb-6">
            <span className="text-cyan-400 text-sm font-medium">Simple, Transparent Pricing</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            Secure Your Apps at{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Any Scale
            </span>
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Choose the plan that fits your security needs. Start free and scale as you grow.
            All plans include our core security assessment features.
          </p>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 mb-12">
            {trustBadges.map((badge, idx) => (
              <div key={idx} className="flex items-center gap-2 text-slate-400">
                <badge.icon className="w-5 h-5 text-cyan-400" />
                <span className="text-sm">{badge.text}</span>
              </div>
            ))}
          </div>

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
              aria-label="Toggle billing period"
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all shadow-lg',
                  billingPeriod === 'yearly' ? 'left-8' : 'left-1'
                )}
              />
            </button>
            <span
              className={cn(
                'text-sm font-medium transition-colors flex items-center gap-2',
                billingPeriod === 'yearly' ? 'text-white' : 'text-slate-400'
              )}
            >
              Yearly
              <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                Save 17%
              </span>
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
            const loading = isLoading === tier.id;

            return (
              <div
                key={tier.id}
                className={cn(
                  'relative rounded-2xl p-8 transition-all duration-300',
                  isPopular
                    ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/20 border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 scale-105 z-10'
                    : 'bg-slate-800/50 border border-slate-700 hover:border-slate-600'
                )}
              >
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold px-4 py-1 rounded-full shadow-lg">
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center',
                      isPopular ? 'bg-cyan-500/20' : 'bg-slate-700'
                    )}
                  >
                    <Icon
                      className={cn('w-6 h-6', isPopular ? 'text-cyan-400' : 'text-slate-400')}
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-white">{tier.name}</h3>
                </div>

                <p className="text-slate-400 text-sm mb-6">{tier.description}</p>

                <div className="mb-6">
                  <div className="flex items-baseline">
                    <span className="text-5xl font-bold text-white">
                      ${Math.round(price)}
                    </span>
                    {price > 0 && (
                      <span className="text-slate-400 ml-2 text-lg">/month</span>
                    )}
                  </div>
                  {billingPeriod === 'yearly' && price > 0 && (
                    <p className="text-sm text-slate-500 mt-2">
                      Billed ${tier.yearlyPrice}/year
                    </p>
                  )}
                  {price === 0 && (
                    <p className="text-sm text-slate-500 mt-2">
                      Free forever
                    </p>
                  )}
                </div>

                <button
                  onClick={() => handleSubscribe(tier.id)}
                  disabled={loading}
                  className={cn(
                    'w-full py-3.5 px-4 rounded-xl font-semibold transition-all mb-8 flex items-center justify-center gap-2',
                    isPopular
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600 shadow-lg shadow-cyan-500/25'
                      : 'bg-slate-700 text-white hover:bg-slate-600',
                    loading && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {loading ? (
                    <span className="animate-pulse">Processing...</span>
                  ) : (
                    <>
                      {tier.cta}
                      {isPopular && <ArrowRight className="w-4 h-4" />}
                    </>
                  )}
                </button>

                <ul className="space-y-4">
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

      {/* Comparison Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Compare Plans</h2>
          <p className="text-slate-400 max-w-xl mx-auto">
            All plans include access to our security scanner. Here's how they compare.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-4 px-4 text-slate-400 font-medium">Feature</th>
                <th className="text-center py-4 px-4 text-white font-semibold">Free</th>
                <th className="text-center py-4 px-4 text-cyan-400 font-semibold">Pro</th>
                <th className="text-center py-4 px-4 text-white font-semibold">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {[
                { feature: 'Monthly Scans', free: '3', pro: '50', enterprise: 'Unlimited' },
                { feature: 'Team Members', free: '1', pro: '5', enterprise: 'Unlimited' },
                { feature: 'Scan History', free: '7 days', pro: '90 days', enterprise: 'Unlimited' },
                { feature: 'AI Risk Summaries', free: '—', pro: '✓', enterprise: '✓' },
                { feature: 'PDF Reports', free: '—', pro: '✓', enterprise: '✓' },
                { feature: 'White-label Reports', free: '—', pro: '—', enterprise: '✓' },
                { feature: 'API Access', free: '—', pro: '—', enterprise: '✓' },
                { feature: 'Slack/Webhook', free: '—', pro: '✓', enterprise: '✓' },
                { feature: 'Custom Presets', free: '—', pro: '—', enterprise: '✓' },
                { feature: 'SOC2 Reports', free: '—', pro: '—', enterprise: '✓' },
                { feature: 'Support', free: 'Email', pro: 'Priority', enterprise: 'Dedicated Manager' },
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-4 px-4 text-slate-300">{row.feature}</td>
                  <td className="text-center py-4 px-4 text-slate-400">{row.free}</td>
                  <td className="text-center py-4 px-4 text-cyan-400">{row.pro}</td>
                  <td className="text-center py-4 px-4 text-slate-300">{row.enterprise}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400">
            Have a question? We're here to help.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {faqs.map((faq, idx) => (
            <div key={idx} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-colors">
              <div className="flex gap-3 mb-3">
                <HelpCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                <h3 className="text-lg font-semibold text-white">{faq.q}</h3>
              </div>
              <p className="text-slate-400 pl-8">{faq.a}</p>
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
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">
            Join 500+ security teams who trust SentinelStack for comprehensive vulnerability assessments.
            Start your free trial today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleSubscribe('PRO')}
              className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold py-3.5 px-8 rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all shadow-lg shadow-cyan-500/25 flex items-center gap-2"
            >
              Start 14-Day Free Trial <ArrowRight className="w-4 h-4" />
            </button>
            <Link
              href="/signup"
              className="text-slate-300 hover:text-white font-medium py-3 px-6 transition-colors"
            >
              Or start free →
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-6">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-cyan-400" />
              <span className="text-lg font-bold text-white">SentinelStack</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="mailto:support@sentinelstack.io" className="hover:text-white transition-colors">Contact</Link>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} SentinelStack. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
