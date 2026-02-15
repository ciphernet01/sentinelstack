'use client';

import { useState } from 'react';
import { Check, Zap, Building2, Crown, ArrowRight, Shield, Clock, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
  },
  {
    name: 'Pro',
    id: 'PRO',
    description: 'For growing Indian SaaS teams (launch offer)',
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
    a: 'We support secure payments via Razorpay (cards, UPI, netbanking) and Stripe (cards) depending on your region.',
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
  { icon: Clock, text: 'Queue-backed reliability' },
];

export default function PricingPage() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const inferredCurrency: 'INR' | 'USD' = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Kolkata' ? 'INR' : 'USD';
    } catch {
      return 'USD';
    }
  })();

  const showLaunchOffer = inferredCurrency === 'INR' && billingPeriod === 'monthly';

  const handleSubscribe = async (tierId: string) => {
    if (tierId === 'FREE') {
      window.location.href = '/signup';
      return;
    }

    if (tierId === 'ENTERPRISE') {
      window.location.href = 'mailto:sales@sentinel-stack.tech?subject=Enterprise%20Inquiry';
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
          currency: inferredCurrency,
        }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      if (data.provider === 'razorpay' && data.keyId && data.subscriptionId) {
        const loadRazorpay = () =>
          new Promise<void>((resolve, reject) => {
            if ((window as any).Razorpay) return resolve();
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load Razorpay Checkout'));
            document.body.appendChild(script);
          });

        await loadRazorpay();

        const options = {
          key: data.keyId,
          subscription_id: data.subscriptionId,
          name: 'SentinelStack',
          description: `${tierId} subscription`,
          handler: () => {
            window.location.href = '/dashboard/settings/billing?success=true';
          },
        };

        const RazorpayCtor = (window as any).Razorpay;
        const rzp = new RazorpayCtor(options);
        rzp.open();
        return;
      }

      window.location.href = '/signup?plan=' + tierId.toLowerCase();
    } catch (error) {
      console.error('Error creating checkout:', error);
      window.location.href = '/signup?plan=' + tierId.toLowerCase();
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 pt-24">
        {/* Hero Section */}
        <section className="w-full py-16 md:py-24 bg-card">
          <div className="container px-4 md:px-6 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground mb-6">
              <Shield className="h-4 w-4 text-primary" />
              Simple, Transparent Pricing
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter font-headline mb-6">
              Security Compliance Pricing (India-ready)
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
              Start free, then upgrade when you need audit-ready reporting for customers and compliance.
            </p>

            {showLaunchOffer && (
              <div className="mx-auto mb-8 max-w-2xl rounded-xl border bg-background px-4 py-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Launch offer:</span> Pro is <span className="font-medium text-foreground">₹1999/month</span> for the first 50 customers (normally ₹2999/month).
              </div>
            )}

            <div className="flex flex-wrap items-center justify-center gap-6 mb-12 text-muted-foreground">
              {trustBadges.map((badge, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <badge.icon className="w-4 h-4 text-primary" />
                  <span className="text-sm">{badge.text}</span>
                </div>
              ))}
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-2">
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
                aria-label="Toggle billing period"
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

                const baseMonthlyUsd = tier.monthlyPrice;
                const baseYearlyUsd = tier.yearlyPrice;

                const proLaunchMonthlyInr = 1999;
                const proNormalMonthlyInr = 2999;
                const proYearlyInr = 0; // not advertised in this launch copy

                const enterpriseMonthlyInr = 0; // shown as Contact Sales

                const isInr = inferredCurrency === 'INR';

                const computed = (() => {
                  if (tier.id === 'FREE') return { display: '₹0', billedLine: '' };
                  if (tier.id === 'ENTERPRISE') return { display: 'Custom', billedLine: '' };

                  // PRO
                  if (isInr && billingPeriod === 'monthly') {
                    return {
                      display: showLaunchOffer ? `₹${proLaunchMonthlyInr}` : `₹${proNormalMonthlyInr}`,
                      billedLine: showLaunchOffer ? `Normally ₹${proNormalMonthlyInr}/month` : '',
                    };
                  }

                  if (isInr && billingPeriod === 'yearly' && proYearlyInr > 0) {
                    return { display: `₹${Math.round(proYearlyInr / 12)}`, billedLine: `Billed ₹${proYearlyInr}/year` };
                  }

                  // USD fallback
                  const price = billingPeriod === 'monthly' ? baseMonthlyUsd : baseYearlyUsd / 12;
                  const billedLine = billingPeriod === 'yearly' && price > 0 ? `Billed $${baseYearlyUsd}/year` : '';
                  return { display: `$${Math.round(price)}`, billedLine };
                })();
                const isPopular = tier.featured;
                const loading = isLoading === tier.id;

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
                      <span className="text-4xl font-bold">{computed.display}</span>
                      {tier.id !== 'FREE' && tier.id !== 'ENTERPRISE' && <span className="text-muted-foreground ml-2">/month</span>}
                      {computed.billedLine && (
                        <p className="text-sm text-muted-foreground mt-1">{computed.billedLine}</p>
                      )}
                    </div>

                    <Button
                      onClick={() => handleSubscribe(tier.id)}
                      disabled={loading}
                      className={cn(
                        'w-full mb-8',
                        isPopular ? '' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      )}
                      variant={isPopular ? 'default' : 'secondary'}
                    >
                      {loading ? 'Processing…' : tier.cta}
                      {!loading && isPopular && <ArrowRight className="ml-2 h-4 w-4" />}
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

        {/* Comparison */}
        <section className="w-full py-16 md:py-24 bg-card">
          <div className="container px-4 md:px-6">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold tracking-tighter font-headline mb-3">Compare Plans</h2>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  All plans include access to our security scanner. Here’s how they compare.
                </p>
              </div>

              <Card className="p-2 md:p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Feature</TableHead>
                      <TableHead className="text-center">Free</TableHead>
                      <TableHead className="text-center">Pro</TableHead>
                      <TableHead className="text-center">Enterprise</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { feature: 'Monthly Scans', free: '3', pro: '50', enterprise: 'Unlimited' },
                      { feature: 'Team Members', free: '1', pro: 'Up to 5', enterprise: 'Unlimited' },
                      { feature: 'Scan History', free: '7 days', pro: '90 days', enterprise: 'Unlimited' },
                      { feature: 'AI Risk Summaries', free: '—', pro: '✓', enterprise: '✓' },
                      { feature: 'PDF Reports', free: '—', pro: '✓', enterprise: '✓' },
                      { feature: 'White-label Reports', free: '—', pro: '—', enterprise: '✓' },
                      { feature: 'API Access', free: '—', pro: '—', enterprise: '✓' },
                      { feature: 'Slack Notifications', free: '—', pro: '✓', enterprise: '✓' },
                      { feature: 'Custom Presets', free: '—', pro: '—', enterprise: '✓' },
                      { feature: 'SOC2 Reports', free: '—', pro: '—', enterprise: '✓' },
                      { feature: 'Support', free: 'Email', pro: 'Priority', enterprise: 'Dedicated manager' },
                    ].map((row) => (
                      <TableRow key={row.feature}>
                        <TableCell className="font-medium">{row.feature}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{row.free}</TableCell>
                        <TableCell className="text-center">{row.pro}</TableCell>
                        <TableCell className="text-center">{row.enterprise}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full py-16 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-bold tracking-tighter font-headline mb-3">
                  Frequently Asked Questions
                </h2>
                <p className="text-muted-foreground">Have a question? We’re here to help.</p>
              </div>

              <Card className="p-6">
                <Accordion type="single" collapsible className="w-full">
                  {faqs.map((faq) => (
                    <AccordionItem key={faq.q} value={faq.q}>
                      <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA */}
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
                Start 14-Day Free Trial <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10"
              >
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
