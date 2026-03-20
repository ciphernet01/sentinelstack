import { Metadata } from 'next';
import Link from 'next/link';
import { Shield } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Terms of Service | SentinelStack',
  description: 'Read the terms and conditions for using SentinelStack security assessment platform.',
};

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 pt-24">
        <section className="w-full py-10 md:py-16">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-4xl">
              <div className="mb-10">
                <div className="flex items-center gap-3">
                  <Shield className="h-8 w-8 text-primary" />
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tighter font-headline">
                    Terms of Service
                  </h1>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Last updated:{' '}
                  {new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="mt-4 text-muted-foreground">
                  These terms govern your use of Sentinel Stack. Please read them carefully.
                </p>
                <p className="mt-4 text-sm">
                  <Link href="/" className="hover:underline underline-offset-4">
                    Back to home
                  </Link>
                </p>
              </div>

              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">1. Acceptance of Terms</h2>
                  <p className="text-muted-foreground">
                    By accessing or using SentinelStack (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service. These terms apply to all users, including visitors, registered users, and paying customers.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">2. Description of Service</h2>
                  <p className="text-muted-foreground">
                    SentinelStack provides automated security assessment tools, vulnerability scanning, and reporting services for web applications and APIs. Our Service includes AI-powered risk analysis, PDF report generation, and integration capabilities as described in our feature documentation.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">3. Acceptable Use</h2>
                  <p className="text-muted-foreground mb-3">
                    You agree to use SentinelStack only for lawful purposes. Specifically, you agree to:
                  </p>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-2">
                    <li>Only scan systems and applications you own or have explicit written authorization to test</li>
                    <li>Not use the Service for any malicious purposes or to cause harm to others</li>
                    <li>Not attempt to circumvent usage limits or security measures</li>
                    <li>Not reverse engineer, decompile, or attempt to extract the source code of our tools</li>
                    <li>Comply with all applicable local, state, national, and international laws</li>
                  </ul>
                  <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">
                      Unauthorized security testing of systems you do not own is illegal. Always obtain proper authorization before scanning.
                    </p>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">4. Account Responsibilities</h2>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-2">
                    <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                    <li>You must provide accurate and complete information during registration</li>
                    <li>You are responsible for all activities that occur under your account</li>
                    <li>You must notify us immediately of any unauthorized use of your account</li>
                    <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
                  </ul>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">5. Subscription and Billing</h2>
                  <div className="space-y-3 text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">Plans:</span> We offer Free, Pro, and Enterprise subscription plans with varying features and limits as described on our pricing page.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Billing:</span> Paid subscriptions are billed in advance on a monthly or annual basis. All fees are non-refundable except as specified in our refund policy.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Trial:</span> Pro plans include a 14-day free trial. No credit card is required to start your trial.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Cancellation:</span> You may cancel your subscription at any time. You will retain access until the end of your billing period.
                    </p>
                    <p>
                      <span className="font-medium text-foreground">Refunds:</span> We offer a 30-day money-back guarantee for first-time subscribers. Contact support for refund requests.
                    </p>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">6. Intellectual Property</h2>
                  <p className="text-muted-foreground">
                    The Service, including all content, features, and functionality, is owned by SentinelStack and protected by international copyright, trademark, and other intellectual property laws. You retain ownership of your scan data and results, which you may export at any time.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">7. Data and Privacy</h2>
                  <p className="text-muted-foreground">
                    Your use of the Service is subject to our Privacy Policy, which describes how we collect, use, and protect your information. You acknowledge that you have read and understood our Privacy Policy.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">8. Disclaimer of Warranties</h2>
                  <p className="text-muted-foreground">
                    THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL IDENTIFY ALL SECURITY VULNERABILITIES OR THAT YOUR SYSTEMS WILL BE SECURE AFTER USING OUR SERVICE. Security is an ongoing process, and our scans provide point-in-time assessments only.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">9. Limitation of Liability</h2>
                  <p className="text-muted-foreground">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, SENTINELSTACK SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">10. Indemnification</h2>
                  <p className="text-muted-foreground">
                    You agree to indemnify and hold harmless SentinelStack and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any rights of another party.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">11. Service Level Agreement</h2>
                  <p className="text-muted-foreground">
                    Enterprise customers are eligible for our 99.9% uptime SLA. Details and credits for downtime are specified in your Enterprise agreement. Free and Pro plans are provided on a best-effort basis with no uptime guarantees.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">12. Changes to Terms</h2>
                  <p className="text-muted-foreground">
                    We reserve the right to modify these Terms at any time. We will notify you of material changes by email or through the Service. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">13. Governing Law</h2>
                  <p className="text-muted-foreground">
                    These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved in the courts of Delaware.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">14. Contact Information</h2>
                  <p className="text-muted-foreground">
                    For questions about these Terms of Service, please contact us at{' '}
                    <a href="mailto:legal@sentinel-stack.tech" className="underline underline-offset-4">
                      legal@sentinel-stack.tech
                    </a>
                    .
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
