import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { webhookService } from '../services/webhook.service';
import { WebhookEvent } from '@prisma/client';

class WebhookController {
  
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const webhooks = await webhookService.list(organizationId);
      res.json({ webhooks });
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
      
      const webhook = await webhookService.getById(id, organizationId);
      if (!webhook) {
        return res.status(404).json({ message: 'Webhook not found.' });
      }
      
      res.json({ webhook });
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
      
      const { name, url, events } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ message: 'Name and URL are required.' });
      }
      
      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: 'Invalid URL format.' });
      }
      
      // Validate events
      const validEvents: WebhookEvent[] = ['SCAN_COMPLETED', 'SCAN_FAILED', 'CRITICAL_FINDING', 'SCHEDULED_SCAN_RUN'];
      const selectedEvents = events && Array.isArray(events) 
        ? events.filter((e: string) => validEvents.includes(e as WebhookEvent))
        : ['SCAN_COMPLETED'];
      
      if (selectedEvents.length === 0) {
        return res.status(400).json({ message: 'At least one valid event is required.' });
      }
      
      const webhook = await webhookService.create({
        name,
        url,
        events: selectedEvents as WebhookEvent[],
        organizationId,
        createdById: req.user!.id,
      });
      
      res.status(201).json({ webhook });
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
      
      const { name, url, events, enabled } = req.body;
      
      // Validate URL if provided
      if (url) {
        try {
          new URL(url);
        } catch {
          return res.status(400).json({ message: 'Invalid URL format.' });
        }
      }
      
      const webhook = await webhookService.update(id, organizationId, {
        name,
        url,
        events: events as WebhookEvent[] | undefined,
        enabled,
      });
      
      if (!webhook) {
        return res.status(404).json({ message: 'Webhook not found.' });
      }
      
      res.json({ webhook });
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
      
      const deleted = await webhookService.delete(id, organizationId);
      if (!deleted) {
        return res.status(404).json({ message: 'Webhook not found.' });
      }
      
      res.json({ message: 'Webhook deleted.', webhook: deleted });
    } catch (error) {
      next(error);
    }
  }
  
  async toggle(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ message: 'enabled must be a boolean.' });
      }
      
      const webhook = await webhookService.toggle(id, organizationId, enabled);
      if (!webhook) {
        return res.status(404).json({ message: 'Webhook not found.' });
      }
      
      res.json({ webhook });
    } catch (error) {
      next(error);
    }
  }
  
  async regenerateSecret(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const webhook = await webhookService.regenerateSecret(id, organizationId);
      if (!webhook) {
        return res.status(404).json({ message: 'Webhook not found.' });
      }
      
      res.json({ webhook, message: 'Secret regenerated successfully.' });
    } catch (error) {
      next(error);
    }
  }
  
  async test(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const result = await webhookService.test(id, organizationId);
      if (!result) {
        return res.status(404).json({ message: 'Webhook not found.' });
      }
      
      res.json({ 
        success: result.success,
        statusCode: result.statusCode,
        responseTime: result.responseTime,
        message: result.success ? 'Test webhook sent successfully.' : 'Test webhook failed.',
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getDeliveries(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const organizationId = req.user!.organizationId;
      
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const deliveries = await webhookService.getDeliveries(id, organizationId);
      if (!deliveries) {
        return res.status(404).json({ message: 'Webhook not found.' });
      }
      
      res.json({ deliveries });
    } catch (error) {
      next(error);
    }
  }
}

export const webhookController = new WebhookController();
