import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { brandingService } from '../services/branding.service';

class BrandingController {
  
  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const branding = await brandingService.get(organizationId);
      
      res.json({ branding: branding || null });
    } catch (error) {
      next(error);
    }
  }
  
  async getPublic(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const branding = await brandingService.getPublicBranding(organizationId);
      
      res.json({ branding: branding || null });
    } catch (error) {
      next(error);
    }
  }
  
  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const {
        logoUrl,
        faviconUrl,
        companyName,
        primaryColor,
        secondaryColor,
        accentColor,
        customDomain,
        emailFromName,
        emailReplyTo,
        reportLogoUrl,
        reportFooterText,
        reportHeaderText,
        hidePoweredBy,
      } = req.body;
      
      const branding = await brandingService.upsert(organizationId, {
        logoUrl,
        faviconUrl,
        companyName,
        primaryColor,
        secondaryColor,
        accentColor,
        customDomain,
        emailFromName,
        emailReplyTo,
        reportLogoUrl,
        reportFooterText,
        reportHeaderText,
        hidePoweredBy,
      });
      
      res.json({ branding });
    } catch (error: any) {
      if (error.message?.includes('Invalid') || error.message?.includes('already in use')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }
  
  async verifyDomain(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const result = await brandingService.verifyDomain(organizationId);
      
      res.json(result);
    } catch (error: any) {
      if (error.message?.includes('not found') || error.message?.includes('No custom domain')) {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }
  
  async getVerificationInstructions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const instructions = await brandingService.getVerificationInstructions(organizationId);
      
      if (!instructions) {
        return res.status(400).json({ message: 'No custom domain configured.' });
      }
      
      res.json(instructions);
    } catch (error) {
      next(error);
    }
  }
  
  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const deleted = await brandingService.delete(organizationId);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Branding not found.' });
      }
      
      res.json({ message: 'Branding reset to defaults.' });
    } catch (error) {
      next(error);
    }
  }
}

export const brandingController = new BrandingController();
