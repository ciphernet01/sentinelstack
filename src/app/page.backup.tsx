import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CheckCircle, ShieldCheck, FileText, Bot, Zap, Globe, LayoutGrid, Users, LockIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Badge } from '@/components/ui/badge';

const heroImage = PlaceHolderImages.find(img => img.id === 'hero-dashboard');
const featureAutomationImage = PlaceHolderImages.find(img => img.id === 'feature-automation');
const featureReportingImage = PlaceHolderImages.find(img => img.id === 'feature-reporting');
const featureAiImage = PlaceHolderImages.find(img => img.id === 'feature-ai');

const features = [
  {
    icon: <ShieldCheck className="h-10 w-10 text-primary" />,
    title: 'Automated Security Assessment',
    description: 'Initiate comprehensive security audits with a few clicks. Our platform automates the execution of over 30 enterprise-grade security tools.',
    image: featureAutomationImage,
  },
  {
    icon: <FileText className="h-10 w-10 text-primary" />,
    title: 'Customizable PDF Reports',
    description: 'Generate professional, enterprise-grade PDF reports with executive summaries, technical details, and a clear remediation roadmap.',
    image: featureReportingImage,
  },
  {
    icon: <Bot className="h-10 w-10 text-primary" />,
    title: 'AI-Powered Summarization',
    description: 'Leverage AI to translate complex technical findings into clear, business-friendly language, making risks understandable to all stakeholders.',
    image: featureAiImage,
  },
];

const securityDomains = [
  {
    id: 1,
    name: "Broken Access Control Pro",
    category: "Access Control"
  },
  {
    id: 2,
    name: "Crypto Vulnerability Scanner",
    category: "Cryptography"
  },
  {
    id: 3,
    name: "SQL Injection Detector",
    category: "Injection"
  },
  {
    id: 4,
    name: "XSS Vulnerability Scanner",
    category: "Input Validation"
  },
  {
    id: 5,
    name: "Misconfiguration Scanner",
    category: "Security"
  },
  {
    id: 6,
    name: "Authentication Bypass Tool",
    category: "Authentication"
  },
  {
    id: 7,
    name: "API Security Scanner",
    category: "API Security"
  },
  {
    id: 8,
    name: "Rate Limiting Analyzer",
    category: "Business Logic"
  }
];

const complianceFrameworks = [
  { name: 'OWASP Top 10', status: 'Fully Mapped' },
  { name: 'PCI-DSS', status: 'Compliance Ready' },
  { name: 'ISO 27001', status: 'Control Mapping' },
  { name: 'SOC 2', status: 'Trust Criteria' },
  { name: 'GDPR', status: 'Privacy Mapping' },
  { name: 'HIPAA', status: 'Security Rules' },
];

