import { Router } from 'express';
import {
  registerMasjid,
  getMasjid,
  findByShortId,
  updatePrayerOverrides,
  getMasjidPrayerTimes,
  setCustomPrayerTimes,
  updateMasjidSettings,
  updateSavings,
  submitJoinRequest,
  getJoinRequests,
  resolveJoinRequest,
  getMyJoinRequest,
  addCoAdmin,
  removeCoAdmin,
  getCoAdmins,
  addFamilyByAdmin,
  listFamilies,
  removeFamily,
  getLeaderboard,
} from '../controllers/masjid.controller';
import { authenticate } from '../../../middlewares/auth.middleware';
import { requireRole, requireApprovedMasjid } from '../../../middlewares/rbac.middleware';
import { UserRole } from '../../../models/User';

const masjidRouter = Router();

// ── Registration & Retrieval ──────────────────────────────────────────────────
masjidRouter.post('/register', authenticate, requireRole(UserRole.User), registerMasjid);
// IMPORTANT: /by-short-id/:shortId MUST come before /:id to avoid route collision
masjidRouter.get('/by-short-id/:shortId', findByShortId);
masjidRouter.get('/:id', authenticate, getMasjid);
masjidRouter.get('/:id/prayer-times', getMasjidPrayerTimes);

// ── Prayer Overrides ──────────────────────────────────────────────────────────
masjidRouter.patch('/:id/prayer-overrides',    authenticate, requireRole(UserRole.MasjidAdmin), requireApprovedMasjid, updatePrayerOverrides);
masjidRouter.patch('/:id/custom-prayer-times', authenticate, requireRole(UserRole.MasjidAdmin), requireApprovedMasjid, setCustomPrayerTimes);

// ── Settings ─────────────────────────────────────────────────────────────────
masjidRouter.patch('/:id/settings',   authenticate, requireRole(UserRole.MasjidAdmin), requireApprovedMasjid, updateMasjidSettings);
masjidRouter.patch('/:id/financials', authenticate, requireRole(UserRole.MasjidAdmin), requireApprovedMasjid, updateMasjidSettings); // backward compat

// ── Savings ───────────────────────────────────────────────────────────────────
masjidRouter.patch('/:id/savings', authenticate, requireRole(UserRole.MasjidAdmin), requireApprovedMasjid, updateSavings);

// ── Co-Admin (Committee) ──────────────────────────────────────────────────────
masjidRouter.get('/:id/co-admins',            authenticate, requireRole(UserRole.MasjidAdmin), getCoAdmins);
masjidRouter.post('/:id/co-admins',           authenticate, requireRole(UserRole.MasjidAdmin), addCoAdmin);
masjidRouter.delete('/:id/co-admins/:userId', authenticate, requireRole(UserRole.MasjidAdmin), removeCoAdmin);

// ── Family Management (Admin-direct) ─────────────────────────────────────────
masjidRouter.post('/:id/families',             authenticate, requireRole(UserRole.MasjidAdmin), requireApprovedMasjid, addFamilyByAdmin);
masjidRouter.get('/:id/families',              authenticate, requireRole(UserRole.MasjidAdmin), listFamilies);
masjidRouter.delete('/:id/families/:familyId', authenticate, requireRole(UserRole.MasjidAdmin), removeFamily);

// ── Join Requests (User-initiated) ────────────────────────────────────────────
masjidRouter.post('/:id/join-request',          authenticate, submitJoinRequest);
masjidRouter.get('/:id/join-requests',          authenticate, requireRole(UserRole.MasjidAdmin), getJoinRequests);
masjidRouter.patch('/:id/join-requests/:reqId', authenticate, requireRole(UserRole.MasjidAdmin), resolveJoinRequest);
masjidRouter.get('/:id/my-join-request',        authenticate, getMyJoinRequest);

// ── Leaderboard ───────────────────────────────────────────────────────────────
masjidRouter.get('/:id/leaderboard', authenticate, getLeaderboard);

export default masjidRouter;
