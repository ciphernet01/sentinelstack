'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  FileText,
  Globe2,
  LayoutGrid,
  Menu,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { SentinelStackLogo } from '@/lib/icons';
import { PRICING, formatMoney } from '@/lib/pricing';
import styles from './SentinelLandingPage.module.css';

const securityDomains = [
  'Broken Access Control Pro',
  'Crypto Vulnerability Scanner',
  'SQL Injection Detector',
  'XSS Vulnerability Scanner',
  'Misconfiguration Scanner',
  'Authentication Bypass Tool',
  'API Security Scanner',
  'Rate Limiting Analyzer',
];

const compliance = ['OWASP Top 10', 'PCI-DSS', 'ISO 27001', 'SOC 2', 'GDPR', 'HIPAA'];

const features = [
  {
    icon: ShieldCheck,
    title: 'Automated Security Assessment',
    body: 'Initiate comprehensive security audits with a few clicks. Automates execution of over 30 enterprise-grade security tools.',
  },
  {
    icon: FileText,
    title: 'Customizable PDF Reports',
    body: 'Generate enterprise-grade PDF reports with executive summaries, technical details, and a clear remediation roadmap.',
  },
  {
    icon: Bot,
    title: 'AI-Powered Summarization',
    body: 'Translate complex technical findings into clear, business-friendly language.',
  },
];

const differentiators = [
  {
    icon: Globe2,
    title: 'Business Risk Translation',
    body: 'Convert technical findings into financial, compliance, and reputation risks that executives understand.',
  },
  {
    icon: LayoutGrid,
    title: 'Unified Risk Scoring',
    body: 'Single risk score combining technical severity with business impact and exploitability.',
  },
  {
    icon: Users,
    title: 'Stakeholder-Specific Views',
    body: 'Different dashboards for executives, security teams, compliance officers and developers.',
  },
];

function SpatialGlobe() {
  // The supplied repository does not contain the dashboard SentinelGlobe implementation
  // referenced by the design archive. This component is intentionally isolated so the
  // real dashboard globe can replace it without touching the rest of the landing page.
  return (
    <div className={styles.globeStage} aria-label="SentinelStack digital Earth visualization" role="img">
      <div className={styles.globeAura} />
      <div className={styles.globe}>
        <div className={styles.globeGrid} />
        <div className={styles.globeLand}>
          <span className={`${styles.land} ${styles.landOne}`} />
          <span className={`${styles.land} ${styles.landTwo}`} />
          <span className={`${styles.land} ${styles.landThree}`} />
          <span className={`${styles.land} ${styles.landFour}`} />
          <span className={`${styles.land} ${styles.landFive}`} />
        </div>
        <div className={styles.globeNodes}>
          {Array.from({ length: 22 }).map((_, index) => {
            const angle = (index / 22) * Math.PI * 2;
            const radius = 25 + (index % 4) * 4;
            const x = 50 + Math.cos(angle * 1.17) * radius;
            const y = 50 + Math.sin(angle * 1.43) * radius;
            return <i key={index} style={{ '--x': `${x}%`, '--y': `${y}%`, '--i': index } as React.CSSProperties} />;
          })}
        </div>
      </div>
      <div className={`${styles.globeArc} ${styles.arcOne}`} />
      <div className={`${styles.globeArc} ${styles.arcTwo}`} />
      <div className={styles.globeCaption}>
        <span className={styles.liveDot} />
        Security intelligence layer
      </div>
    </div>
  );
}

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`${styles.glassCard} ${className}`}>{children}</div>;
}

