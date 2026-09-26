'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  LockKeyhole,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  Code2,
  Database,
  Gauge,
  Layers3,
  FileBarChart2,
  Users,
} from 'lucide-react';
import { SentinelGlobe } from '@/components/dashboard/redesigned/globe/SentinelGlobe';
import { PRICING, formatMoney, inferCurrencyFromTimezone } from '@/lib/pricing';
import styles from './SentinelLandingPage.module.css';

const capabilities = [
  { icon: ShieldCheck, value: '30+', title: 'Security Tools', body: 'Connect your stack in minutes.' },
  { icon: FileText, value: 'Automated', title: 'Security Assessment', body: 'Continuous security checks.' },
  { icon: Check, value: 'Compliance', title: 'Mapping', body: 'OWASP, ISO 27001, SOC 2 and more.' },
  { icon: Sparkles, value: 'AI-Powered', title: 'Summarization', body: 'Turn findings into actionable insights.' },
];

const process = [
  { icon: Search, title: 'Scan', detail: '30+ tools' },
  { icon: Activity, title: 'Analyze', detail: 'Findings & Risk' },
  { icon: ShieldCheck, title: 'Map', detail: 'To Frameworks' },
  { icon: FileText, title: 'Report', detail: 'Audit-Ready' },
];

const features = [
  {
    icon: Search,
    title: 'Automated Security Assessment',
    body: 'Initiate comprehensive security audits with a few clicks. Our platform automates the execution of over 30 enterprise-grade security tools.',
  },
  {
    icon: FileBarChart2,
    title: 'Customizable PDF Reports',
    body: 'Generate professional, enterprise-grade PDF reports with executive summaries, technical details, and a clear remediation roadmap.',
  },
  {
    icon: BrainCircuit,
    title: 'AI-Powered Summarization',
    body: 'Leverage AI to translate complex technical findings into clear, business-friendly language, making risks understandable to all stakeholders.',
  },
];

const domains = [
  ['Broken Access Control Pro', 'Access Control', ShieldCheck],
  ['Crypto Vulnerability Scanner', 'Cryptography', LockKeyhole],
  ['SQL Injection Detector', 'Injection', Database],
  ['XSS Vulnerability Scanner', 'Input Validation', Code2],
  ['Misconfiguration Scanner', 'Security', Gauge],
  ['Authentication Bypass Tool', 'Authentication', LockKeyhole],
  ['API Security Scanner', 'API Security', Layers3],
  ['Rate Limiting Analyzer', 'Business Logic', Activity],
] as const;

const frameworks = [
  ['OWASP Top 10', 'Fully Mapped'],
  ['PCI-DSS', 'Compliance Ready'],
  ['ISO 27001', 'Control Mapping'],
  ['SOC 2', 'Trust Criteria'],
  ['GDPR', 'Privacy Mapping'],
  ['HIPAA', 'Security Rules'],
];

const differentiators = [
  {
    icon: BarChart3,
    title: 'Business Risk Translation',
    body: 'Convert technical findings into financial, compliance, and reputation risks that executives understand.',
  },
  {
    icon: Gauge,
    title: 'Unified Risk Scoring',
    body: 'Single risk score that combines technical severity with business impact and exploitability.',
  },
  {
    icon: Users,
    title: 'Stakeholder-Specific Views',
    body: 'Different dashboards for executives, security teams, compliance officers, and developers.',
  },
];

const plans = [
  {
    name: 'Free',
    description: 'Perfect for trying out SentinelStack',
    price: '0',
    suffix: '/mo',
    features: ['3 scans per month', 'Basic vulnerability reports', 'Email support', '1 team member', '7-day scan history'],
    cta: 'Start Free',
    href: '/signup',
  },
  {
    name: 'Pro',
    description: 'For growing SaaS teams',
    price: null,
    suffix: '/mo',
    features: ['50 scans per month', 'Advanced vulnerability reports', 'AI-powered risk summaries', 'Up to 5 team members', '90-day scan history', 'PDF report exports', 'Slack notifications'],
    cta: 'Start Pro',
    href: '/pricing',
    featured: true,
  },
  {
    name: 'Enterprise',
    description: 'For large organizations',
    price: 'Custom',
    suffix: '',
    features: ['Unlimited security scans', 'Enterprise vulnerability reports', 'AI-powered risk summaries', 'Dedicated account manager', 'Unlimited team members', 'Unlimited scan history', 'White-label PDF reports', 'All integrations', 'API access', 'Custom scanning presets', 'SOC2 compliance reports'],
    cta: 'Contact Sales',
    href: 'mailto:sales@sentinel-stack.tech?subject=Enterprise%20Inquiry',
  },
];

