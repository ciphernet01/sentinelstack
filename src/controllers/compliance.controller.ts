import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { complianceService, COMPLIANCE_BADGES_META } from '../services/compliance.service';
import { ComplianceType } from '@prisma/client';

// Get all badges for organization
export async function listBadges(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' });
    }
    const badges = await complianceService.list(organizationId);
    res.json({ badges });
  } catch (error) {
    next(error);
  }
}

// Get badge metadata (types, icons, descriptions)
export async function getBadgeTypes(_req: Request, res: Response) {
  res.json({ types: COMPLIANCE_BADGES_META });
}

// Get public badges for an organization
export async function listPublicBadges(req: Request, res: Response, next: NextFunction) {
  try {
    const { organizationId } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }
    const badges = await complianceService.listPublic(organizationId);
    res.json({ badges });
  } catch (error) {
    next(error);
  }
}

// Get trust page data (public)
export async function getTrustPage(req: Request, res: Response, next: NextFunction) {
  try {
    const { organizationId } = req.params;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }
    const data = await complianceService.getTrustPageData(organizationId);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

// Get single badge
export async function getBadge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' });
    }
    const { id } = req.params;
    
    const badge = await complianceService.getById(id, organizationId);
    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }
    
    res.json({ badge });
  } catch (error) {
    next(error);
  }
}

// Create badge
export async function createBadge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' });
    }
    const { type, name, description, isVerified, verifiedAt, verificationUrl, certificateUrl, issuedAt, expiresAt, badgeImageUrl, displayOnPublicPage, displayOrder } = req.body;
    
    if (!type || !Object.keys(ComplianceType).includes(type)) {
      return res.status(400).json({ error: 'Valid compliance type required' });
    }
    
    const badge = await complianceService.create(organizationId, {
      type: type as ComplianceType,
      name,
      description,
      isVerified,
      verifiedAt: verifiedAt ? new Date(verifiedAt) : null,
      verificationUrl,
      certificateUrl,
      issuedAt: issuedAt ? new Date(issuedAt) : null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      badgeImageUrl,
      displayOnPublicPage,
      displayOrder,
    });
    
    res.status(201).json({ badge });
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
}

// Update badge
export async function updateBadge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' });
    }
    const { id } = req.params;
    const { name, description, isVerified, verifiedAt, verificationUrl, certificateUrl, issuedAt, expiresAt, badgeImageUrl, displayOnPublicPage, displayOrder } = req.body;
    
    const badge = await complianceService.update(id, organizationId, {
      name,
      description,
      isVerified,
      verifiedAt: verifiedAt ? new Date(verifiedAt) : undefined,
      verificationUrl,
      certificateUrl,
      issuedAt: issuedAt ? new Date(issuedAt) : undefined,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      badgeImageUrl,
      displayOnPublicPage,
      displayOrder,
    });
    
    if (!badge) {
      return res.status(404).json({ error: 'Badge not found' });
    }
    
    res.json({ badge });
  } catch (error) {
    next(error);
  }
}

// Delete badge
export async function deleteBadge(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' });
    }
    const { id } = req.params;
    
    const deleted = await complianceService.delete(id, organizationId);
    if (!deleted) {
      return res.status(404).json({ error: 'Badge not found' });
    }
    
    res.json({ message: 'Badge deleted' });
  } catch (error) {
    next(error);
  }
}

// Reorder badges
export async function reorderBadges(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' });
    }
    const { badgeIds } = req.body;
    
    if (!Array.isArray(badgeIds)) {
      return res.status(400).json({ error: 'badgeIds array required' });
    }
    
    const badges = await complianceService.reorder(organizationId, badgeIds);
    res.json({ badges });
  } catch (error) {
    next(error);
  }
}

// Get compliance stats
export async function getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const organizationId = req.user!.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization' });
    }
    const stats = await complianceService.getComplianceStats(organizationId);
    res.json({ stats });
  } catch (error) {
    next(error);
  }
}
