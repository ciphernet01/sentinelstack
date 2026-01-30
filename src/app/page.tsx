import Link from 'next/link';
import { 
  ArrowRight, 
  CheckCircle, 
  ShieldCheck, 
  FileText, 
  Bot, 
  Zap, 
  Globe, 
  LayoutGrid, 
  Users, 
  Star,
  TrendingUp,
  Clock,
  Shield,
  BarChart3,
  Sparkles
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Badge } from '@/components/ui/badge';

const stats = [
  { value: '30+', label: 'Security Tools', icon: Shield },
  { value: '10K+', label: 'Scans Completed', icon: BarChart3 },
  { value: '99.9%', label: 'Uptime SLA', icon: Clock },
  { value: '< 5min', label: 'Avg Scan Time', icon: TrendingUp },
];

const features = [
  {
    icon: ShieldCheck,
    title: 'Automated Security Assessment',
    description: 'Launch comprehensive security audits with a few clicks. Our platform orchestrates 30+ enterprise-grade tools.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: FileText,
    title: 'Professional PDF Reports',
    description: 'Generate branded, executive-ready reports with clear remediation roadmaps and compliance mapping.',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    icon: Bot,
    title: 'AI-Powered Insights',
    description: 'Translate technical findings into business language. Make risks understandable to all stakeholders.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Globe,
    title: 'Multi-Target Scanning',
    description: 'Scan web apps, APIs, and authentication flows. Full coverage across your entire attack surface.',
    gradient: 'from-green-500 to-emerald-500',
  },
  {
    icon: LayoutGrid,
    title: 'Unified Dashboard',
    description: 'Single pane of glass for all security findings. Track trends, prioritize fixes, and measure progress.',
    gradient: 'from-rose-500 to-red-500',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Invite team members, share reports, and assign remediation tasks. Built for modern security teams.',
    gradient: 'from-indigo-500 to-violet-500',
  },
];

const securityDomains = [
  { name: 'OWASP Top 10', category: 'Web Security' },
  { name: 'API Security', category: 'REST & GraphQL' },
  { name: 'Authentication', category: 'Session & JWT' },
  { name: 'Access Control', category: 'IDOR & BOLA' },
  { name: 'Injection Attacks', category: 'SQL, XSS, SSRF' },
  { name: 'Cryptography', category: 'SSL/TLS & Secrets' },
  { name: 'Rate Limiting', category: 'DoS Protection' },
  { name: 'Misconfiguration', category: 'Headers & CORS' },
];

const testimonials = [
  {
    quote: "SentinelStack cut our security assessment time by 80%. The AI summaries make it easy to explain risks to leadership.",
    author: "Sarah Chen",
    role: "CISO",
    company: "TechScale Inc",
    rating: 5,
  },
  {
    quote: "Finally, a security tool that speaks both technical and business language. Game changer for our consulting practice.",
    author: "Marcus Rodriguez",
    role: "Security Consultant",
    company: "CyberGuard Partners",
    rating: 5,
  },
  {
    quote: "The compliance mapping feature alone saved us weeks of manual work. SOC 2 audit prep is now a breeze.",
    author: "Emily Watson",
    role: "Compliance Manager",
    company: "FinSecure Corp",
    rating: 5,
  },
];

