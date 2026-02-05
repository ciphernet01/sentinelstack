import { Metadata } from 'next';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms of Service | SentinelStack',
  description: 'Read the terms and conditions for using SentinelStack security assessment platform.',
};

export default function TermsOfServicePage() {
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
          <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
        </div>
        
        <p className="text-slate-400 mb-8">
          Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        <div className="prose prose-invert prose-slate max-w-none">
          <div className="space-y-8">
            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-slate-400">
                By accessing or using SentinelStack ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our Service. These terms apply to all users, including visitors, registered users, and paying customers.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">2. Description of Service</h2>
              <p className="text-slate-400">
                SentinelStack provides automated security assessment tools, vulnerability scanning, and reporting services for web applications and APIs. Our Service includes AI-powered risk analysis, PDF report generation, and integration capabilities as described in our feature documentation.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">3. Acceptable Use</h2>
              <p className="text-slate-400 mb-4">
                You agree to use SentinelStack only for lawful purposes. Specifically, you agree to:
              </p>
              <ul className="text-slate-400 list-disc list-inside space-y-2">
                <li>Only scan systems and applications you own or have explicit written authorization to test</li>
                <li>Not use the Service for any malicious purposes or to cause harm to others</li>
                <li>Not attempt to circumvent usage limits or security measures</li>
                <li>Not reverse engineer, decompile, or attempt to extract the source code of our tools</li>
                <li>Comply with all applicable local, state, national, and international laws</li>
              </ul>
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-red-400 font-medium">
                  ⚠️ Unauthorized security testing of systems you do not own is illegal and may result in criminal prosecution. Always obtain proper authorization before scanning.
                </p>
              </div>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">4. Account Responsibilities</h2>
              <ul className="text-slate-400 list-disc list-inside space-y-2">
                <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                <li>You must provide accurate and complete information during registration</li>
                <li>You are responsible for all activities that occur under your account</li>
                <li>You must notify us immediately of any unauthorized use of your account</li>
                <li>We reserve the right to suspend or terminate accounts that violate these terms</li>
              </ul>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">5. Subscription and Billing</h2>
              <div className="text-slate-400 space-y-4">
                <p>
                  <strong className="text-white">Plans:</strong> We offer Free, Pro, and Enterprise subscription plans with varying features and limits as described on our pricing page.
                </p>
                <p>
                  <strong className="text-white">Billing:</strong> Paid subscriptions are billed in advance on a monthly or annual basis. All fees are non-refundable except as specified in our refund policy.
                </p>
                <p>
                  <strong className="text-white">Trial:</strong> Pro plans include a 14-day free trial. No credit card is required to start your trial.
                </p>
                <p>
                  <strong className="text-white">Cancellation:</strong> You may cancel your subscription at any time. You will retain access until the end of your billing period.
                </p>
                <p>
                  <strong className="text-white">Refunds:</strong> We offer a 30-day money-back guarantee for first-time subscribers. Contact support for refund requests.
                </p>
              </div>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">6. Intellectual Property</h2>
              <p className="text-slate-400">
                The Service, including all content, features, and functionality, is owned by SentinelStack and protected by international copyright, trademark, and other intellectual property laws. You retain ownership of your scan data and results, which you may export at any time.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">7. Data and Privacy</h2>
              <p className="text-slate-400">
                Your use of the Service is subject to our Privacy Policy, which describes how we collect, use, and protect your information. You acknowledge that you have read and understood our Privacy Policy.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">8. Disclaimer of Warranties</h2>
              <p className="text-slate-400">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE SERVICE WILL IDENTIFY ALL SECURITY VULNERABILITIES OR THAT YOUR SYSTEMS WILL BE SECURE AFTER USING OUR SERVICE. Security is an ongoing process, and our scans provide point-in-time assessments only.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">9. Limitation of Liability</h2>
              <p className="text-slate-400">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, SENTINELSTACK SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT PAID BY YOU FOR THE SERVICE IN THE TWELVE MONTHS PRECEDING THE CLAIM.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">10. Indemnification</h2>
              <p className="text-slate-400">
                You agree to indemnify and hold harmless SentinelStack and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the Service, your violation of these Terms, or your violation of any rights of another party.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">11. Service Level Agreement</h2>
              <p className="text-slate-400">
                Enterprise customers are eligible for our 99.9% uptime SLA. Details and credits for downtime are specified in your Enterprise agreement. Free and Pro plans are provided on a best-effort basis with no uptime guarantees.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">12. Changes to Terms</h2>
              <p className="text-slate-400">
                We reserve the right to modify these Terms at any time. We will notify you of material changes by email or through the Service. Your continued use of the Service after changes take effect constitutes acceptance of the revised Terms.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">13. Governing Law</h2>
              <p className="text-slate-400">
                These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved in the courts of Delaware.
              </p>
            </section>

            <section className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">14. Contact Information</h2>
              <p className="text-slate-400">
                For questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-cyan-400 mt-2">
                <a href="mailto:legal@sentinel-stack.tech" className="hover:underline">legal@sentinel-stack.tech</a>
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
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
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
