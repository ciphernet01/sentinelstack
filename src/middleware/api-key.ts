import { Request, Response, NextFunction } from 'express';
import { apiKeyService } from '../services/api-key.service';
import { ApiScope } from '@prisma/client';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    id: string;
    scopes: ApiScope[];
    organizationId: string;
    userId: string;
    userEmail: string;
  };
}

/**
 * Middleware to authenticate requests using API keys
 * Expects header: Authorization: Bearer sk_live_...
 */
export function apiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Missing Authorization header. Use: Authorization: Bearer sk_live_...'
    });
  }
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ 
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Use: Authorization: Bearer sk_live_...'
    });
  }
  
  const apiKey = parts[1];
  
  apiKeyService.validateKey(apiKey)
    .then(validatedKey => {
      if (!validatedKey) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'Invalid or expired API key'
        });
      }
      
      req.apiKey = {
        id: validatedKey.id,
        scopes: validatedKey.scopes,
        organizationId: validatedKey.organizationId,
        userId: validatedKey.createdById,
        userEmail: validatedKey.createdBy.email,
      };
      
      next();
    })
    .catch(err => {
      console.error('API key validation error:', err);
      return res.status(500).json({ 
        error: 'Internal Server Error',
        message: 'Failed to validate API key'
      });
    });
}

/**
 * Middleware to require specific scopes
 */
export function requireScope(...requiredScopes: ApiScope[]) {
  return (req: ApiKeyRequest, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'API key required'
      });
    }
    
    // ADMIN scope grants all permissions
    if (req.apiKey.scopes.includes('ADMIN')) {
      return next();
    }
    
    const hasRequiredScope = requiredScopes.some(scope => 
      req.apiKey!.scopes.includes(scope)
    );
    
    if (!hasRequiredScope) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: `Insufficient permissions. Required scopes: ${requiredScopes.join(' or ')}`
      });
    }
    
    next();
  };
}
