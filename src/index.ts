import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import authRouter          from './modules/auth/routes/auth.routes';
import masjidRouter        from './modules/masjid/routes/masjid.routes';
import familyRouter        from './modules/family/routes/family.routes';
import adminRouter         from './modules/admin/routes/admin.routes';
import userRouter          from './modules/user/routes/user.routes';
import prayerLogRouter     from './modules/prayer-log/routes/prayer-log.routes';
import subscriptionRouter  from './modules/subscription/routes/subscription.routes';
import { logInfo, logSuccess, logError } from './utils/logger';
import { backfillMasjidShortIds } from './utils/migrations';
import { registerCronJobs } from './utils/cron';

/** Load environment variables from .env before anything else */
dotenv.config();

const app      = express();
const PORT     = process.env.PORT ?? 5000;
const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/noor';

// ── Global Middleware ─────────────────────────────────────────────────────────

/** Enable CORS — restrict to aqooi.in and localhost in dev */
const allowedOrigins = [
  'https://aqooi.in',
  'https://noor-backend.aqooi.in',
  'http://localhost:3000',   // admin dashboard dev
  'http://localhost:5173',   // vite dev
];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, Postman)
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

/** Parse incoming JSON request bodies */
app.use(express.json());

// ── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/auth',         authRouter);
app.use('/api/masjid',       masjidRouter);
app.use('/api/family',       familyRouter);
app.use('/api/admin',        adminRouter);
app.use('/api/user',         userRouter);
app.use('/api/prayer-log',   prayerLogRouter);
app.use('/api/subscription', subscriptionRouter);

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

/**
 * Global Express error middleware.
 * Catches errors forwarded via next(err) from any route or middleware,
 * including async handlers that throw. Always returns JSON.
 */
app.use((err: Error, _req: import('express').Request, res: import('express').Response, _next: import('express').NextFunction) => {
  logError('[Express Error]', err.message);
  res.status(500).json({ success: false, message: err.message ?? 'Internal server error' });
});

// ── Database + Server Boot ────────────────────────────────────────────────────

/**
 * Connects to MongoDB and starts the Express server.
 * Exits the process with code 1 if the database connection fails.
 */
const bootstrap = async (): Promise<void> => {
  try {
    logInfo('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    logSuccess(`MongoDB connected: ${MONGO_URI}`);

    // Run startup migrations
    await backfillMasjidShortIds();

    // Start background jobs
    registerCronJobs();

    const server = app.listen(PORT, () => {
      logSuccess(`🌙 Noor API running on http://localhost:${PORT}`);
      logInfo('Run "npm run seed" to seed the SuperAdmin account.');
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logError(`Port ${PORT} is already in use. Kill the process holding it and restart.`);
        logError(`Run: Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
      } else {
        logError('Server error:', err);
      }
      process.exit(1);
    });
  } catch (error) {
    logError('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

// ── Process-level error guards ────────────────────────────────────────────────

/**
 * Catches async rejections that slip past Express (e.g. background code).
 * Logs the error but does NOT exit so the server stays alive.
 */
process.on('unhandledRejection', (reason) => {
  logError('[UnhandledRejection] Promise rejected without catch:', reason);
});

/**
 * Catches synchronous exceptions that reach the top-level event loop.
 * Logs and exits cleanly (nodemon will restart).
 */
process.on('uncaughtException', (err) => {
  logError('[UncaughtException]', err.message);
  process.exit(1);
});

bootstrap();