const whyFeatures = [
    {
        icon: <Globe className="h-6 w-6 text-primary" />,
        title: "Business Risk Translation",
        description: "Convert technical findings into financial, compliance, and reputation risks that executives understand"
    },
    {
        icon: <LayoutGrid className="h-6 w-6 text-primary" />,
        title: "Unified Risk Scoring",
        description: "Single risk score that combines technical severity with business impact and exploitability"
    },
    {
        icon: <Users className="h-6 w-6 text-primary" />,
        title: "Stakeholder-Specific Views",
        description: "Different dashboards for executives, security teams, compliance officers, and developers"
    }
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        <section className="w-full py-10 sm:py-16 md:py-32 lg:py-40 bg-card">
          <div className="container px-2 sm:px-4 md:px-6">
            <div className="grid gap-10 sm:gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="flex flex-col justify-center space-y-6 text-center lg:text-left">
                <div className="inline-block rounded-lg bg-secondary px-3 py-1 text-xs sm:text-sm text-secondary-foreground">Enterprise Security Assessment Platform</div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none font-headline">
                  Continuous Security, On-Demand.
                </h1>
                <p className="max-w-full sm:max-w-[600px] text-muted-foreground text-base sm:text-lg md:text-xl mx-auto lg:mx-0">
                  Sentinel Stack empowers you to run comprehensive security assessments, visualize risks on an interactive dashboard, and generate actionable reports—all automated.
                </p>
                <div className="flex flex-col gap-2 w-full sm:w-auto sm:flex-row justify-center lg:justify-start">
                  <Button asChild size="lg" className="group w-full sm:w-auto">
                    <Link href="/dashboard">
                      Get Started Free <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link href="/login">
                      Request a Demo
                    </Link>
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center mt-8 lg:mt-0">
                {heroImage && (
                  <Image
                    src={heroImage.imageUrl}
                    width={600}
                    height={400}
                    alt={heroImage.description}
                    data-ai-hint={heroImage.imageHint}
                    className="overflow-hidden rounded-xl object-cover shadow-2xl w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-full"
                    priority
                  />
                )}
              </div>
            </div>
            
            {/* Social Proof Stats */}
            <div className="mt-16 grid grid-cols-2 gap-8 md:grid-cols-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">30+</div>
                <div className="text-sm text-muted-foreground">Security Tools</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">10K+</div>
                <div className="text-sm text-muted-foreground">Scans Completed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime SLA</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">&lt;5min</div>
                <div className="text-sm text-muted-foreground">Avg Scan Time</div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="w-full py-10 sm:py-16 md:py-32">
          <div className="container px-2 sm:px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Everything You Need to Secure Your Stack</h2>
              <p className="max-w-full sm:max-w-[900px] text-muted-foreground text-base sm:text-lg md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                From automated scanning to AI-augmented reporting, Sentinel Stack provides a complete solution for modern security teams and consultants.
              </p>
            </div>
            <div className="mx-auto grid max-w-2xl sm:max-w-5xl items-start gap-8 sm:gap-12 grid-cols-1 md:grid-cols-3">
              {features.map((feature, index) => (
                <div key={index} className="grid gap-4 text-center">
                  <div className="mx-auto">{feature.icon}</div>
                  <h3 className="text-lg sm:text-xl font-bold font-headline">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm sm:text-base">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="domains" className="w-full py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Supported Security Domains</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Comprehensive coverage across all critical security areas
              </p>
            </div>
            <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {securityDomains.map((tool) => (
                <Card key={tool.id} className="bg-card/80 border-border/50">
                  <CardContent className="p-6 grid gap-4">
                    <div className="flex items-center justify-between">
                       <p className="text-sm font-semibold text-primary">TOOL #{tool.id}</p>
                       <Zap className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold font-headline text-primary-foreground">{tool.name}</h3>
                      <p className="text-sm text-muted-foreground">{tool.category}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="compliance" className="w-full pb-20 md:pb-32">
           <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Compliance &amp; Standards Mapping</h2>
              <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Automatically map findings to major compliance frameworks
              </p>
            </div>
            <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {complianceFrameworks.map((framework) => (
                <Card key={framework.name} className="bg-card/80 border-border/50 p-6 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-lg font-semibold text-primary-foreground">{framework.name}</h3>
                            <Badge variant="secondary" className="mt-2 bg-green-900/50 text-green-300 border-none">{framework.status}</Badge>
                        </div>
                        <CheckCircle className="h-6 w-6 text-green-400" />
                    </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
        
        <section id="why" className="w-full pb-20 md:pb-32">
           <div className="container px-4 md:px-6">
                <div className="flex flex-col items-center justify-center space-y-4 text-center mb-16">
                    <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl font-headline">Why SentinelStack is Different</h2>
                    <p className="max-w-[900px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                        Built for security leaders who need to communicate risk in business terms
                    </p>
                </div>
                <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
                    <div className="flex flex-col justify-center space-y-8">
                        {whyFeatures.map((feature, index) => (
                            <div key={index} className="flex items-start gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
                                    {feature.icon}
                                </div>
                                <div className="grid gap-1">
                                    <h3 className="text-lg font-bold font-headline">{feature.title}</h3>
                                    <p className="text-muted-foreground">{feature.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-6 rounded-xl bg-card p-8 shadow-inner-lg">
                        <div className="flex h-60 w-full items-center justify-center rounded-lg border-2 border-dashed bg-secondary/50">
                            <div className="text-center">
                                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 mb-4">
                                    <LockIcon className="h-8 w-8 text-primary" />
                                </div>
                                <p className="font-semibold text-primary-foreground">Interactive Dashboard Preview</p>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-bold font-headline">See Risk in Business Terms</h3>
                            <p className="mt-2 max-w-md text-muted-foreground">
                              Our dashboard shows you not just what&apos;s vulnerable, but what it means for your business—financial impact, compliance exposure, and reputation risk.
                            </p>
                        </div>
                         <Button asChild size="lg" className="group">
                            <Link href="/dashboard">
                                Explore Demo Dashboard <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </section>


        <section id="pricing" className="w-full py-20 md:py-32 bg-card">
          <div className="container grid items-center justify-center gap-4 px-4 text-center md:px-6">
            <div className="space-y-3">
              <h2 className="text-3xl font-bold tracking-tighter md:text-4xl/tight font-headline">Simple, Transparent Pricing</h2>
              <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Choose the plan that fits your needs. All plans include our core security assessment and reporting features.
              </p>
            </div>
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 pt-12 md:grid-cols-3">
              <PricingCard
                tier="Free"
                price="$0"
                period="/mo"
                description="Get started with basic security scanning."
                features={[
                  "3 Scans/month",
                  "Basic vulnerability detection",
                  "Standard PDF Reports",
                  "Community Support",
                ]}
              />
              <PricingCard
                tier="Pro"
                price="$99"
                period="/mo"
                description="For teams that need comprehensive security coverage."
                features={[
                  "50 Scans/month",
                  "All 30+ Security Tools",
                  "Custom Branded Reports",
                  "Priority Email Support",
                ]}
                isPrimary
              />
              <PricingCard
                tier="Enterprise"
                price="$299"
                period="/mo"
                description="For organizations requiring unlimited power."
                features={[
                  "Unlimited Scans",
                  "API Access & Webhooks",
                  "Advanced Compliance Mapping",
                  "Dedicated Account Manager",
                ]}
              />
            </div>
          </div>
        </section>

        <section className="w-full py-20 md:py-32 bg-gradient-to-r from-blue-600 to-indigo-800 text-primary-foreground">
          <div className="container flex flex-col items-center gap-6 px-4 text-center md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl font-headline">Start Securing Your Applications Today</h2>
            <p className="max-w-[600px] text-primary-foreground/80">
              Join 500+ security teams who trust SentinelStack for comprehensive vulnerability assessments.
            </p>
            <div className="flex flex-col gap-4 min-[400px]:flex-row">
              <Button asChild variant="outline" size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90">
                <Link href="/signup">Get Started Free</Link>
              </Button>
               <Button asChild variant="outline" size="lg" className="border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10">
                <Link href="/pricing">View Pricing</Link>
              </Button>
            </div>
            <p className="text-xs text-primary-foreground/70">
              No credit card required • 3 free scans/month • Cancel anytime
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

function PricingCard({
  tier,
  price,
  period,
  description,
  features,
  isPrimary = false,
}: {
  tier: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  isPrimary?: boolean;
}) {
  return (
    <Card className={isPrimary ? 'border-primary ring-2 ring-primary' : ''}>
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-headline">{tier}</CardTitle>
        <p className="text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="text-4xl font-bold">
          {price}
          <span className="text-lg font-normal text-muted-foreground">{period}</span>
        </div>
        <ul className="grid gap-2 text-left text-sm">
          {features.map((feature, index) => (
            <li key={index} className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              {feature}
            </li>
          ))}
        </ul>
        <Button asChild className={isPrimary ? '' : 'bg-primary/90 hover:bg-primary'} variant={isPrimary ? 'default' : 'secondary'}>
          <Link href="/signup">{price === '$0' ? 'Start Free' : price === '$299' ? 'Contact Sales' : 'Choose Plan'}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
