import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';


import { initializeFirebaseAdmin } from './config/firebase';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { stream } from './utils/logger';
import logger from './utils/logger';
import { recoverOrphanedInProgressAssessments } from './services/assessmentRecovery.service';
import { requestIdMiddleware } from './middleware/requestId';
import { scanQueueService } from './services/scanQueue.service';
import { apiGlobalLimiter } from './middleware/rateLimit';
import { prisma } from './config/db';
import { logShipper } from './logging';

// Initialize Firebase
initializeFirebaseAdmin();

logger.info(
  `[API] Boot pid=${process.pid} node=${process.version} service=${process.env.RENDER_SERVICE_NAME || 'unknown'} commit=${process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown'} instance=${process.env.RENDER_INSTANCE_ID || 'unknown'} processType=${process.env.PROCESS_TYPE || 'api'}`,
);

// Best-effort recovery for scans that were running during a restart.
recoverOrphanedInProgressAssessments().catch((e) => {
  logger.warn(`Failed to run assessment recovery: ${String(e)}`);
});

// DB-backed scan queue worker (can run in-process; disable for separate worker dyno).
scanQueueService.startWorkerLoop();

const app = express();
const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL;

// Required for correct req.ip when behind Render/NGINX proxies
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Next.js needs eval for dev
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Next.js compatibility
}));
app.use(requestIdMiddleware);
app.use(
  cors({
    origin: clientUrl,
    optionsSuccessStatus: 200,
  })
);

// IMPORTANT: Webhook signature verification requires the raw body.
// If express.json() runs first, it consumes the stream and breaks signature checks.
const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: true });
app.use((req, res, next) => {
  const url = String((req as any).originalUrl || req.url || '');
  if (url.startsWith('/api/billing/webhook')) {
    return next();
  }
  return jsonParser(req, res, next);
});
app.use((req, res, next) => {
  const url = String((req as any).originalUrl || req.url || '');
  if (url.startsWith('/api/billing/webhook')) {
    return next();
  }
  return urlencodedParser(req, res, next);
});

morgan.token('id', (req) => {
  const anyReq = req as any;
  const headerId = anyReq?.headers?.['x-request-id'];
  return anyReq?.requestId || headerId || '-';
});
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms', { stream }));

app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - start;
    const responseTimeMs = Number(elapsedNs) / 1_000_000;
    const status = res.statusCode;
    const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';

    logShipper.log(level, 'HTTP request completed', {
      method: req.method,
      path: req.originalUrl || req.url,
      http_status: status,
      response_time_ms: Number(responseTimeMs.toFixed(3)),
      request_id: (req as any).requestId,
      remote_ip: req.ip,
      user_agent: req.get('user-agent') || null,
    });
  });
  next();
});

// API Routes
app.use('/api', apiGlobalLimiter, apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Readiness Check (DB reachable)
app.get('/health/ready', async (req, res) => {
  const timeoutMs = Number(process.env.HEALTH_READY_TIMEOUT_MS || 2000);

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('readiness timeout')), timeoutMs)),
    ]);

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e?.message || 'not ready' });
  }
});

app.get('/health/log-shipper', (req, res) => {
  res.status(200).json({
    enabled: process.env.LOG_WHISPERER_ENABLED !== 'false',
    ...logShipper.getStats(),
  });
});

// Error Handling Middleware
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

let isShuttingDown = false;

const gracefulShutdown = async (signal: string, exitCode: number) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.warn(`[API] Shutdown initiated by ${signal}`);
  logShipper.warn('Shutdown initiated', { signal });

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
    const hardTimeout = setTimeout(() => resolve(), 5000);
    hardTimeout.unref?.();
  });

  await logShipper.shutdown(8000);
  process.exit(exitCode);
};

process.once('SIGTERM', () => {
  void gracefulShutdown('SIGTERM', 0);
});

process.once('SIGINT', () => {
  void gracefulShutdown('SIGINT', 0);
});

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  logShipper.error('Unhandled promise rejection', {
    reason: message,
  });
  logger.error(`[API] Unhandled promise rejection: ${message}`);
});

process.on('uncaughtException', (error) => {
  logShipper.fatal('Uncaught exception', {
    error_message: error.message,
    stack: error.stack,
  });
  logger.error(`[API] Uncaught exception: ${error.stack || error.message}`);
  void gracefulShutdown('uncaughtException', 1);
});

export default app;
