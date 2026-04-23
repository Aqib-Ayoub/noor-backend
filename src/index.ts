import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter from './routes/auth.routes';
import masjidRouter from './routes/masjid.routes';
import familyRouter from './routes/family.routes';
import adminRouter from './routes/admin.routes';
import userRouter from './routes/user.routes';
import prayerLogRouter from './routes/prayerLog.routes';
import { logInfo, logSuccess, logError } from './utils/logger';
import { backfillMasjidShortIds } from './utils/migrations';

/** Load environment variables from .env before anything else */
dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 5000;
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/noor';

/** ---------- Global Middleware ---------- */

/** Enable CORS for all origins (tighten in production) */
app.use(cors());

/** Parse incoming JSON request bodies */
app.use(express.json());

/** ---------- API Routes ---------- */

app.use('/api/auth', authRouter);
app.use('/api/masjid', masjidRouter);
app.use('/api/family', familyRouter);
app.use('/api/admin', adminRouter);
app.use('/api/user', userRouter);
app.use('/api/prayer-log', prayerLogRouter);

/**
 * Health check endpoint — useful for Docker/K8s liveness probes.
 */
app.get('/health', (_req, res) => {
  res.json({ status: 'OK', service: 'Noor Backend', timestamp: new Date().toISOString() });
});

/** 404 handler for any unmatched routes */
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

/** ---------- Database + Server Boot ---------- */

/**
 * Connects to MongoDB and starts the Express server.
 * Exits the process with code 1 if the database connection fails.
 */
const bootstrap = async (): Promise<void> => {
  try {
    logInfo('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logSuccess(`MongoDB connected: ${MONGO_URI}`);

    // ── Startup migrations ──────────────────────────────────────────────────
    // Assigns shortIds to any Masjid documents that were created before this feature.
    await backfillMasjidShortIds();

    app.listen(PORT, () => {
      logSuccess(`🌙 Noor API running on http://localhost:${PORT}`);
      logInfo('Run "npm run seed" to seed the SuperAdmin account.');
    });
  } catch (error) {
    logError('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

bootstrap();
