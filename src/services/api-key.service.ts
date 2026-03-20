import { prisma } from '../config/db';
import { ApiScope } from '@prisma/client';
import crypto from 'crypto';
import logger from '../utils/logger';

class ApiKeyService {
  
  /**
   * Generate a new API key
   * Returns the plain key (only shown once) and the created record
   */
  async create(data: {
    name: string;
    scopes: ApiScope[];
    expiresAt?: Date;
    organizationId: string;
    createdById: string;
  }) {
    // Generate a secure random key
    const keyBytes = crypto.randomBytes(32);
    const plainKey = `sk_live_${keyBytes.toString('base64url')}`;
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const keyPrefix = plainKey.substring(0, 12);
    
    const apiKey = await prisma.apiKey.create({
      data: {
        name: data.name,
        keyHash,
        keyPrefix,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
        organizationId: data.organizationId,
        createdById: data.createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
      },
    });
    
    // Return the plain key only on creation (it's never stored)
    return {
      ...apiKey,
      key: plainKey,
    };
  }
  
  /**
   * List API keys for an organization
   */
  async list(organizationId: string) {
    return prisma.apiKey.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  /**
   * Get a single API key by ID
   */
  async getById(id: string, organizationId: string) {
    return prisma.apiKey.findFirst({
      where: { id, organizationId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
      },
    });
  }
  
  /**
   * Validate an API key and return the associated organization
   * Returns null if invalid
   */
  async validateKey(plainKey: string) {
    if (!plainKey || !plainKey.startsWith('sk_live_')) {
      return null;
    }
    
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: {
        organization: true,
        createdBy: {
          select: { id: true, email: true, role: true }
        },
      },
    });
    
    if (!apiKey) {
      return null;
    }
    
    // Check if enabled
    if (!apiKey.enabled) {
      logger.warn(`Disabled API key used: ${apiKey.keyPrefix}...`);
      return null;
    }
    
    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      logger.warn(`Expired API key used: ${apiKey.keyPrefix}...`);
      return null;
    }
    
    // Update usage stats (don't await - fire and forget)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: {
        lastUsedAt: new Date(),
        usageCount: { increment: 1 },
      },
    }).catch(err => logger.error(`Failed to update API key usage: ${err.message}`));
    
    return apiKey;
  }
  
  /**
   * Check if an API key has a specific scope
   */
  hasScope(apiKey: { scopes: ApiScope[] }, requiredScope: ApiScope): boolean {
    // ADMIN scope grants all permissions
    if (apiKey.scopes.includes('ADMIN')) {
      return true;
    }
    return apiKey.scopes.includes(requiredScope);
  }
  
  /**
   * Update an API key
   */
  async update(id: string, organizationId: string, data: {
    name?: string;
    scopes?: ApiScope[];
    enabled?: boolean;
    expiresAt?: Date | null;
  }) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, organizationId },
    });
    
    if (!apiKey) return null;
    
    return prisma.apiKey.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.scopes && { scopes: data.scopes }),
        ...(typeof data.enabled === 'boolean' && { enabled: data.enabled }),
        ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
      },
    });
  }
  
  /**
   * Delete an API key
   */
  async delete(id: string, organizationId: string) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, organizationId },
    });
    
    if (!apiKey) return null;
    
    return prisma.apiKey.delete({
      where: { id },
    });
  }
  
  /**
   * Revoke (disable) an API key
   */
  async revoke(id: string, organizationId: string) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { id, organizationId },
    });
    
    if (!apiKey) return null;
    
    return prisma.apiKey.update({
      where: { id },
      data: { enabled: false },
    });
  }
}

export const apiKeyService = new ApiKeyService();
