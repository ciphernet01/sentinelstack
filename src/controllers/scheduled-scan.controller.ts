import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { scheduledScanService } from '../services/scheduled-scan.service';
import { ScheduleType } from '@prisma/client';

class ScheduledScanController {
  
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const organizationId = req.user!.organizationId;
      if (!organizationId) {
        return res.status(400).json({ message: 'No active organization.' });
      }
      
      const scheduledScans = await scheduledScanService.list(organizationId);
      res.json({ scheduledScans });
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
      
      const scheduledScan = await scheduledScanService.getById(id, organizationId);
      if (!scheduledScan) {
        return res.status(404).json({ message: 'Scheduled scan not found.' });
      }
      
      res.json({ scheduledScan });
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
      
      const { name, targetUrl, toolPreset, scheduleType, timezone } = req.body;
      
      if (!name || !targetUrl || !scheduleType) {
        return res.status(400).json({ message: 'Name, targetUrl, and scheduleType are required.' });
      }
      
      // Validate schedule type
      if (!['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(scheduleType)) {
        return res.status(400).json({ message: 'Invalid scheduleType. Must be DAILY, WEEKLY, BIWEEKLY, or MONTHLY.' });
      }
      
      const scheduledScan = await scheduledScanService.create({
        name,
        targetUrl,
        toolPreset: toolPreset || 'default',
        scheduleType: scheduleType as ScheduleType,
        timezone,
        organizationId,
        createdById: req.user!.id,
      });
      
      res.status(201).json({ scheduledScan });
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
      
      const { name, targetUrl, toolPreset, scheduleType, timezone, enabled } = req.body;
      
      // Validate schedule type if provided
      if (scheduleType && !['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'].includes(scheduleType)) {
        return res.status(400).json({ message: 'Invalid scheduleType.' });
      }
      
      const scheduledScan = await scheduledScanService.update(id, organizationId, {
        name,
        targetUrl,
        toolPreset,
        scheduleType: scheduleType as ScheduleType | undefined,
        timezone,
        enabled,
      });
      
      if (!scheduledScan) {
        return res.status(404).json({ message: 'Scheduled scan not found.' });
      }
      
      res.json({ scheduledScan });
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
      
      const deleted = await scheduledScanService.delete(id, organizationId);
      if (!deleted) {
        return res.status(404).json({ message: 'Scheduled scan not found.' });
      }
      
      res.json({ message: 'Scheduled scan deleted.', scheduledScan: deleted });
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
      
      const scheduledScan = await scheduledScanService.toggle(id, organizationId, enabled);
      if (!scheduledScan) {
        return res.status(404).json({ message: 'Scheduled scan not found.' });
      }
      
      res.json({ scheduledScan });
    } catch (error) {
      next(error);
    }
  }
}

export const scheduledScanController = new ScheduledScanController();
