import { initializeFirebaseAdmin } from './config/firebase';
import logger from './utils/logger';
import { recoverOrphanedInProgressAssessments } from './services/assessmentRecovery.service';
import { scanQueueService } from './services/scanQueue.service';

// Some parts of the backend expect Firebase Admin to be initialized.
initializeFirebaseAdmin();

logger.info(
  `[WORKER] Boot pid=${process.pid} node=${process.version} service=${process.env.RENDER_SERVICE_NAME || 'unknown'} commit=${process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown'} instance=${process.env.RENDER_INSTANCE_ID || 'unknown'}`,
);

// Best-effort recovery for scans that were running during a restart.
recoverOrphanedInProgressAssessments().catch((e) => {
  logger.warn(`Failed to run assessment recovery: ${String(e)}`);
});

// Start the DB-backed scan queue worker loop.
scanQueueService.startWorkerLoop();

logger.info('[WORKER] Scan worker process started');
