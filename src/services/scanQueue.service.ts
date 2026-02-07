import { prisma } from '../config/db';
import logger from '../utils/logger';
import { startAssessmentWorker } from './worker.service';

const envNumber = (name: string, defaultValue: number): number => {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const envTruthy = (name: string, defaultValue: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(raw).trim().toLowerCase());
};

export class ScanQueueService {
  async getQueueStats() {
    const now = new Date();

    const grouped = await prisma.scanJob.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    const counts = grouped.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});

    const runnableQueued = await prisma.scanJob.count({
      where: { status: 'QUEUED', runAt: { lte: now } },
    });

    const oldestQueued = await prisma.scanJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: [{ runAt: 'asc' }, { createdAt: 'asc' }],
      select: { runAt: true, createdAt: true },
    });

    const oldestQueuedAgeSeconds = oldestQueued
      ? Math.max(0, Math.floor((now.getTime() - oldestQueued.runAt.getTime()) / 1000))
      : 0;

    return {
      now: now.toISOString(),
      counts,
      runnableQueued,
      oldestQueuedAgeSeconds,
    };
  }

  async enqueueForAssessment(assessmentId: string, options?: { priority?: number; maxAttempts?: number }) {
    const priority = options?.priority ?? 0;
    const maxAttempts = options?.maxAttempts ?? envNumber('SCAN_JOB_MAX_ATTEMPTS', 3);

    // One job per assessment; if it already exists, keep existing status.
    return prisma.scanJob.upsert({
      where: { assessmentId },
      create: {
        assessmentId,
        priority,
        maxAttempts,
        status: 'QUEUED',
        runAt: new Date(),
      },
      update: {
        priority,
        maxAttempts,
        // If a job failed earlier, allow re-queue by setting status back to QUEUED.
        status: 'QUEUED',
        runAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async cancelForAssessment(assessmentId: string) {
    return prisma.scanJob.update({
      where: { assessmentId },
      data: {
        status: 'CANCELED',
        lockedAt: null,
        lockedBy: null,
        runAt: new Date(8640000000000000), // effectively never
      },
    });
  }

  /**
   * Claims the next runnable job. Uses an atomic update to avoid double-claims.
   */
  async claimNext(lockId: string) {
    const now = new Date();

    // Find a candidate job first (cheap), then claim it (atomic).
    const candidate = await prisma.scanJob.findFirst({
      where: {
        status: 'QUEUED',
        runAt: { lte: now },
      },
      orderBy: [{ priority: 'desc' }, { runAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    if (!candidate) return null;

    const claimed = await prisma.scanJob.updateMany({
      where: {
        id: candidate.id,
        status: 'QUEUED',
        runAt: { lte: now },
        lockedAt: null,
      },
      data: {
        status: 'RUNNING',
        lockedAt: now,
        lockedBy: lockId,
        attemptCount: { increment: 1 },
      },
    });

    if (claimed.count !== 1) return null;

    return prisma.scanJob.findUnique({
      where: { id: candidate.id },
      include: {
        assessment: {
          select: {
            id: true,
            targetUrl: true,
            toolPreset: true,
            authorizationConfirmed: true,
            scannerConfig: true,
            status: true,
          },
        },
      },
    });
  }

  async markCompleted(jobId: string) {
    return prisma.scanJob.update({
      where: { id: jobId },
      data: {
        status: 'COMPLETED',
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
  }

  async markFailed(jobId: string, errorMessage: string) {
    const job = await prisma.scanJob.findUnique({ where: { id: jobId } });
    if (!job) return null;

    const shouldRetry = job.attemptCount < job.maxAttempts;
    const backoffSeconds = Math.min(60 * 10, 15 * Math.pow(2, Math.max(0, job.attemptCount - 1))); // 15s,30s,60s,...capped
    const nextRunAt = new Date(Date.now() + backoffSeconds * 1000);

    return prisma.scanJob.update({
      where: { id: jobId },
      data: {
        status: shouldRetry ? 'QUEUED' : 'FAILED',
        runAt: shouldRetry ? nextRunAt : job.runAt,
        lockedAt: null,
        lockedBy: null,
        lastError: errorMessage.slice(0, 5000),
      },
    });
  }

  /**
   * Starts a simple polling worker in-process.
   * In production you can run it in the API process or a separate worker process.
   */
  startWorkerLoop() {
    const enabled = envTruthy('SCAN_QUEUE_WORKER_ENABLED', true);
    if (!enabled) {
      logger.info('[SCAN_QUEUE] Worker disabled via SCAN_QUEUE_WORKER_ENABLED=false');
      return;
    }

    const lockId = process.env.SCAN_QUEUE_WORKER_ID || `worker-${process.pid}`;
    const pollMs = envNumber('SCAN_QUEUE_POLL_MS', 2000);
    const concurrency = envNumber('SCAN_QUEUE_CONCURRENCY', 1);

    logger.info(`[SCAN_QUEUE] Worker starting (id=${lockId}, pollMs=${pollMs}, concurrency=${concurrency})`);

    // Periodic queue health log for ops visibility.
    // Defaults to on (every 5 minutes) while worker is enabled.
    const statsLogEnabled = envTruthy('SCAN_QUEUE_STATS_LOG_ENABLED', true);
    const statsLogMs = envNumber('SCAN_QUEUE_STATS_LOG_MS', 5 * 60 * 1000);
    if (statsLogEnabled && statsLogMs > 0) {
      const statsTimer = setInterval(() => {
        this.getQueueStats()
          .then((stats) => {
            logger.info(
              `[SCAN_QUEUE] Stats queued=${stats.counts.QUEUED || 0} running=${stats.counts.RUNNING || 0} failed=${stats.counts.FAILED || 0} runnableQueued=${stats.runnableQueued} oldestQueuedAgeSec=${stats.oldestQueuedAgeSeconds}`,
            );
          })
          .catch((e) => logger.warn(`[SCAN_QUEUE] Stats error: ${String(e)}`));
      }, statsLogMs);

      const unrefStatsTimer = envTruthy('SCAN_QUEUE_STATS_TIMER_UNREF', true);
      if (unrefStatsTimer) statsTimer.unref?.();
    }

    let active = 0;

    const tick = async () => {
      if (active >= concurrency) return;

      const job = await this.claimNext(lockId);
      if (!job) return;

      active += 1;

      (async () => {
        try {
          const assessment = job.assessment;
          if (!assessment) {
            throw new Error('Job missing assessment relation');
          }

          // Scope is stored in scannerConfig today; fall back to 'WEB'.
          const scope = (assessment.scannerConfig as any)?.scope || 'WEB';
          const scanOptions = (assessment.scannerConfig as any)?.scanOptions || {};

          await startAssessmentWorker(
            assessment.id,
            assessment.targetUrl,
            scope,
            assessment.toolPreset,
            Boolean(assessment.authorizationConfirmed),
            scanOptions,
          );

          await this.markCompleted(job.id);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          logger.error(`[SCAN_QUEUE] Job failed id=${job.id}: ${msg}`);
          await this.markFailed(job.id, msg);
        } finally {
          active -= 1;
        }
      })().catch(() => {
        // swallow
      });
    };

    const timer = setInterval(() => {
      tick().catch((e) => logger.warn(`[SCAN_QUEUE] Tick error: ${String(e)}`));
    }, pollMs);

    // In a dedicated worker process, an unref'd timer may allow the process to exit.
    // Only unref when explicitly requested.
    const unrefTimer = envTruthy('SCAN_QUEUE_TIMER_UNREF', false);
    if (unrefTimer) timer.unref?.();
  }
}

export const scanQueueService = new ScanQueueService();
