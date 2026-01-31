'use client';

import { useParams } from 'next/navigation';
import { usePublicTrustPage } from '@/hooks/use-compliance';
import { Shield, CheckCircle, ExternalLink, Calendar } from 'lucide-react';
import { ComplianceType } from '@prisma/client';

const BADGE_ICONS: Record<ComplianceType, string> = {
  SOC2_TYPE1: '🛡️',
  SOC2_TYPE2: '🛡️',
  ISO27001: '🔒',
  ISO27017: '☁️',
  ISO27018: '🔐',
  GDPR: '🇪🇺',
  HIPAA: '🏥',
  PCI_DSS: '💳',
  CCPA: '🌴',
  FEDRAMP: '🏛️',
  NIST: '📋',
  CSA_STAR: '⭐',
  CUSTOM: '✅',
};

export default function TrustPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;
  const { data, isLoading, error } = usePublicTrustPage(organizationId);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="animate-pulse text-center">
          <Shield className="h-12 w-12 mx-auto text-slate-400 mb-4" />
          <p className="text-slate-500">Loading trust information...</p>
        </div>
      </div>
    );
  }
  
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto text-slate-400 mb-4" />
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Trust Page Not Found</h1>
          <p className="text-slate-500 mt-2">This organization's trust page is not available.</p>
        </div>
      </div>
    );
  }
  
  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header 
        className="border-b"
        style={{ borderBottomColor: `${data.primaryColor}20` }}
      >
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt={data.companyName} className="h-12 w-auto" />
            ) : (
              <div 
                className="h-12 w-12 rounded-lg flex items-center justify-center text-white text-xl font-bold"
                style={{ backgroundColor: data.primaryColor }}
              >
                {data.companyName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {data.companyName}
              </h1>
              <p className="text-slate-500">Security & Compliance</p>
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4"
            style={{ backgroundColor: `${data.primaryColor}15`, color: data.primaryColor }}
          >
            <Shield className="h-4 w-4" />
            Trust Center
          </div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Our Commitment to Security
          </h2>
          <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            We take security seriously. Below you'll find our current certifications, 
            compliance standards, and security practices.
          </p>
        </div>
        
        {/* Badges Grid */}
        {data.badges.length === 0 ? (
          <div className="text-center py-12">
            <Shield className="h-16 w-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500">No compliance badges published yet.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {data.badges.map((badge) => (
              <div
                key={badge.id}
                className={`bg-white dark:bg-slate-800 rounded-xl border p-6 shadow-sm hover:shadow-md transition-shadow ${
                  isExpired(badge.expiresAt) ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{BADGE_ICONS[badge.type]}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {badge.name}
                      </h3>
                      {badge.isVerified && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                          <CheckCircle className="h-3 w-3" />
                          Verified
                        </span>
                      )}
                      {isExpired(badge.expiresAt) && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                          Expired
                        </span>
                      )}
                    </div>
                    {badge.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        {badge.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      {badge.issuedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Issued: {new Date(badge.issuedAt).toLocaleDateString()}
                        </span>
                      )}
                      {badge.expiresAt && (
                        <span className={`flex items-center gap-1 ${isExpired(badge.expiresAt) ? 'text-red-500' : ''}`}>
                          <Calendar className="h-3 w-3" />
                          Expires: {new Date(badge.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {badge.verificationUrl && (
                      <a
                        href={badge.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium mt-3 hover:underline"
                        style={{ color: data.primaryColor }}
                      >
                        Verify Certificate
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Security Statement */}
        <div className="mt-16 text-center">
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-8">
            <Shield className="h-10 w-10 mx-auto mb-4" style={{ color: data.primaryColor }} />
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
              Questions about our security?
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Contact us for more information about our security practices, 
              to request our security documentation, or to complete a security questionnaire.
            </p>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} {data.companyName}. All rights reserved.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Powered by SentinelStack
          </p>
        </div>
      </footer>
    </div>
  );
}