function GlassIcon({ icon: Icon }: { icon: typeof ShieldCheck }) {
  return <span className={styles.glassIcon}><Icon size={20} strokeWidth={1.8} /></span>;
}

export default function SentinelLandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const currency = inferCurrencyFromTimezone();
  const proPrice = currency === 'INR'
    ? billingPeriod === 'monthly'
      ? PRICING.INR.PRO.launchMonthly
      : Math.round(PRICING.INR.PRO.yearly / 12)
    : billingPeriod === 'monthly'
      ? PRICING.USD.PRO.monthly
      : Math.round(PRICING.USD.PRO.yearly / 12);

  const proBilled = currency === 'INR'
    ? billingPeriod === 'yearly' ? `Billed ${formatMoney(PRICING.INR.PRO.yearly, 'INR')}/year` : `Normally ${formatMoney(PRICING.INR.PRO.monthly, 'INR')}/month`
    : billingPeriod === 'yearly' ? `Billed ${formatMoney(PRICING.USD.PRO.yearly, 'USD')}/year` : '';

  const closeMenu = () => {
    setMobileOpen(false);
    setResourcesOpen(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.environment} aria-hidden="true">
        <div className={styles.windowGlow} />
        <div className={styles.architectureLines} />
        <div className={styles.floorGlow} />
      </div>

      <header className={styles.header}>
        <div className={styles.navShell}>
          <Link href="/" className={styles.logo} onClick={closeMenu} aria-label="SentinelStack home">
            <img src="/branding/sentinelstack-logo-dark.png" alt="SentinelStack" width={180} height={50} />
          </Link>

          <nav className={styles.desktopNav} aria-label="Primary navigation">
            <a href="#platform">Features</a>
            <a href="#pricing">Pricing</a>
            <div className={styles.resourcesWrap}>
              <button type="button" className={styles.resourceButton} onClick={() => setResourcesOpen(v => !v)} aria-expanded={resourcesOpen}>
                Resources <ChevronDown size={14} />
              </button>
              {resourcesOpen && (
                <div className={styles.resourceMenu}>
                  <a href="#domains" onClick={closeMenu}>Security Domains</a>
                  <a href="#compliance" onClick={closeMenu}>Compliance</a>
                  <a href="#why" onClick={closeMenu}>Why SentinelStack</a>
                  <a href="#resources" onClick={closeMenu}>Dashboard Preview</a>
                </div>
              )}
            </div>
          </nav>

          <div className={styles.navActions}>
            <Link href="/login" className={styles.loginLink}>Login</Link>
            <Link href="/signup" className={styles.navCta}>Get Started Free <ArrowRight size={16} /></Link>
          </div>

          <button className={styles.menuButton} onClick={() => setMobileOpen(v => !v)} aria-label="Toggle navigation" aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {mobileOpen && (
          <nav className={styles.mobileNav} aria-label="Mobile navigation">
            <a href="#platform" onClick={closeMenu}>Features</a>
            <a href="#pricing" onClick={closeMenu}>Pricing</a>
            <a href="#domains" onClick={closeMenu}>Security Domains</a>
            <a href="#compliance" onClick={closeMenu}>Compliance</a>
            <a href="#why" onClick={closeMenu}>Why SentinelStack</a>
            <Link href="/login" onClick={closeMenu}>Login</Link>
            <Link href="/signup" onClick={closeMenu} className={styles.navCta}>Get Started Free <ArrowRight size={16} /></Link>
          </nav>
        )}
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroGlobe} aria-hidden="true">
            <SentinelGlobe transparentBackground lightTheme landingMode showTooltip={false} showStatusOverlay={false} />
          </div>

          <div className={`${styles.complianceCard} ${styles.owasp}`}><ShieldCheck size={18} /><span><b>OWASP</b><small>Top 10</small></span></div>
          <div className={`${styles.complianceCard} ${styles.iso}`}><FileText size={18} /><span><b>ISO 27001</b></span></div>
          <div className={`${styles.complianceCard} ${styles.soc}`}><ShieldCheck size={18} /><span><b>SOC 2</b></span></div>
          <div className={`${styles.complianceCard} ${styles.gdpr}`}><LockKeyhole size={18} /><span><b>GDPR</b></span></div>

          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}><span /> Security compliance for startups</div>
            <h1 id="hero-title">Audit-ready<br />security in<br />weeks, not quarters.</h1>
            <p>SentinelStack helps SaaS teams run continuous security assessments, map findings to OWASP, ISO 27001 and SOC 2, and ship reports customers and auditors can trust.</p>
            <div className={styles.heroActions}>
              <Link href="/signup" className={styles.primaryCta}>Get Started Free <ArrowRight size={18} /></Link>
              <a href="mailto:sales@sentinel-stack.tech?subject=SentinelStack%20Demo" className={styles.secondaryCta}><span className={styles.playIcon}>›</span> Request a Demo</a>
            </div>
          </div>

          <div className={styles.capabilityStrip} aria-label="SentinelStack capabilities">
            {capabilities.map(({ icon: Icon, value, title, body }, index) => (
              <div key={title} className={styles.capability}>
                <GlassIcon icon={Icon} />
                <div className={styles.capabilityText}>
                  <strong className={index === 0 ? styles.numericValue : ''}>{value}</strong>
                  <b>{title}</b>
                  <span>{body}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="platform" className={`${styles.section} ${styles.platform}`}>
          <div className={styles.sectionHeading}>
            <div className={styles.eyebrow}><span /> Everything you need to secure your stack</div>
            <h2>From automated scanning to AI-augmented reporting.</h2>
            <p>SentinelStack provides a complete solution for modern security teams and consultants.</p>
          </div>
          <div className={styles.featureGrid}>
            {features.map(({ icon, title, body }) => (
              <article key={title} className={styles.featureCard}>
                <GlassIcon icon={icon} />
                <h3>{title}</h3>
                <p>{body}</p>
                <span className={styles.cardArrow}><ArrowRight size={17} /></span>
              </article>
            ))}
          </div>
          <div className={styles.processBand}>
            {process.map(({ icon: Icon, title, detail }, index) => (
              <div key={title} className={styles.processItem}>
                <div className={styles.processCard}><Icon size={22} /><strong>{title}</strong><span>{detail}</span></div>
                {index < process.length - 1 && <ArrowRight className={styles.processArrow} size={18} />}
              </div>
            ))}
          </div>
        </section>

        <section id="domains" className={`${styles.section} ${styles.domainsSection}`}>
          <div className={styles.sectionHeading}>
            <div className={styles.eyebrow}><span /> Supported security domains</div>
            <h2>Comprehensive coverage across critical security areas.</h2>
            <p>Representative tools from SentinelStack's security assessment stack.</p>
          </div>
          <div className={styles.domainGrid}>
            {domains.map(([title, category, Icon], index) => (
              <article key={title} className={styles.domainCard}>
                <div className={styles.domainNumber}>TOOL #{index + 1}</div>
                <GlassIcon icon={Icon} />
                <h3>{title}</h3>
                <span>{category}</span>
              </article>
            ))}
          </div>
        </section>

        <section id="compliance" className={`${styles.section} ${styles.complianceSection}`}>
          <div className={styles.complianceIntro}>
            <div className={styles.eyebrow}><span /> Compliance & standards mapping</div>
            <h2>Automatically map findings to major compliance frameworks.</h2>
          </div>
          <div className={styles.frameworkGrid}>
            {frameworks.map(([name, detail]) => (
              <article key={name} className={styles.frameworkCard}>
                <span className={styles.frameworkMark}><Check size={18} /></span>
                <strong>{name}</strong>
                <span>{detail}</span>
              </article>
            ))}
          </div>
        </section>

        <section id="why" className={`${styles.section} ${styles.whySection}`}>
          <div className={styles.sectionHeading}>
            <div className={styles.eyebrow}><span /> Why SentinelStack is different</div>
            <h2>Built for leaders who need to communicate risk in business terms.</h2>
          </div>
          <div className={styles.differentiatorGrid}>
            {differentiators.map(({ icon: Icon, title, body }) => (
              <article key={title} className={styles.differentiatorCard}>
                <GlassIcon icon={Icon} />
                <h3>{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="resources" className={`${styles.section} ${styles.previewSection}`}>
          <div className={styles.previewCopy}>
            <div className={styles.eyebrow}><span /> Interactive dashboard preview</div>
            <h2>See risk in business terms.</h2>
            <p>Our dashboard shows not just what's vulnerable, but what it means for your business — financial impact, compliance exposure, and reputation risk.</p>
            <Link href="/dashboard" className={styles.primaryCta}>Explore Demo Dashboard <ArrowRight size={18} /></Link>
          </div>
          <div className={styles.dashboardMock} aria-label="Dashboard preview">
            <div className={styles.mockTop}><span>SentinelStack</span><span>Risk Intelligence</span><span>Compliance</span></div>
            <div className={styles.mockBody}>
              <div className={styles.mockScore}><small>Unified Risk Score</small><strong>68</strong><span>Business exposure</span></div>
              <div className={styles.mockBars}>
                <span><i style={{ width: '78%' }} /></span>
                <span><i style={{ width: '58%' }} /></span>
                <span><i style={{ width: '42%' }} /></span>
                <span><i style={{ width: '66%' }} /></span>
              </div>
              <div className={styles.mockPanel}><span>Technical Findings</span><b>Business Impact</b><b>Compliance Exposure</b></div>
            </div>
          </div>
        </section>

        <section id="pricing" className={`${styles.section} ${styles.pricingSection}`}>
          <div className={styles.sectionHeading}>
            <div className={styles.eyebrow}><span /> Simple, transparent pricing</div>
            <h2>Built for early-stage SaaS teams.</h2>
            <p>Start free, then upgrade when you need audit-ready reporting.</p>
          </div>
          <div className={styles.billingToggle}>
            <button className={billingPeriod === 'monthly' ? styles.toggleActive : ''} onClick={() => setBillingPeriod('monthly')}>Monthly</button>
            <button className={billingPeriod === 'yearly' ? styles.toggleActive : ''} onClick={() => setBillingPeriod('yearly')}>Yearly</button>
          </div>
          <div className={styles.pricingGrid}>
            {plans.map((plan) => {
              const price = plan.name === 'Pro' ? String(proPrice) : plan.price;
              return (
                <article key={plan.name} className={`${styles.priceCard} ${plan.featured ? styles.featuredPrice : ''}`}>
                  {plan.featured && <span className={styles.priceBadge}>Pro</span>}
                  <h3>{plan.name}</h3>
                  <p>{plan.description}</p>
                  <div className={styles.price}><strong>{currency === 'INR' && plan.name !== 'Enterprise' ? '₹' : plan.name === 'Enterprise' ? '' : '$'}{price}</strong><span>{plan.suffix}</span></div>
                  {plan.name === 'Pro' && <small className={styles.priceNote}>{proBilled}</small>}
                  <ul>{plan.features.map(feature => <li key={feature}><Check size={15} /> {feature}</li>)}</ul>
                  <Link href={plan.href} className={plan.featured ? styles.primaryCta : styles.priceCta}>{plan.cta} <ArrowRight size={16} /></Link>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div className={styles.finalCtaInner}>
            <div>
              <div className={styles.eyebrow}><span /> Start securing your applications today</div>
              <h2>Comprehensive vulnerability assessments without the fragmented workflow.</h2>
              <p>No credit card required • 3 free scans/month • Cancel anytime</p>
            </div>
            <div className={styles.finalActions}>
              <Link href="/signup" className={styles.primaryCta}>Get Started Free <ArrowRight size={18} /></Link>
              <a href="#pricing" className={styles.secondaryCta}>View Pricing <ArrowRight size={18} /></a>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <img src="/branding/sentinelstack-logo-dark.png" alt="SentinelStack" width={180} height={50} />
            <p>Continuous Offensive Security.</p>
          </div>
          <div className={styles.footerLinks}>
            <div><b>Platform</b><a href="#platform">Features</a><a href="#domains">Security Domains</a><a href="#compliance">Compliance</a></div>
            <div><b>Company</b><a href="#why">Why SentinelStack</a><a href="#resources">Dashboard Preview</a><Link href="/pricing">Pricing</Link></div>
            <div><b>Legal</b><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><a href="mailto:sales@sentinel-stack.tech">Contact</a></div>
          </div>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} SentinelStack. All rights reserved.</span><span>Enterprise Security Assessment Platform</span></div>
      </footer>
    </div>
  );
}
