import { initializeFirebaseAdmin } from './config/firebase';
import logger from './utils/logger';
import { recoverOrphanedInProgressAssessments } from './services/assessmentRecovery.service';
import { scanQueueService } from './services/scanQueue.service';

// Some parts of the backend expect Firebase Admin to be initialized.
initializeFirebaseAdmin();

// Best-effort recovery for scans that were running during a restart.
recoverOrphanedInProgressAssessments().catch((e) => {
  logger.warn(`Failed to run assessment recovery: ${String(e)}`);
});

// Start the DB-backed scan queue worker loop.
scanQueueService.startWorkerLoop();

logger.info('[WORKER] Scan worker process started');
