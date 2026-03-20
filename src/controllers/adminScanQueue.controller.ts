import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { scanQueueService } from '../services/scanQueue.service';

export class AdminScanQueueController {
  async getQueueStats(req: AuthenticatedRequest, res: Response) {
    const stats = await scanQueueService.getQueueStats();
    res.json(stats);
  }
}

export const adminScanQueueController = new AdminScanQueueController();
