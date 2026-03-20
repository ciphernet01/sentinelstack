import { prisma } from '../config/db';
import { ComplianceType } from '@prisma/client';

export interface ComplianceBadgeData {
  type: ComplianceType;
  name: string;
  description?: string | null;
  isVerified?: boolean;
  verifiedAt?: Date | null;
  verificationUrl?: string | null;
  certificateUrl?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  badgeImageUrl?: string | null;
  displayOnPublicPage?: boolean;
  displayOrder?: number;
}

// Badge metadata for UI display
export const COMPLIANCE_BADGES_META: Record<ComplianceType, { name: string; description: string; icon: string }> = {
  SOC2_TYPE1: {
    name: 'SOC 2 Type I',
    description: 'Service Organization Control 2 - Point in time assessment',
    icon: '🛡️',
  },
  SOC2_TYPE2: {
    name: 'SOC 2 Type II',
    description: 'Service Organization Control 2 - Period of time assessment',
    icon: '🛡️',
  },
  ISO27001: {
    name: 'ISO 27001',
    description: 'Information Security Management System certification',
    icon: '🔒',
  },
  ISO27017: {
    name: 'ISO 27017',
    description: 'Cloud Security certification',
    icon: '☁️',
  },
  ISO27018: {
    name: 'ISO 27018',
    description: 'Cloud Privacy certification',
    icon: '🔐',
  },
  GDPR: {
    name: 'GDPR Compliant',
    description: 'General Data Protection Regulation compliance',
    icon: '🇪🇺',
  },
  HIPAA: {
    name: 'HIPAA Compliant',
    description: 'Health Insurance Portability and Accountability Act compliance',
    icon: '🏥',
  },
  PCI_DSS: {
    name: 'PCI DSS',
    description: 'Payment Card Industry Data Security Standard',
    icon: '💳',
  },
  CCPA: {
    name: 'CCPA Compliant',
    description: 'California Consumer Privacy Act compliance',
    icon: '🌴',
  },
  FEDRAMP: {
    name: 'FedRAMP',
    description: 'Federal Risk and Authorization Management Program',
    icon: '🏛️',
  },
  NIST: {
    name: 'NIST Framework',
    description: 'National Institute of Standards and Technology cybersecurity framework',
    icon: '📋',
  },
  CSA_STAR: {
    name: 'CSA STAR',
    description: 'Cloud Security Alliance Security, Trust & Assurance Registry',
    icon: '⭐',
  },
  CUSTOM: {
    name: 'Custom Certification',
    description: 'Custom compliance certification',
    icon: '✅',
  },
};

class ComplianceService {
  
  async list(organizationId: string) {
    return prisma.complianceBadge.findMany({
      where: { organizationId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }
  
  async listPublic(organizationId: string) {
    return prisma.complianceBadge.findMany({
      where: {
        organizationId,
        displayOnPublicPage: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        type: true,
        name: true,
        description: true,
        isVerified: true,
        verifiedAt: true,
        verificationUrl: true,
        issuedAt: true,
        expiresAt: true,
        badgeImageUrl: true,
      },
    });
  }
  
  async getById(id: string, organizationId: string) {
    return prisma.complianceBadge.findFirst({
      where: { id, organizationId },
    });
  }
  
  async create(organizationId: string, data: ComplianceBadgeData) {
    // Check if badge type already exists for this org (unless it's CUSTOM)
    if (data.type !== 'CUSTOM') {
      const existing = await prisma.complianceBadge.findUnique({
        where: {
          organizationId_type: {
            organizationId,
            type: data.type,
          },
        },
      });
      
      if (existing) {
        throw new Error(`A ${COMPLIANCE_BADGES_META[data.type].name} badge already exists for this organization`);
      }
    }
    
    return prisma.complianceBadge.create({
      data: {
        organizationId,
        type: data.type,
        name: data.name || COMPLIANCE_BADGES_META[data.type].name,
        description: data.description,
        isVerified: data.isVerified ?? false,
        verifiedAt: data.verifiedAt,
        verificationUrl: data.verificationUrl,
        certificateUrl: data.certificateUrl,
        issuedAt: data.issuedAt,
        expiresAt: data.expiresAt,
        badgeImageUrl: data.badgeImageUrl,
        displayOnPublicPage: data.displayOnPublicPage ?? true,
        displayOrder: data.displayOrder ?? 0,
      },
    });
  }
  
  async update(id: string, organizationId: string, data: Partial<ComplianceBadgeData>) {
    const badge = await this.getById(id, organizationId);
    if (!badge) {
      return null;
    }
    
    return prisma.complianceBadge.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isVerified: data.isVerified,
        verifiedAt: data.verifiedAt,
        verificationUrl: data.verificationUrl,
        certificateUrl: data.certificateUrl,
        issuedAt: data.issuedAt,
        expiresAt: data.expiresAt,
        badgeImageUrl: data.badgeImageUrl,
        displayOnPublicPage: data.displayOnPublicPage,
        displayOrder: data.displayOrder,
      },
    });
  }
  
  async delete(id: string, organizationId: string) {
    const badge = await this.getById(id, organizationId);
    if (!badge) {
      return false;
    }
    
    await prisma.complianceBadge.delete({ where: { id } });
    return true;
  }
  
  async reorder(organizationId: string, badgeIds: string[]) {
    // Update display order based on array position
    const updates = badgeIds.map((id, index) =>
      prisma.complianceBadge.updateMany({
        where: { id, organizationId },
        data: { displayOrder: index },
      })
    );
    
    await prisma.$transaction(updates);
    return this.list(organizationId);
  }
  
  // Get trust page data for an organization
  async getTrustPageData(organizationId: string) {
    const [badges, branding, org] = await Promise.all([
      this.listPublic(organizationId),
      prisma.organizationBranding.findUnique({
        where: { organizationId },
        select: {
          companyName: true,
          logoUrl: true,
          primaryColor: true,
        },
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
    ]);
    
    return {
      companyName: branding?.companyName || org?.name || 'Organization',
      logoUrl: branding?.logoUrl,
      primaryColor: branding?.primaryColor || '#6366f1',
      badges,
    };
  }
  
  // Get compliance summary stats
  async getComplianceStats(organizationId: string) {
    const badges = await this.list(organizationId);
    
    const now = new Date();
    const stats = {
      total: badges.length,
      verified: badges.filter(b => b.isVerified).length,
      expired: badges.filter(b => b.expiresAt && b.expiresAt < now).length,
      expiringSoon: badges.filter(b => {
        if (!b.expiresAt) return false;
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return b.expiresAt > now && b.expiresAt < thirtyDaysFromNow;
      }).length,
    };
    
    return stats;
  }
}

export const complianceService = new ComplianceService();
