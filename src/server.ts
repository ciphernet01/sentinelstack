import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';


import { initializeFirebaseAdmin } from './config/firebase';
import apiRoutes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
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

// CORS: restrict to an explicit allow-list. If CLIENT_URL is unset, requests
// from browsers (which send an Origin header) are rejected; server-to-server
// calls without an Origin header continue to work. Never reflect arbitrary
// origins in production.
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  logger.warn('[API] CLIENT_URL is not set; browser cross-origin requests will be rejected.');
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients (curl, Node services, health checks) that
      // do not send an Origin header.
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || !allowedOrigins.includes(origin)) {
        return callback(null, false);
      }
      return callback(null, true);
    },
    optionsSuccessStatus: 200,
  })
);

// IMPORTANT: Webhook signature verification requires the raw body.
// If express.json() runs first, it consumes the stream and breaks signature checks.
const jsonParser = express.json({ limit: '2mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '2mb' });
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
  } catch {
    // Never leak DB connection details; just report not ready.
    res.status(503).json({ ok: false, error: 'not ready' });
  }
});

app.get('/health/log-shipper', (req, res) => {
  res.status(200).json({
    enabled: process.env.LOG_WHISPERER_ENABLED !== 'false',
    ...logShipper.getStats(),
  });
});

// JSON 404 for unmatched routes (before the error handler)
app.use(notFoundHandler);

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
