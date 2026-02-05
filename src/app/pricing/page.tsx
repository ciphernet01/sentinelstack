'use client';

import { useState } from 'react';
import { Check, Zap, Building2, Crown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
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

const faqs = [
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
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-16 md:py-24 bg-card">
          <div className="container px-4 md:px-6 text-center">
            <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-sm text-secondary-foreground mb-6">
              Simple, Transparent Pricing
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter font-headline mb-6">
              Choose Your Security Plan
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Start free and scale as you grow. All plans include our core security assessment features.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  billingPeriod === 'monthly' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Monthly
              </span>
              <button
                onClick={() =>
                  setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')
                }
                className="relative w-14 h-7 bg-secondary rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
              >
                <span
                  className={cn(
                    'absolute top-1 w-5 h-5 bg-primary rounded-full transition-all',
                    billingPeriod === 'yearly' ? 'left-8' : 'left-1'
                  )}
                />
              </button>
              <span
                className={cn(
                  'text-sm font-medium transition-colors',
                  billingPeriod === 'yearly' ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                Yearly
                <span className="ml-2 text-xs text-primary font-semibold">Save 17%</span>
              </span>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="w-full py-12 md:py-20">
          <div className="container px-4 md:px-6">
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {tiers.map((tier) => {
                const Icon = tier.icon;
                const price =
                  billingPeriod === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice / 12;
                const isPopular = tier.featured;

                return (
                  <div
                    key={tier.id}
                    className={cn(
                      'relative rounded-2xl p-8 transition-all duration-300 border',
                      isPopular
                        ? 'bg-card border-2 border-primary shadow-xl shadow-primary/10 scale-105'
                        : 'bg-card border-border hover:border-primary/50'
                    )}
                  >
                    {tier.badge && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <span className="bg-primary text-primary-foreground text-sm font-semibold px-4 py-1 rounded-full">
                          {tier.badge}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center',
                          isPopular ? 'bg-primary/20' : 'bg-secondary'
                        )}
                      >
                        <Icon
                          className={cn('w-5 h-5', isPopular ? 'text-primary' : 'text-muted-foreground')}
                        />
                      </div>
                      <h3 className="text-xl font-bold font-headline">{tier.name}</h3>
                    </div>

                    <p className="text-muted-foreground text-sm mb-6">{tier.description}</p>

                    <div className="mb-6">
                      <span className="text-4xl font-bold">
                        ${Math.round(price)}
                      </span>
                      {price > 0 && (
                        <span className="text-muted-foreground ml-2">/month</span>
                      )}
                      {billingPeriod === 'yearly' && price > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Billed ${tier.yearlyPrice}/year
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => handleSubscribe(tier.id)}
                      className={cn(
                        'w-full mb-8',
                        isPopular
                          ? ''
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      )}
                      variant={isPopular ? 'default' : 'secondary'}
                    >
                      {tier.cta}
                    </Button>

                    <ul className="space-y-3">
                      {tier.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                          <Check
                            className={cn(
                              'w-5 h-5 mt-0.5 flex-shrink-0',
                              isPopular ? 'text-primary' : 'text-muted-foreground'
                            )}
                          />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="w-full py-16 md:py-24 bg-card">
          <div className="container px-4 md:px-6 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold font-headline text-center mb-12">
              Frequently Asked Questions
            </h2>
            <div className="space-y-6">
              {faqs.map((faq, idx) => (
                <div key={idx} className="bg-background rounded-xl p-6 border border-border">
                  <h3 className="text-lg font-semibold mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-20 md:py-32 bg-gradient-to-r from-blue-600 to-indigo-800 text-primary-foreground">
          <div className="container flex flex-col items-center gap-6 px-4 text-center md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">
              Ready to secure your applications?
            </h2>
            <p className="max-w-[600px] text-primary-foreground/80">
              Start your free trial today. No credit card required.
            </p>
            <div className="flex flex-col gap-4 min-[400px]:flex-row">
              <Button
                onClick={() => handleSubscribe('PRO')}
                variant="outline"
                size="lg"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                Start Pro Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button asChild variant="outline" size="lg" className="border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10">
                <Link href="/signup">Get Started Free</Link>
              </Button>
            </div>
            <p className="text-xs text-primary-foreground/70">
              No credit card required • 14-day free trial • Cancel anytime
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
