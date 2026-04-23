import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { tickPrayer, getStreak } from '../controllers/prayerLogController';

const router = Router();

/** All prayer-log routes require a valid JWT. */
router.use(authenticate);

/** Toggle a single prayer as prayed / unprayed for a given day */
router.post('/tick', tickPrayer);

/** Return streak stats + today's prayer state for the authenticated user */
router.get('/streak', getStreak);

export default router;
