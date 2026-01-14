import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import 'dotenv/config';

import { initializeFirebaseAdmin } from './config/firebase';
import apiRoutes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { stream } from './utils/logger';
import logger from './utils/logger';
import { recoverOrphanedInProgressAssessments } from './services/assessmentRecovery.service';

// Initialize Firebase
initializeFirebaseAdmin();

// Best-effort recovery for scans that were running during a restart.
recoverOrphanedInProgressAssessments().catch((e) => {
  logger.warn(`Failed to run assessment recovery: ${String(e)}`);
});

const app = express();
const port = process.env.PORT || 3001;
const clientUrl = process.env.CLIENT_URL;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: clientUrl,
    optionsSuccessStatus: 200,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream }));

// API Routes
app.use('/api', apiRoutes);

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
