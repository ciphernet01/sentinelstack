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

// Initialize Firebase
initializeFirebaseAdmin();

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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

morgan.token('id', (req) => {
  const anyReq = req as any;
  const headerId = anyReq?.headers?.['x-request-id'];
  return anyReq?.requestId || headerId || '-';
});
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms', { stream }));

// API Routes
app.use('/api', apiGlobalLimiter, apiRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Error Handling Middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

export default app;