const complianceFrameworks = [
  'OWASP Top 10',
  'PCI-DSS',
  'SOC 2',
  'ISO 27001',
  'GDPR',
  'HIPAA',
];

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out SentinelStack',
    features: [
      '3 security scans per month',
      'Basic vulnerability reports',
      'Email support',
      '1 team member',
    ],
    cta: 'Get Started',
    href: '/signup',
    featured: false,
  },
  {
    name: 'Pro',
    price: '$99',
    period: '/month',
    description: 'For growing security teams',
    features: [
      '50 security scans per month',
      'AI-powered risk summaries',
      'Priority support',
      'Up to 5 team members',
      'PDF report exports',
      'Slack notifications',
    ],
    cta: 'Start Free Trial',
    href: '/signup?plan=pro',
    featured: true,
  },
  {
    name: 'Enterprise',
    price: '$299',
    period: '/month',
    description: 'For large organizations',
    features: [
      'Unlimited security scans',
      'White-label reports',
      'Dedicated account manager',
      'Unlimited team members',
      'API access',
      'Custom integrations',
      'SOC 2 compliance reports',
    ],
    cta: 'Contact Sales',
    href: '/pricing',
    featured: false,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative w-full overflow-hidden">
          {/* Background Effects */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950" />
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-purple-500/20 blur-3xl rounded-full" />
          
          <div className="relative container px-4 md:px-6 py-20 md:py-32 lg:py-40">
            <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 text-sm text-cyan-400">
                <Sparkles className="h-4 w-4" />
                <span>AI-Powered Security Assessment Platform</span>
              </div>
              
              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white">
                Security Assessment{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">
                  Automated
                </span>
              </h1>
              
              {/* Subheadline */}
              <p className="text-lg md:text-xl text-slate-400 max-w-2xl">
                Run comprehensive security scans, get AI-powered insights, and generate professional reports. 
                All in one platform built for modern security teams.
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                <Button asChild size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold px-8 h-12 text-base shadow-lg shadow-cyan-500/25">
                  <Link href="/signup">
                    Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white px-8 h-12 text-base">
                  <Link href="#demo">
                    Watch Demo
                  </Link>
                </Button>
              </div>
              
              {/* Social Proof */}
              <div className="flex flex-col sm:flex-row items-center gap-4 text-sm text-slate-500 pt-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-slate-950 flex items-center justify-center text-xs text-slate-300 font-medium">
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
                <span>Trusted by 500+ security teams worldwide</span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="w-full py-12 border-y border-slate-800 bg-slate-900/50">
          <div className="container px-4 md:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, idx) => {
                const Icon = stat.icon;
                return (
                  <div key={idx} className="flex flex-col items-center text-center">
                    <Icon className="h-6 w-6 text-cyan-400 mb-2" />
                    <div className="text-3xl md:text-4xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm text-slate-400">{stat.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="w-full py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-400">Features</Badge>
              <h2 className="text-3xl md:text-5xl font-bold text-white">
                Everything You Need to{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
                  Secure Your Stack
                </span>
              </h2>
              <p className="text-slate-400 max-w-2xl text-lg">
                From automated scanning to AI-powered reporting, SentinelStack provides a complete solution for modern security teams.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, idx) => {
                const Icon = feature.icon;
                return (
                  <Card key={idx} className="bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-all duration-300 group">
                    <CardContent className="p-6">
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.gradient} mb-4`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                        {feature.title}
                      </h3>
                      <p className="text-slate-400">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Security Domains */}
        <section id="domains" className="w-full py-20 md:py-32 bg-slate-900/30">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <Badge variant="outline" className="border-purple-500/30 text-purple-400">Coverage</Badge>
              <h2 className="text-3xl md:text-5xl font-bold text-white">
                Comprehensive Security Coverage
              </h2>
              <p className="text-slate-400 max-w-2xl text-lg">
                Our 30+ integrated tools cover all critical security domains
              </p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {securityDomains.map((domain, idx) => (
                <div 
                  key={idx} 
                  className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-purple-500/50 hover:bg-slate-800 transition-all cursor-default"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-purple-400" />
                    <span className="text-xs text-purple-400 font-medium">{domain.category}</span>
                  </div>
                  <h3 className="text-white font-semibold">{domain.name}</h3>
                </div>
              ))}
            </div>
            
            {/* Compliance Badges */}
            <div className="mt-16 text-center">
              <p className="text-slate-500 text-sm mb-4">Compliance frameworks mapped</p>
              <div className="flex flex-wrap justify-center gap-3">
                {complianceFrameworks.map((framework, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 rounded-full px-4 py-2">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-slate-300">{framework}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="w-full py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <Badge variant="outline" className="border-amber-500/30 text-amber-400">Testimonials</Badge>
              <h2 className="text-3xl md:text-5xl font-bold text-white">
                Loved by Security Teams
              </h2>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {testimonials.map((testimonial, idx) => (
                <Card key={idx} className="bg-slate-900/50 border-slate-800">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-slate-300 mb-6 italic">
                      &ldquo;{testimonial.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                        {testimonial.author.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{testimonial.author}</p>
                        <p className="text-sm text-slate-400">{testimonial.role}, {testimonial.company}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section id="pricing" className="w-full py-20 md:py-32 bg-slate-900/30">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center space-y-4 mb-16">
              <Badge variant="outline" className="border-green-500/30 text-green-400">Pricing</Badge>
              <h2 className="text-3xl md:text-5xl font-bold text-white">
                Simple, Transparent Pricing
              </h2>
              <p className="text-slate-400 max-w-2xl text-lg">
                Start free and scale as you grow. No hidden fees.
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {pricingTiers.map((tier, idx) => (
                <Card 
                  key={idx} 
                  className={`relative ${
                    tier.featured 
                      ? 'bg-gradient-to-b from-cyan-500/10 to-blue-600/10 border-cyan-500/50 scale-105' 
                      : 'bg-slate-900/50 border-slate-800'
                  }`}
                >
                  {tier.featured && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardContent className="p-6 pt-8">
                    <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                    <p className="text-sm text-slate-400 mb-4">{tier.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-bold text-white">{tier.price}</span>
                      <span className="text-slate-400">{tier.period}</span>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature, fIdx) => (
                        <li key={fIdx} className="flex items-center gap-2 text-sm text-slate-300">
                          <CheckCircle className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button 
                      asChild 
                      className={`w-full ${
                        tier.featured 
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white' 
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      <Link href={tier.href}>{tier.cta}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <div className="text-center mt-8">
              <Link href="/pricing" className="text-cyan-400 hover:text-cyan-300 text-sm underline">
                View full pricing details →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="w-full py-20 md:py-32">
          <div className="container px-4 md:px-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-cyan-500 to-blue-600 p-8 md:p-16">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20" />
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
              
              <div className="relative flex flex-col items-center text-center space-y-6">
                <h2 className="text-3xl md:text-5xl font-bold text-white">
                  Ready to Secure Your Applications?
                </h2>
                <p className="text-lg text-white/80 max-w-2xl">
                  Join 500+ security teams who trust SentinelStack for their security assessments. 
                  Start your free trial today.
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-white/90 font-semibold px-8 h-12">
                    <Link href="/signup">
                      Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 h-12">
                    <Link href="/login">
                      Contact Sales
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-white/60">
                  No credit card required • 14-day free trial • Cancel anytime
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
