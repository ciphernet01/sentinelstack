import { Metadata } from 'next';
import Link from 'next/link';
import { Shield } from 'lucide-react';

import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: 'Privacy Policy | SentinelStack',
  description: 'Learn how SentinelStack collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
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
                    Privacy Policy
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
                  This policy explains what we collect, why we collect it, and how you can control your data.
                </p>
                <p className="mt-4 text-sm">
                  <Link href="/" className="hover:underline underline-offset-4">
                    Back to home
                  </Link>
                </p>
              </div>

              <div className="space-y-6">
                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
                  <p className="text-muted-foreground">
                    SentinelStack (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our security assessment platform and related services (collectively, the &quot;Service&quot;).
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
                  <div className="space-y-4 text-muted-foreground">
                    <div>
                      <h3 className="font-medium text-foreground mb-1">Personal Information</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Name and email address when you create an account</li>
                        <li>Billing information when you subscribe to paid plans</li>
                        <li>Company information for enterprise accounts</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground mb-1">Usage Information</h3>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>Security scan targets and configurations</li>
                        <li>Scan results and vulnerability reports</li>
                        <li>Log data including IP addresses and browser information</li>
                      </ul>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-2">
                    <li>To provide and maintain our security assessment Service</li>
                    <li>To process transactions and send related information</li>
                    <li>To send administrative messages, updates, and security alerts</li>
                    <li>To respond to customer service requests and support needs</li>
                    <li>To improve our Service and develop new features</li>
                    <li>To detect, prevent, and address technical issues or security threats</li>
                  </ul>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">4. Data Security</h2>
                  <p className="text-muted-foreground">
                    We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption in transit (TLS) and at rest, regular security audits, and access controls. However, no method of transmission over the Internet is 100% secure.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">5. Data Retention</h2>
                  <p className="text-muted-foreground">
                    We retain your personal information for as long as your account is active or as needed to provide you services. Scan history is retained according to your subscription plan limits. You can request deletion of your data at any time by contacting support.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">6. Third-Party Services</h2>
                  <p className="text-muted-foreground mb-3">
                    We use trusted third-party services to operate our platform:
                  </p>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-2">
                    <li>
                      <span className="font-medium text-foreground">Stripe</span> — payment processing
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Resend</span> — transactional emails
                    </li>
                    <li>
                      <span className="font-medium text-foreground">Google Cloud / Render</span> — infrastructure hosting
                    </li>
                  </ul>
                  <p className="text-muted-foreground mt-3">
                    These providers have their own privacy policies governing the use of your information.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">7. Your Rights</h2>
                  <p className="text-muted-foreground mb-3">
                    Depending on your location, you may have the following rights:
                  </p>
                  <ul className="text-muted-foreground list-disc pl-5 space-y-2">
                    <li>Access your personal data</li>
                    <li>Correct inaccurate data</li>
                    <li>Request deletion of your data</li>
                    <li>Object to or restrict processing</li>
                    <li>Data portability</li>
                    <li>Withdraw consent at any time</li>
                  </ul>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">8. Cookies</h2>
                  <p className="text-muted-foreground">
                    We use essential cookies to maintain your session and preferences. We do not use tracking cookies for advertising purposes. You can configure your browser to refuse cookies, but some features may not function properly.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">9. Changes to This Policy</h2>
                  <p className="text-muted-foreground">
                    We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. Continued use of the Service after changes constitutes acceptance of the updated policy.
                  </p>
                </Card>

                <Card className="p-6">
                  <h2 className="text-lg font-semibold mb-2">10. Contact Us</h2>
                  <p className="text-muted-foreground">
                    If you have any questions about this Privacy Policy, please contact us at{' '}
                    <a href="mailto:privacy@sentinel-stack.tech" className="underline underline-offset-4">
                      privacy@sentinel-stack.tech
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
