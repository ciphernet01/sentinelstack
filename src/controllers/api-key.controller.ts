import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { apiKeyService } from '../services/api-key.service';
import { ApiScope } from '@prisma/client';

const VALID_SCOPES: ApiScope[] = ['READ_ASSESSMENTS', 'WRITE_ASSESSMENTS', 'READ_REPORTS', 'WRITE_WEBHOOKS', 'READ_WEBHOOKS', 'ADMIN'];

class ApiKeyController {
  
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const apiKeys = await apiKeyService.list(organizationId);
      
      // Don't expose key hashes
      const safeKeys = apiKeys.map(({ keyHash, ...key }) => key);
      
      res.json({ apiKeys: safeKeys });
    } catch (error) {
      next(error);
    }
  }
  
  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const apiKey = await apiKeyService.getById(id, organizationId);
      if (!apiKey) {
        return res.status(404).json({ message: 'API key not found.' });
      }
      
      // Don't expose key hash
      const { keyHash, ...safeKey } = apiKey;
      
      res.json({ apiKey: safeKey });
    } catch (error) {
      next(error);
    }
  }
  
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const { name, scopes, expiresAt } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Name is required.' });
      }
      
      // Validate scopes
      const selectedScopes = scopes && Array.isArray(scopes) 
        ? scopes.filter((s: string) => VALID_SCOPES.includes(s as ApiScope))
        : ['READ_ASSESSMENTS'];
      
      if (selectedScopes.length === 0) {
        return res.status(400).json({ message: 'At least one valid scope is required.' });
      }
      
      // Parse expiration date if provided
      let parsedExpiry: Date | undefined;
      if (expiresAt) {
        parsedExpiry = new Date(expiresAt);
        if (isNaN(parsedExpiry.getTime())) {
          return res.status(400).json({ message: 'Invalid expiration date.' });
        }
        if (parsedExpiry < new Date()) {
          return res.status(400).json({ message: 'Expiration date must be in the future.' });
        }
      }
      
      const apiKey = await apiKeyService.create({
        name,
        scopes: selectedScopes as ApiScope[],
        expiresAt: parsedExpiry,
        organizationId,
        createdById: req.user!.id,
      });
      
      // Return the plain key (only shown once)
      const { keyHash, ...safeKey } = apiKey;
      
      res.status(201).json({ 
        apiKey: safeKey,
        message: 'API key created. Save the key now - it will not be shown again.'
      });
    } catch (error) {
      next(error);
    }
  }
  
  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const { name, scopes, enabled, expiresAt } = req.body;
      
      // Validate scopes if provided
      let validatedScopes: ApiScope[] | undefined;
      if (scopes && Array.isArray(scopes)) {
        validatedScopes = scopes.filter((s: string) => VALID_SCOPES.includes(s as ApiScope)) as ApiScope[];
        if (validatedScopes.length === 0) {
          return res.status(400).json({ message: 'At least one valid scope is required.' });
        }
      }
      
      const apiKey = await apiKeyService.update(id, organizationId, {
        name,
        scopes: validatedScopes,
        enabled,
        expiresAt: expiresAt === null ? null : (expiresAt ? new Date(expiresAt) : undefined),
      });
      
      if (!apiKey) {
        return res.status(404).json({ message: 'API key not found.' });
      }
      
      const { keyHash, ...safeKey } = apiKey;
      res.json({ apiKey: safeKey });
    } catch (error) {
      next(error);
    }
  }
  
  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const deleted = await apiKeyService.delete(id, organizationId);
      if (!deleted) {
        return res.status(404).json({ message: 'API key not found.' });
      }
      
      res.json({ message: 'API key deleted.' });
    } catch (error) {
      next(error);
    }
  }
  
  async revoke(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const apiKey = await apiKeyService.revoke(id, organizationId);
      if (!apiKey) {
        return res.status(404).json({ message: 'API key not found.' });
      }
      
      res.json({ message: 'API key revoked.', apiKey });
    } catch (error) {
      next(error);
    }
  }
}

export const apiKeyController = new ApiKeyController();
