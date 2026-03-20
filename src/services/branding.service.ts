import { prisma } from '../config/db';
import crypto from 'crypto';

export interface BrandingData {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  companyName?: string | null;
  primaryColor?: string;
  secondaryColor?: string | null;
  accentColor?: string | null;
  customDomain?: string | null;
  emailFromName?: string | null;
  emailReplyTo?: string | null;
  reportLogoUrl?: string | null;
  reportFooterText?: string | null;
  reportHeaderText?: string | null;
  hidePoweredBy?: boolean;
}

class BrandingService {
  
  async get(organizationId: string) {
    const branding = await prisma.organizationBranding.findUnique({
      where: { organizationId },
    });
    
    return branding;
  }
  
  async getByDomain(domain: string) {
    const branding = await prisma.organizationBranding.findFirst({
      where: {
        customDomain: domain,
        domainVerified: true,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    return branding;
  }
  
  async upsert(organizationId: string, data: BrandingData) {
    // Validate color formats if provided
    const colorFields = ['primaryColor', 'secondaryColor', 'accentColor'] as const;
    for (const field of colorFields) {
      const color = data[field];
      if (color && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
        throw new Error(`Invalid color format for ${field}. Use hex format (e.g., #6366f1)`);
      }
    }
    
    // Validate email format if provided
    if (data.emailReplyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailReplyTo)) {
      throw new Error('Invalid email format for emailReplyTo');
    }
    
    // Validate domain format if provided
    if (data.customDomain) {
      const domainPattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
      if (!domainPattern.test(data.customDomain)) {
        throw new Error('Invalid domain format');
      }
      
      // Check if domain is already used by another org
      const existingDomain = await prisma.organizationBranding.findFirst({
        where: {
          customDomain: data.customDomain,
          organizationId: { not: organizationId },
        },
      });
      
      if (existingDomain) {
        throw new Error('This domain is already in use by another organization');
      }
    }
    
    const existing = await prisma.organizationBranding.findUnique({
      where: { organizationId },
    });
    
    if (existing) {
      // If domain changed, reset verification
      const domainChanged = data.customDomain !== undefined && 
                           data.customDomain !== existing.customDomain;
      
      return prisma.organizationBranding.update({
        where: { organizationId },
        data: {
          ...data,
          ...(domainChanged && {
            domainVerified: false,
            domainVerifyToken: crypto.randomBytes(32).toString('hex'),
          }),
        },
      });
    }
    
    // Create new branding
    return prisma.organizationBranding.create({
      data: {
        organizationId,
        ...data,
        domainVerifyToken: data.customDomain ? crypto.randomBytes(32).toString('hex') : null,
      },
    });
  }
  
  async verifyDomain(organizationId: string) {
    const branding = await prisma.organizationBranding.findUnique({
      where: { organizationId },
    });
    
    if (!branding) {
      throw new Error('Branding not found');
    }
    
    if (!branding.customDomain) {
      throw new Error('No custom domain configured');
    }
    
    if (branding.domainVerified) {
      return { verified: true, message: 'Domain already verified' };
    }
    
    // In production, you'd actually verify DNS records here
    // For now, we'll simulate verification by checking if the token exists
    // Real implementation would use DNS lookup for TXT record
    
    // Simulated verification - in production, check DNS TXT record
    // The customer would add a TXT record like:
    // _sentinelstack-verify.security.acme.com TXT "verify=abc123..."
    
    const dns = await import('dns').then(m => m.promises);
    
    try {
      const txtRecords = await dns.resolveTxt(`_sentinelstack-verify.${branding.customDomain}`);
      const flatRecords = txtRecords.flat();
      
      const expectedRecord = `sentinelstack-verify=${branding.domainVerifyToken}`;
      const verified = flatRecords.some(record => record === expectedRecord);
      
      if (verified) {
        await prisma.organizationBranding.update({
          where: { organizationId },
          data: { domainVerified: true },
        });
        
        return { verified: true, message: 'Domain verified successfully' };
      }
      
      return { 
        verified: false, 
        message: 'DNS verification failed. Please add the TXT record and try again.',
        expectedRecord,
        recordName: `_sentinelstack-verify.${branding.customDomain}`,
      };
    } catch (error: any) {
      // DNS lookup failed - record doesn't exist yet
      return {
        verified: false,
        message: 'DNS record not found. Please add the TXT record and try again.',
        expectedRecord: `sentinelstack-verify=${branding.domainVerifyToken}`,
        recordName: `_sentinelstack-verify.${branding.customDomain}`,
      };
    }
  }
  
  async getVerificationInstructions(organizationId: string) {
    const branding = await prisma.organizationBranding.findUnique({
      where: { organizationId },
    });
    
    if (!branding?.customDomain || !branding.domainVerifyToken) {
      return null;
    }
    
    return {
      domain: branding.customDomain,
      verified: branding.domainVerified,
      instructions: {
        recordType: 'TXT',
        recordName: `_sentinelstack-verify.${branding.customDomain}`,
        recordValue: `sentinelstack-verify=${branding.domainVerifyToken}`,
        note: 'Add this TXT record to your DNS settings. Verification may take up to 24 hours to propagate.',
      },
    };
  }
  
  async delete(organizationId: string) {
    const deleted = await prisma.organizationBranding.deleteMany({
      where: { organizationId },
    });
    
    return deleted.count > 0;
  }
  
  // Get public branding (safe for client-side)
  async getPublicBranding(organizationId: string) {
    const branding = await this.get(organizationId);
    
    if (!branding) {
      return null;
    }
    
    // Only return public-safe fields
    return {
      logoUrl: branding.logoUrl,
      faviconUrl: branding.faviconUrl,
      companyName: branding.companyName,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      hidePoweredBy: branding.hidePoweredBy,
    };
  }
}

export const brandingService = new BrandingService();
