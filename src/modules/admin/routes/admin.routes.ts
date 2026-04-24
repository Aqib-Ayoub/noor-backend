import { Router } from 'express';
import { getAllMasjids, updateMasjidStatus, uploadContent, getSubscriptionConfig, updateSubscriptionConfig } from '../controllers/admin.controller';
import { authenticate } from '../../../middlewares/auth.middleware';
import { requireRole } from '../../../middlewares/rbac.middleware';
import { UserRole } from '../../../models/User';

/** All admin routes require SuperAdmin role */
const adminRouter = Router();
adminRouter.use(authenticate, requireRole(UserRole.SuperAdmin));

/** GET /api/admin/masjids — list all Masjid registrations (filterable by ?status=) */
adminRouter.get('/masjids', getAllMasjids);

/** PATCH /api/admin/masjid/:id/status — approve, reject, or suspend a Masjid */
adminRouter.patch('/masjid/:id/status', updateMasjidStatus);

/** POST /api/admin/content — upload Hadith of the Day or background image URL */
adminRouter.post('/content', uploadContent);

/** GET /api/admin/subscription-config — get current trial days and plan pricing */
adminRouter.get('/subscription-config', getSubscriptionConfig);

/** PATCH /api/admin/subscription-config — update trial days, prices, and discounts */
adminRouter.patch('/subscription-config', updateSubscriptionConfig);


export default adminRouter;
