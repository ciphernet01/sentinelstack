import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy | SentinelStack',
  description: 'Learn how SentinelStack collects, uses, and protects your personal information.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Navigation */}
      <nav className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </nav>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-10 w-10 text-cyan-400" />
          <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
        </div>
        
        <p className="text-slate-400 mb-8">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="prose prose-invert prose-slate max-w-none">
          <div className="space-y-8">
            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
              <p className="text-slate-400">
                SentinelStack ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our security assessment platform and related services (collectively, the "Service").
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">2. Information We Collect</h2>
              <div className="text-slate-400 space-y-4">
                <div>
                  <h3 className="text-white font-medium mb-2">Personal Information</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Name and email address when you create an account</li>
                    <li>Billing information when you subscribe to paid plans</li>
                    <li>Company information for enterprise accounts</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-2">Usage Information</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Security scan targets and configurations</li>
                    <li>Scan results and vulnerability reports</li>
                    <li>Log data including IP addresses and browser information</li>
                  </ul>
                </div>
              </div>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
              <ul className="text-slate-400 list-disc list-inside space-y-2">
                <li>To provide and maintain our security assessment Service</li>
                <li>To process transactions and send related information</li>
                <li>To send administrative messages, updates, and security alerts</li>
                <li>To respond to customer service requests and support needs</li>
                <li>To improve our Service and develop new features</li>
                <li>To detect, prevent, and address technical issues or security threats</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">4. Data Security</h2>
              <p className="text-slate-400">
                We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption in transit (TLS) and at rest, regular security audits, and access controls. However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">5. Data Retention</h2>
              <p className="text-slate-400">
                We retain your personal information for as long as your account is active or as needed to provide you services. Scan history is retained according to your subscription plan limits. You can request deletion of your data at any time by contacting support.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">6. Third-Party Services</h2>
              <p className="text-slate-400 mb-4">
                We use trusted third-party services to operate our platform:
              </p>
              <ul className="text-slate-400 list-disc list-inside space-y-2">
                <li><strong className="text-white">Stripe</strong> - Payment processing</li>
                <li><strong className="text-white">Resend</strong> - Transactional emails</li>
                <li><strong className="text-white">Google Cloud / Render</strong> - Infrastructure hosting</li>
              </ul>
              <p className="text-slate-400 mt-4">
                These providers have their own privacy policies governing the use of your information.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">7. Your Rights</h2>
              <p className="text-slate-400 mb-4">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="text-slate-400 list-disc list-inside space-y-2">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing</li>
                <li>Data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">8. Cookies</h2>
              <p className="text-slate-400">
                We use essential cookies to maintain your session and preferences. We do not use tracking cookies for advertising purposes. You can configure your browser to refuse cookies, but some features may not function properly.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">9. Changes to This Policy</h2>
              <p className="text-slate-400">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. Continued use of the Service after changes constitutes acceptance of the updated policy.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">10. Contact Us</h2>
              <p className="text-slate-400">
                If you have any questions about this Privacy Policy, please contact us at:
              </p>
              <p className="text-cyan-400 mt-2">
                <a href="mailto:privacy@sentinel-stack.tech" className="hover:underline">privacy@sentinel-stack.tech</a>
              </p>
            </section>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              <span className="font-bold text-white">SentinelStack</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} SentinelStack
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
