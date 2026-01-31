import { prisma } from '../config/db';
import { ScheduleType } from '@prisma/client';
import logger from '../utils/logger';

// Schedule type to cron expression mapping
const SCHEDULE_CRON: Record<ScheduleType, string> = {
  DAILY: '0 0 * * *',      // Every day at midnight
  WEEKLY: '0 0 * * 0',     // Every Sunday at midnight
  BIWEEKLY: '0 0 1,15 * *', // 1st and 15th of month
  MONTHLY: '0 0 1 * *',    // 1st of every month
};

// Calculate next run time based on schedule type
function calculateNextRunAt(scheduleType: ScheduleType, timezone: string = 'UTC'): Date {
  const now = new Date();
  const nextRun = new Date(now);
  
  switch (scheduleType) {
    case 'DAILY':
      nextRun.setDate(nextRun.getDate() + 1);
      nextRun.setHours(0, 0, 0, 0);
      break;
    case 'WEEKLY':
      const daysUntilSunday = (7 - nextRun.getDay()) % 7 || 7;
      nextRun.setDate(nextRun.getDate() + daysUntilSunday);
      nextRun.setHours(0, 0, 0, 0);
      break;
    case 'BIWEEKLY':
      const day = nextRun.getDate();
      if (day < 15) {
        nextRun.setDate(15);
      } else {
        nextRun.setMonth(nextRun.getMonth() + 1, 1);
      }
      nextRun.setHours(0, 0, 0, 0);
      break;
    case 'MONTHLY':
      nextRun.setMonth(nextRun.getMonth() + 1, 1);
      nextRun.setHours(0, 0, 0, 0);
      break;
  }
  
  return nextRun;
}

class ScheduledScanService {
  
  async create(data: {
    name: string;
    targetUrl: string;
    toolPreset: string;
    scheduleType: ScheduleType;
    timezone?: string;
    organizationId: string;
    createdById: string;
  }) {
    const schedule = SCHEDULE_CRON[data.scheduleType];
    const nextRunAt = calculateNextRunAt(data.scheduleType, data.timezone);
    
    const scheduledScan = await prisma.scheduledScan.create({
      data: {
        name: data.name,
        targetUrl: data.targetUrl,
        toolPreset: data.toolPreset,
        schedule,
        scheduleType: data.scheduleType,
        timezone: data.timezone || 'UTC',
        nextRunAt,
        organizationId: data.organizationId,
        createdById: data.createdById,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
    
    logger.info(`Created scheduled scan: ${scheduledScan.id} for org ${data.organizationId}`);
    return scheduledScan;
  }
  
  async list(organizationId: string) {
    return prisma.scheduledScan.findMany({
      where: { organizationId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  
  async getById(id: string, organizationId: string) {
    return prisma.scheduledScan.findFirst({
      where: { id, organizationId },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
  
  async update(
    id: string,
    organizationId: string,
    data: {
      name?: string;
      targetUrl?: string;
      toolPreset?: string;
      scheduleType?: ScheduleType;
      timezone?: string;
      enabled?: boolean;
    }
  ) {
    const existing = await this.getById(id, organizationId);
    if (!existing) return null;
    
    const updateData: any = { ...data };
    
    // If schedule type changed, update cron and next run
    if (data.scheduleType && data.scheduleType !== existing.scheduleType) {
      updateData.schedule = SCHEDULE_CRON[data.scheduleType];
      updateData.nextRunAt = calculateNextRunAt(data.scheduleType, data.timezone || existing.timezone);
    }
    
    return prisma.scheduledScan.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
  
  async delete(id: string, organizationId: string) {
    const existing = await this.getById(id, organizationId);
    if (!existing) return null;
    
    await prisma.scheduledScan.delete({ where: { id } });
    logger.info(`Deleted scheduled scan: ${id}`);
    return existing;
  }
  
  async toggle(id: string, organizationId: string, enabled: boolean) {
    const existing = await this.getById(id, organizationId);
    if (!existing) return null;
    
    const updateData: any = { enabled };
    
    // If re-enabling, recalculate next run time
    if (enabled && !existing.enabled) {
      updateData.nextRunAt = calculateNextRunAt(existing.scheduleType, existing.timezone);
    }
    
    return prisma.scheduledScan.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
  
  // Get scans that are due to run (for cron job)
  async getDueScans() {
    const now = new Date();
    return prisma.scheduledScan.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      include: {
        organization: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
  
  // Mark scan as run and calculate next run time
  async markAsRun(id: string) {
    const scan = await prisma.scheduledScan.findUnique({ where: { id } });
    if (!scan) return null;
    
    const nextRunAt = calculateNextRunAt(scan.scheduleType, scan.timezone);
    
    return prisma.scheduledScan.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        nextRunAt,
        runCount: { increment: 1 },
      },
    });
  }
}

export const scheduledScanService = new ScheduledScanService();
