import { prisma } from '../config/db';
import { WebhookEvent } from '@prisma/client';
import crypto from 'crypto';
import logger from '../utils/logger';

interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
}

class WebhookService {
  
  /**
   * List webhooks for an organization
   */
  async list(organizationId: string) {
    return prisma.webhook.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { deliveries: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  /**
   * Get a single webhook by ID
   */
  async getById(id: string, organizationId: string) {
    return prisma.webhook.findFirst({
      where: { id, organizationId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
  }
  
  /**
   * Create a new webhook
   */
  async create(data: {
    name: string;
    url: string;
    events: WebhookEvent[];
    organizationId: string;
    createdById: string;
  }) {
    // Generate a secret for HMAC signing
    const secret = crypto.randomBytes(32).toString('hex');
    
    return prisma.webhook.create({
      data: {
        name: data.name,
        url: data.url,
        secret,
        events: data.events,
        organizationId: data.organizationId,
        createdById: data.createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
      },
    });
  }
  
  /**
   * Update a webhook
   */
  async update(id: string, organizationId: string, data: {
    name?: string;
    url?: string;
    events?: WebhookEvent[];
    enabled?: boolean;
  }) {
    const webhook = await prisma.webhook.findFirst({
      where: { id, organizationId },
    });
    
    if (!webhook) return null;
    
    return prisma.webhook.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.url && { url: data.url }),
        ...(data.events && { events: data.events }),
        ...(typeof data.enabled === 'boolean' && { enabled: data.enabled }),
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
      },
    });
  }
  
  /**
   * Delete a webhook
   */
  async delete(id: string, organizationId: string) {
    const webhook = await prisma.webhook.findFirst({
      where: { id, organizationId },
    });
    
    if (!webhook) return null;
    
    return prisma.webhook.delete({
      where: { id },
    });
  }
  
  /**
   * Toggle webhook enabled status
   */
  async toggle(id: string, organizationId: string, enabled: boolean) {
    const webhook = await prisma.webhook.findFirst({
      where: { id, organizationId },
    });
    
    if (!webhook) return null;
    
    // Reset failure count when re-enabling
    return prisma.webhook.update({
      where: { id },
      data: {
        enabled,
        ...(enabled && { failureCount: 0 }),
      },
    });
  }
  
  /**
   * Regenerate webhook secret
   */
  async regenerateSecret(id: string, organizationId: string) {
    const webhook = await prisma.webhook.findFirst({
      where: { id, organizationId },
    });
    
    if (!webhook) return null;
    
    const secret = crypto.randomBytes(32).toString('hex');
    
    return prisma.webhook.update({
      where: { id },
      data: { secret },
    });
  }
  
  /**
   * Trigger webhooks for an event
   */
  async trigger(organizationId: string, event: WebhookEvent, data: Record<string, any>) {
    const webhooks = await prisma.webhook.findMany({
      where: {
        organizationId,
        enabled: true,
        events: { has: event },
        failureCount: { lt: 5 }, // Disable after 5 consecutive failures
      },
    });
    
    if (webhooks.length === 0) {
      logger.debug(`No webhooks to trigger for event ${event} in org ${organizationId}`);
      return;
    }
    
    const payload: WebhookPayload = {
      event,
      timestamp: new Date().toISOString(),
      data,
    };
    
    // Fire webhooks in parallel (don't await - fire and forget)
    for (const webhook of webhooks) {
      this.deliverWebhook(webhook.id, webhook.url, webhook.secret, payload)
        .catch(err => logger.error(`Webhook delivery error: ${err.message}`));
    }
    
    logger.info(`Triggered ${webhooks.length} webhooks for event ${event}`);
  }
  
  /**
   * Deliver a webhook payload
   */
  private async deliverWebhook(
    webhookId: string,
    url: string,
    secret: string | null,
    payload: WebhookPayload
  ) {
    const startTime = Date.now();
    const payloadJson = JSON.stringify(payload);
    
    // Create HMAC signature
    const signature = secret
      ? crypto.createHmac('sha256', secret).update(payloadJson).digest('hex')
      : null;
    
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;
    let error: string | null = null;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SentinelStack-Webhook/1.0',
          'X-Webhook-Event': payload.event,
          'X-Webhook-Timestamp': payload.timestamp,
          ...(signature && { 'X-Webhook-Signature': `sha256=${signature}` }),
        },
        body: payloadJson,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      statusCode = response.status;
      responseBody = await response.text().catch(() => null);
      success = response.ok;
      
      if (!success) {
        error = `HTTP ${statusCode}`;
      }
    } catch (err: any) {
      error = err.message || 'Unknown error';
      logger.error(`Webhook delivery failed for ${webhookId}: ${error}`);
    }
    
    const responseTime = Date.now() - startTime;
    
    // Record delivery
    await prisma.webhookDelivery.create({
      data: {
        webhookId,
        event: payload.event,
        payload: payload as any,
        statusCode,
        responseBody: responseBody?.substring(0, 1000), // Limit response body size
        responseTime,
        success,
        error,
      },
    });
    
    // Update webhook status
    await prisma.webhook.update({
      where: { id: webhookId },
      data: {
        lastTriggeredAt: new Date(),
        lastStatus: statusCode,
        failureCount: success ? 0 : { increment: 1 },
      },
    });
    
    return { success, statusCode, responseTime };
  }
  
  /**
   * Get delivery history for a webhook
   */
  async getDeliveries(webhookId: string, organizationId: string, limit = 20) {
    // Verify ownership
    const webhook = await prisma.webhook.findFirst({
      where: { id: webhookId, organizationId },
    });
    
    if (!webhook) return null;
    
    return prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
  
  /**
   * Test a webhook by sending a test payload
   */
  async test(id: string, organizationId: string) {
    const webhook = await prisma.webhook.findFirst({
      where: { id, organizationId },
    });
    
    if (!webhook) return null;
    
    const testPayload: WebhookPayload = {
      event: 'SCAN_COMPLETED' as WebhookEvent,
      timestamp: new Date().toISOString(),
      data: {
        test: true,
        message: 'This is a test webhook from SentinelStack',
        assessment: {
          id: 'test-123',
          name: 'Test Assessment',
          targetUrl: 'https://example.com',
          status: 'completed',
          findings: {
            critical: 0,
            high: 2,
            medium: 5,
            low: 10,
          },
        },
      },
    };
    
    return this.deliverWebhook(webhook.id, webhook.url, webhook.secret, testPayload);
  }
}

export const webhookService = new WebhookService();
