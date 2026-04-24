import { Router } from 'express';
import { authenticate } from '../../../middlewares/auth.middleware';
import { tickPrayer, getStreak } from '../controllers/prayer-log.controller';

const prayerLogRouter = Router();

/** All prayer-log routes require a valid JWT */
prayerLogRouter.use(authenticate);

/** POST /api/prayer-log/tick — toggle a single prayer as prayed / unprayed for a given day */
prayerLogRouter.post('/tick', tickPrayer);

/** GET /api/prayer-log/streak — return streak stats + today's prayer state */
prayerLogRouter.get('/streak', getStreak);

export default prayerLogRouter;
