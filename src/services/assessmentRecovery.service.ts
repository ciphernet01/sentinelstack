import { prisma } from '../config/db';
import logger from '../utils/logger';

const envTruthy = (name: string, defaultValue: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(raw).trim().toLowerCase());
};

/**
 * Our scan worker is in-memory (not a persistent job queue).
 * If the backend process/container restarts mid-scan, any IN_PROGRESS assessments become orphaned.
 *
 * This helper marks orphaned IN_PROGRESS assessments as REJECTED on startup so the UI doesn't
 * show them stuck forever.
 */
export const recoverOrphanedInProgressAssessments = async (): Promise<void> => {
  const enabled = envTruthy('ASSESSMENT_RECOVERY_ENABLED', true);
  if (!enabled) return;

  const onlyStale = envTruthy('ASSESSMENT_RECOVER_ONLY_STALE', false);
  const staleMs = Number(process.env.ASSESSMENT_STALE_MS || 10 * 60 * 1000);
  const cutoff = new Date(Date.now() - staleMs);

  try {
    // Also unlock scan jobs that were RUNNING when the process died.
    // We keep this simple: any RUNNING job older than staleMs gets re-queued.
    try {
      const unlocked = await prisma.scanJob.updateMany({
        where: {
          status: 'RUNNING',
          lockedAt: { lt: cutoff },
        },
        data: {
          status: 'QUEUED',
          lockedAt: null,
          lockedBy: null,
          runAt: new Date(),
        },
      });
      if (unlocked.count > 0) {
        logger.warn(`Re-queued ${unlocked.count} stale RUNNING scan job(s) after restart.`);
      }
    } catch (e) {
      logger.warn(`Scan job recovery skipped due to error: ${String(e)}`);
    }

    const where = onlyStale
      ? { status: 'IN_PROGRESS' as const, updatedAt: { lt: cutoff } }
      : { status: 'IN_PROGRESS' as const };

    const candidates = await prisma.assessment.findMany({
      where,
      select: { id: true, name: true, notes: true, updatedAt: true },
      orderBy: { updatedAt: 'asc' },
    });

    if (candidates.length === 0) {
      return;
    }

    logger.warn(
      `Recovering ${candidates.length} orphaned IN_PROGRESS assessment(s) (onlyStale=${onlyStale}, staleMs=${staleMs}).`,
    );

    for (const a of candidates) {
      const job = await prisma.scanJob.findUnique({
        where: { assessmentId: a.id },
        select: { status: true },
      });

      const priorNotes = a.notes ? `${a.notes}\n` : '';
      const hasRunnableJob = job && (job.status === 'QUEUED' || job.status === 'RUNNING');
      const recoveryNote = hasRunnableJob
        ? `[system] Assessment was running when backend restarted; scan re-queued. (lastUpdated=${a.updatedAt.toISOString()})`
        : `[system] Assessment was running when backend restarted; marking as REJECTED. (lastUpdated=${a.updatedAt.toISOString()})`;

      await prisma.assessment.update({
        where: { id: a.id },
        data: {
          status: hasRunnableJob ? 'PENDING' : 'REJECTED',
          notes: `${priorNotes}${recoveryNote}`,
        },
      });

      await prisma.finding.createMany({
        data: [
          {
            assessmentId: a.id,
            toolName: 'worker',
            title: 'Assessment interrupted by backend restart',
            description:
              'The backend process restarted while this assessment was running, so the background scan worker did not complete. The assessment was marked as REJECTED to avoid showing a stuck IN_PROGRESS status.',
            severity: 'INFO',
            remediation:
              'Create a new assessment (or rerun) once the backend is stable. If using Docker, avoid rebuilding/restarting during long enterprise scans.',
            evidence: {
              recoveredAt: new Date().toISOString(),
              recoveryMode: onlyStale ? 'stale-only' : 'all',
              staleMs,
              lastUpdatedAt: a.updatedAt.toISOString(),
            } as any,
            complianceMapping: [],
          },
        ],
        skipDuplicates: true,
      });
    }
  } catch (err) {
    logger.warn(`Assessment recovery skipped due to error: ${String(err)}`);
  }
};
