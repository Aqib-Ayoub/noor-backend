import { Router } from 'express';
import { addFamily, getFamiliesByMasjid } from '../modules/family/family.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireRole, requireApprovedMasjid } from '../middlewares/rbac.middleware';
import { UserRole } from '../models/User';

const familyRouter = Router();

/** POST /api/family — MasjidAdmin adds a family head to their Masjid */
familyRouter.post(
  '/',
  authenticate,
  requireRole(UserRole.MasjidAdmin),
  requireApprovedMasjid,
  addFamily
);

/** GET /api/family/masjid/:masjidId — returns all families under a given Masjid */
familyRouter.get('/masjid/:masjidId', authenticate, getFamiliesByMasjid);

export default familyRouter;