export default function SentinelLandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMenu = () => setMobileOpen(false);

  return (
    <div className={styles.page}>
      <div className={styles.ambientOne} />
      <div className={styles.ambientTwo} />
      <div className={styles.architecture} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <header className={styles.header}>
        <div className={styles.navShell}>
          <Link href="/" className={styles.logo} onClick={closeMenu} aria-label="SentinelStack home">
            <SentinelStackLogo width={154} />
          </Link>

          <nav className={styles.desktopNav} aria-label="Primary navigation">
            <Link href="#features">Features</Link>
            <Link href="#domains">Security</Link>
            <Link href="#compliance">Compliance</Link>
            <Link href="#pricing">Pricing</Link>
          </nav>

          <div className={styles.navActions}>
            <Link href="/login" className={styles.loginLink}>Login</Link>
            <Link href="/signup" className={styles.darkPill}>Get Started Free <ArrowRight size={15} /></Link>
          </div>

          <button className={styles.menuButton} onClick={() => setMobileOpen(v => !v)} aria-label="Toggle menu" aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <nav className={styles.mobileNav} aria-label="Mobile navigation">
            <Link href="#features" onClick={closeMenu}>Features</Link>
            <Link href="#domains" onClick={closeMenu}>Security</Link>
            <Link href="#compliance" onClick={closeMenu}>Compliance</Link>
            <Link href="#pricing" onClick={closeMenu}>Pricing</Link>
            <Link href="/login" onClick={closeMenu}>Login</Link>
            <Link href="/signup" onClick={closeMenu} className={styles.darkPill}>Get Started Free <ArrowRight size={15} /></Link>
          </nav>
        )}
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> Security compliance for startups</div>
            <h1>Audit-ready security <em>in weeks,</em> not quarters.</h1>
            <p className={styles.heroLead}>
              SentinelStack helps SaaS teams run continuous security assessments, map findings to common frameworks (OWASP, ISO 27001, SOC 2), and ship reports customers and auditors can trust.
            </p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.primaryCta}>Get Started Free <ArrowRight size={18} /></Link>
              <Link href="/login" className={styles.secondaryCta}>Request a Demo</Link>
            </div>
            <div className={styles.microProof}>
              <span><Sparkles size={15} /> No credit card required</span>
              <span>3 free scans/month</span>
              <span>Cancel anytime</span>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <SpatialGlobe />
            <GlassCard className={styles.floatingCardTop}>
              <span className={styles.cardIcon}><Zap size={16} /></span>
              <div><strong>30+</strong><small>Security Tools</small></div>
            </GlassCard>
            <GlassCard className={styles.floatingCardBottom}>
              <div className={styles.signal}><i /><i /><i /><i /></div>
              <div><strong>Continuous assessment</strong><small>Audit-ready security posture</small></div>
            </GlassCard>
          </div>
        </section>

        <section className={styles.proofRow} aria-label="Product capabilities">
          <div><strong>30+</strong><span>Security Tools</span></div>
          <div><strong>Automated</strong><span>Security Assessment</span></div>
          <div><strong>Compliance</strong><span>OWASP · ISO 27001 · SOC 2</span></div>
          <div><strong>AI-Powered</strong><span>Summarization</span></div>
        </section>

        <section id="features" className={styles.section}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>THE PLATFORM</span>
            <h2>Everything you need to <em>secure your stack.</em></h2>
            <p>From automated scanning to AI-augmented reporting, SentinelStack provides a complete solution for modern security teams and consultants.</p>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ icon: Icon, title, body }) => (
              <GlassCard key={title} className={styles.featureCard}>
                <div className={styles.featureIcon}><Icon size={24} /></div>
                <h3>{title}</h3>
                <p>{body}</p>
                <span className={styles.cardArrow}><ArrowRight size={17} /></span>
              </GlassCard>
            ))}
          </div>
        </section>

        <section id="domains" className={`${styles.section} ${styles.softSection}`}>
          <div className={styles.sectionIntroRow}>
            <div>
              <span className={styles.sectionKicker}>SECURITY COVERAGE</span>
              <h2>Built for the <em>critical paths.</em></h2>
            </div>
            <p>Comprehensive coverage across the security domains currently supported by SentinelStack.</p>
          </div>
          <div className={styles.domainGrid}>
            {securityDomains.map((domain, index) => (
              <GlassCard key={domain} className={styles.domainCard}>
                <span className={styles.domainNumber}>{String(index + 1).padStart(2, '0')}</span>
                <span>{domain}</span>
                <ArrowRight size={16} />
              </GlassCard>
            ))}
          </div>
        </section>

        <section id="compliance" className={styles.section}>
          <div className={styles.complianceLayout}>
            <div className={styles.sectionIntroLeft}>
              <span className={styles.sectionKicker}>COMPLIANCE MAPPING</span>
              <h2>Map findings to the standards your customers <em>already expect.</em></h2>
              <p>Automatically map findings to major compliance frameworks without implying unsupported certifications.</p>
              <Link href="/signup" className={styles.textCta}>Explore SentinelStack <ArrowRight size={17} /></Link>
            </div>
            <div className={styles.frameworkGrid}>
              {compliance.map((item, index) => (
                <GlassCard key={item} className={styles.frameworkCard}>
                  <div className={styles.frameworkMark}>{index + 1}</div>
                  <div><strong>{item}</strong><span>Framework mapping</span></div>
                  <Check size={17} />
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.whySection}`}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>WHY SENTINELSTACK</span>
            <h2>Technical findings, translated into <em>business language.</em></h2>
          </div>
          <div className={styles.differentiatorGrid}>
            {differentiators.map(({ icon: Icon, title, body }, index) => (
              <div key={title} className={styles.differentiator}>
                <span className={styles.diffIndex}>0{index + 1}</span>
                <Icon size={23} />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.dashboardStory}>
          <div className={styles.dashboardGlow} />
          <div className={styles.dashboardCopy}>
            <span className={styles.sectionKicker}>RISK INTELLIGENCE</span>
            <h2>See security risk in <em>business terms.</em></h2>
            <p>SentinelStack turns technical security findings into risk context that executives, security teams, compliance officers and developers can act on.</p>
            <Link href="/dashboard" className={styles.primaryCta}>Explore the Dashboard <ArrowRight size={18} /></Link>
          </div>
          <div className={styles.dashboardMock} aria-hidden="true">
            <div className={styles.mockTop}><span /><span /><span /><b>Risk Intelligence</b></div>
            <div className={styles.mockGrid}>
              <div className={styles.mockChart}><i /><i /><i /><i /><i /><i /><i /></div>
              <div className={styles.mockSide}><span /><span /><span /></div>
            </div>
          </div>
        </section>

        <section id="pricing" className={styles.section}>
          <div className={styles.sectionIntro}>
            <span className={styles.sectionKicker}>PRICING</span>
            <h2>Start small. <em>Scale when you need it.</em></h2>
            <p>Simple pricing for teams moving toward continuous, audit-ready security.</p>
          </div>
          <div className={styles.pricingGrid}>
            <PriceCard tier="Free" price={`${formatMoney(PRICING.USD.FREE.monthly, 'USD')} / ${formatMoney(PRICING.INR.FREE.monthly, 'INR')}`} suffix="/mo" features={['3 scans/month', 'Basic vulnerability reports', 'Email support', '7-day scan history']} href="/signup" />
            <PriceCard tier="Pro" featured price={`${formatMoney(PRICING.USD.PRO.monthly, 'USD')} / ${formatMoney(PRICING.INR.PRO.launchMonthly, 'INR')}`} suffix="/mo" note="USD $99/mo or $990/yr · INR launch ₹1999/mo then ₹2999/mo · ₹29990/yr" features={['50 scans/month', 'AI-powered risk summaries', 'Up to 5 team members', '90-day scan history', 'Slack notifications']} href="/pricing" />
            <PriceCard tier="Enterprise" price="Custom" features={['Unlimited scans', 'API access & webhooks', 'SOC2 compliance reports', 'Dedicated account manager']} href="mailto:sales@sentinel-stack.tech?subject=Enterprise%20Inquiry" />
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.finalOrb} />
          <span className={styles.sectionKicker}>READY WHEN YOU ARE</span>
          <h2>Start securing your applications <em>today.</em></h2>
          <p>Join security teams who trust SentinelStack for comprehensive vulnerability assessments.</p>
          <div className={styles.heroActions}>
            <Link href="/signup" className={styles.primaryCta}>Get Started Free <ArrowRight size={18} /></Link>
            <Link href="/pricing" className={styles.secondaryCta}>View Pricing</Link>
          </div>
          <small>No credit card required • 3 free scans/month • Cancel anytime</small>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <Link href="/" aria-label="SentinelStack home"><SentinelStackLogo width={150} /></Link>
          <nav>
            <Link href="#features">Features</Link>
            <Link href="#domains">Security</Link>
            <Link href="#compliance">Compliance</Link>
            <Link href="#pricing">Pricing</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </div>
        <div className={styles.footerBottom}>© {new Date().getFullYear()} SentinelStack. All rights reserved.</div>
      </footer>
    </div>
  );
}

function PriceCard({ tier, price, suffix = '', note, features, href, featured = false }: { tier: string; price: string; suffix?: string; note?: string; features: string[]; href: string; featured?: boolean }) {
  return (
    <GlassCard className={`${styles.priceCard} ${featured ? styles.priceFeatured : ''}`}>
      {featured && <span className={styles.popular}>Recommended plan</span>}
      <span className={styles.priceTier}>{tier}</span>
      <div className={styles.priceValue}>{price}<small>{suffix}</small></div>
      {note && <p className={styles.priceNote}>{note}</p>}
      <ul>{features.map(item => <li key={item}><Check size={16} />{item}</li>)}</ul>
      <Link href={href} className={featured ? styles.primaryCta : styles.secondaryCta}>{tier === 'Enterprise' ? 'Contact Sales' : tier === 'Pro' ? 'Start Pro' : 'Start Free'} <ArrowRight size={17} /></Link>
    </GlassCard>
  );
}
