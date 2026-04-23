import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Masjid from '../../models/Masjid';
import User, { UserRole } from '../../models/User';
import Family from '../../models/Family';
import JoinRequest, { JoinRequestStatus } from '../../models/JoinRequest';
import ChangeRequest from '../../models/ChangeRequest';
import { PrayerService } from '../../services/prayer.service';
import {
  RegisterMasjidSchema,
  PrayerOverridesSchema,
  SetCustomPrayerTimesSchema,
  UpdateMasjidSettingsSchema,
  UpdateSavingsSchema,
  JoinRequestSchema,
  AddFamilyByAdminSchema,
  AddCoAdminSchema,
} from './masjid.schema';
import { sendSuccess, sendError } from '../../utils/response';

const prayerService = new PrayerService();

// ─────────────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if the requesting user is the primary admin OR a co-admin of the masjid. */
function isAdminOf(masjid: any, userId: string): boolean {
  return (
    masjid.adminRef.toString() === userId ||
    (masjid.coAdmins as any[]).some((id: any) => id.toString() === userId)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MASJID REGISTRATION & RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/masjid/register
 * A User registers a new Masjid (name, city, address, optional phone).
 * Imam details are set later in the manage screen.
 */
export const registerMasjid = async (req: Request, res: Response): Promise<void> => {
  const parse = RegisterMasjidSchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const user = req.user!;
  if (user.masjidRef) {
    sendError(res, 'You are already linked to a Masjid', 400);
    return;
  }

  const masjid = await Masjid.create({ ...parse.data, adminRef: user._id, coAdmins: [] });

  await User.findByIdAndUpdate(user._id, {
    role:      UserRole.MasjidAdmin,
    masjidRef: masjid._id,
  });

  sendSuccess(res, masjid, 'Masjid registered successfully. Awaiting SuperAdmin approval.', 201);
};

/**
 * GET /api/masjid/:id
 */
export const getMasjid = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id)
    .populate('adminRef', 'name phone')
    .populate('coAdmins', 'name phone');
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  sendSuccess(res, masjid, 'Masjid fetched successfully');
};

/**
 * GET /api/masjid/by-short-id/:shortId
 * Public — finds an approved Masjid by its 6-char join code.
 * Returns {_id, name, city, shortId} so the user can confirm before requesting to join.
 */
export const findByShortId = async (req: Request, res: Response): Promise<void> => {
  const shortId = String(req.params.shortId ?? '').toUpperCase().trim();
  if (shortId.length !== 6) {
    sendError(res, 'Invalid code — must be exactly 6 characters', 400);
    return;
  }
  const masjid = await Masjid.findOne({ shortId });
  if (!masjid) { sendError(res, 'No Masjid found with that code', 404); return; }
  if (masjid.approvedStatus !== 'APPROVED') {
    sendError(res, 'This Masjid is not yet approved', 403);
    return;
  }
  sendSuccess(res, {
    _id:     masjid._id,
    name:    masjid.name,
    city:    masjid.city,
    shortId: masjid.shortId,
  }, 'Masjid found');
};

// ─────────────────────────────────────────────────────────────────────────────
//  PRAYER TIMES
// ─────────────────────────────────────────────────────────────────────────────

export const getMasjidPrayerTimes = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  const prayerTimes = await prayerService.getPrayerTimes(
    masjid.prayerOverrides,
    masjid.customPrayerTimes as any,
  );
  sendSuccess(res, prayerTimes, 'Prayer times fetched successfully');
};

/**
 * PATCH /api/masjid/:id/custom-prayer-times
 * Admin sets actual clock times per prayer (from drum picker).
 * Empty string for a prayer = revert to API time.
 */
export const setCustomPrayerTimes = async (req: Request, res: Response): Promise<void> => {
  const parse = SetCustomPrayerTimesSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  masjid.customPrayerTimes = { ...((masjid.customPrayerTimes as any) ?? {}), ...parse.data };
  await masjid.save();
  sendSuccess(res, masjid.customPrayerTimes, 'Custom prayer times updated');
};

export const updatePrayerOverrides = async (req: Request, res: Response): Promise<void> => {
  const parse = PrayerOverridesSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  masjid.prayerOverrides = { ...masjid.prayerOverrides, ...parse.data };
  await masjid.save();
  sendSuccess(res, masjid.prayerOverrides, 'Prayer overrides updated');
};

// ─────────────────────────────────────────────────────────────────────────────
//  MASJID SETTINGS (imam, account number, phone – all freely editable)
// ─────────────────────────────────────────────────────────────────────────────

export const updateMasjidSettings = async (req: Request, res: Response): Promise<void> => {
  const parse = UpdateMasjidSettingsSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const { imamName, imamSalary, accountNumber, phone, perPersonFee } = parse.data;
  if (imamName      !== undefined) masjid.imamName      = imamName;
  if (imamSalary    !== undefined) masjid.imamSalary    = imamSalary;
  if (accountNumber !== undefined) masjid.accountNumber = accountNumber;
  if (phone         !== undefined) masjid.phone         = phone;
  if (perPersonFee  !== undefined) masjid.perPersonFee  = perPersonFee;
  await masjid.save();

  sendSuccess(res, masjid, 'Masjid settings updated');
};

// Keep old financials route pointing here for backward compat
export const updateMasjidFinancials = updateMasjidSettings;

// ─────────────────────────────────────────────────────────────────────────────
//  SAVINGS (first-time free; subsequent = ChangeRequest)
// ─────────────────────────────────────────────────────────────────────────────

export const updateSavings = async (req: Request, res: Response): Promise<void> => {
  const parse = UpdateSavingsSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  if (masjid.savings === 0) {
    masjid.savings = parse.data.savings;
    await masjid.save();
    sendSuccess(res, { savings: masjid.savings, changeRequested: false }, 'Savings updated');
  } else {
    const cr = await ChangeRequest.create({
      masjidId:    masjid._id,
      requestedBy: req.user!._id,
      oldValue:    masjid.savings,
      newValue:    parse.data.savings,
    });
    sendSuccess(res, { changeRequested: true, requestId: cr._id },
      'Change request submitted. Awaiting SuperAdmin approval.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CO-ADMIN MANAGEMENT (Committee — up to 5 co-admins, 6 total)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/masjid/:id/co-admins
 * Primary admin adds a co-admin by phone number.
 */
export const addCoAdmin = async (req: Request, res: Response): Promise<void> => {
  const parse = AddCoAdminSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }

  // Only PRIMARY admin can add/remove co-admins
  if (masjid.adminRef.toString() !== req.user!._id.toString()) {
    sendError(res, 'Only the primary admin can manage the committee', 403); return;
  }

  if (masjid.coAdmins.length >= 5) {
    sendError(res, 'Maximum 6 admins allowed (1 primary + 5 co-admins)', 400); return;
  }

  const targetUser = await User.findOne({ phone: parse.data.phone });
  if (!targetUser) {
    sendError(res, 'No user found with that phone number. They must register on Noor first.', 404); return;
  }

  const alreadyAdmin = masjid.coAdmins.some(id => id.toString() === targetUser._id.toString())
    || masjid.adminRef.toString() === targetUser._id.toString();
  if (alreadyAdmin) {
    sendError(res, 'This user is already an admin of this Masjid', 400); return;
  }

  masjid.coAdmins.push(targetUser._id as mongoose.Types.ObjectId);
  await masjid.save();

  await User.findByIdAndUpdate(targetUser._id, {
    role:      UserRole.MasjidAdmin,
    masjidRef: masjid._id,
  });

  sendSuccess(res, { userId: targetUser._id, name: targetUser.name }, 'Co-admin added to committee');
};

/**
 * DELETE /api/masjid/:id/co-admins/:userId
 * Primary admin removes a co-admin. They become a regular User but stay linked to the Masjid.
 */
export const removeCoAdmin = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }

  if (masjid.adminRef.toString() !== req.user!._id.toString()) {
    sendError(res, 'Only the primary admin can remove committee members', 403); return;
  }

  const { userId } = req.params;
  masjid.coAdmins = masjid.coAdmins.filter(id => id.toString() !== userId) as any;
  await masjid.save();

  // Downgrade role to User — they remain linked to masjid
  await User.findByIdAndUpdate(userId, { role: UserRole.User });

  sendSuccess(res, null, 'Co-admin removed. They remain a Masjid member.');
};

/**
 * GET /api/masjid/:id/co-admins
 * Returns list of all committee members (primary + co-admins).
 */
export const getCoAdmins = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id)
    .populate('adminRef', 'name phone')
    .populate('coAdmins', 'name phone');
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }

  sendSuccess(res, {
    primaryAdmin: masjid.adminRef,
    coAdmins:     masjid.coAdmins,
  }, 'Committee fetched');
};

// ─────────────────────────────────────────────────────────────────────────────
//  FAMILY MANAGEMENT (Admin adds directly)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/masjid/:id/families
 * Admin adds a family by phone. If the user doesn't exist yet, creates their
 * account with the admin-provided name. When they log in later via OTP, they
 * skip the new-user screen (account already exists).
 */
export const addFamilyByAdmin = async (req: Request, res: Response): Promise<void> => {
  const parse = AddFamilyByAdminSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const { familyHeadPhone, familyHeadName, membersCount } = parse.data;

  // Find or pre-create the user
  let familyHead = await User.findOne({ phone: familyHeadPhone });
  if (!familyHead) {
    // Pre-register with admin-set name — when they log in via OTP, account exists → skip new-user screen
    familyHead = await User.create({
      phone: familyHeadPhone,
      name:  familyHeadName,
      role:  UserRole.User,
    });
  } else {
    // Update their name if admin provided a different one
    if (familyHead.name !== familyHeadName) {
      familyHead.name = familyHeadName;
      await familyHead.save();
    }
  }

  // Prevent duplicate family in same masjid
  const existing = await Family.findOne({ familyHead: familyHead._id, masjidRef: masjid._id });
  if (existing) {
    sendError(res, 'This user already has a family record in this Masjid', 400); return;
  }

  // Link user to masjid
  await User.findByIdAndUpdate(familyHead._id, { masjidRef: masjid._id });

  // Use masjid-level perPersonFee — fee is uniform for all families
  const fee = masjid.perPersonFee ?? 0;

  const family = await Family.create({
    familyHead:   familyHead._id,
    masjidRef:    masjid._id,
    membersCount,
    payPerPerson: fee,
  });

  const populated = await family.populate('familyHead', 'name phone');
  sendSuccess(res, populated, 'Family added successfully', 201);
};

/**
 * GET /api/masjid/:id/families
 * Returns all family records for a Masjid with totals.
 */
export const listFamilies = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const families = await Family.find({ masjidRef: req.params.id })
    .populate('familyHead', 'name phone')
    .sort({ createdAt: -1 });

  // Use masjid-level perPersonFee for total calculation
  const fee = masjid.perPersonFee ?? 0;
  const totalMonthly = families.reduce((sum, f) => sum + f.membersCount * fee, 0);
  sendSuccess(res, { families, totalMonthly, perPersonFee: fee }, 'Families fetched');
};

/**
 * DELETE /api/masjid/:id/families/:familyId
 */
export const removeFamily = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  await Family.findByIdAndDelete(req.params.familyId);
  sendSuccess(res, null, 'Family removed');
};

// ─────────────────────────────────────────────────────────────────────────────
//  JOIN REQUESTS (user-initiated flow)
// ─────────────────────────────────────────────────────────────────────────────

export const submitJoinRequest = async (req: Request, res: Response): Promise<void> => {
  const parse = JoinRequestSchema.safeParse({ ...req.body, masjidId: req.params.id });
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

  const user   = req.user!;
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Invalid Masjid ID', 404); return; }
  if (user.masjidRef) { sendError(res, 'You are already linked to a Masjid', 400); return; }

  const existing = await JoinRequest.findOne({ userId: user._id, masjidId: masjid._id });
  if (existing) { sendError(res, 'You already have a pending request for this Masjid', 400); return; }

  const joinReq = await JoinRequest.create({
    userId:       user._id,
    masjidId:     masjid._id,
    membersCount: parse.data.membersCount,
  });

  sendSuccess(res, joinReq, 'Join request submitted. Awaiting Masjid admin approval.', 201);
};

export const getJoinRequests = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const requests = await JoinRequest.find({ masjidId: req.params.id })
    .populate('userId', 'name phone')
    .sort({ createdAt: -1 });

  sendSuccess(res, requests, 'Join requests fetched');
};

export const resolveJoinRequest = async (req: Request, res: Response): Promise<void> => {
  const { id: masjidId, reqId } = req.params;
  const masjidObjId = masjidId as string;
  const { action, payPerPerson } = req.body;

  if (!['approve', 'reject'].includes(action)) { sendError(res, "action must be 'approve' or 'reject'", 400); return; }

  const masjid = await Masjid.findById(masjidId);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const joinReq = await JoinRequest.findById(reqId);
  if (!joinReq) { sendError(res, 'Join request not found', 404); return; }

  if (action === 'approve') {
    joinReq.status = JoinRequestStatus.Approved;
    await joinReq.save();
    await User.findByIdAndUpdate(joinReq.userId, { masjidRef: masjidObjId });
    const ppp = typeof payPerPerson === 'number' ? payPerPerson : 0;
    await Family.create({
      familyHead:   joinReq.userId,
      masjidRef:    new mongoose.Types.ObjectId(masjidObjId),
      membersCount: joinReq.membersCount,
      payPerPerson: ppp,
    });
    sendSuccess(res, joinReq, 'Request approved.');
  } else {
    joinReq.status = JoinRequestStatus.Rejected;
    await joinReq.save();
    sendSuccess(res, joinReq, 'Request rejected.');
  }
};

export const getMyJoinRequest = async (req: Request, res: Response): Promise<void> => {
  const joinReq = await JoinRequest.findOne({ userId: req.user!._id, masjidId: req.params.id })
    .populate('masjidId', 'name city');
  sendSuccess(res, joinReq ?? null, 'Join request status');
};

// Legacy alias
export const joinMasjid = submitJoinRequest;

// ─────────────────────────────────────────────────────────────────────────────
//  LEADERBOARD  — GET /api/masjid/:id/leaderboard
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns all masjid members ranked by total prayer points (desc).
 * Ties broken by current streak (desc), then name (asc).
 * Accessible to any authenticated user who belongs to this masjid.
 */
export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const masjidId = req.params.id;

    // 1. Find all users linked to this masjid
    const members = await User.find(
      { masjidRef: masjidId },
      '_id name role'
    ).lean();

    if (!members.length) {
      sendSuccess(res, [], 'Leaderboard is empty');
      return;
    }

    const userIds = members.map(m => m._id);

    // 2. Aggregate total points per user from all their PrayerLog records
    const PrayerLog = mongoose.model('PrayerLog');
    const pointsAgg: Array<{ _id: mongoose.Types.ObjectId; totalPoints: number }> =
      await PrayerLog.aggregate([
        { $match: { userId: { $in: userIds } } },
        { $group: { _id: '$userId', totalPoints: { $sum: '$points' } } },
      ]);

    // 3. Compute current streak per user (walk back consecutive all-done days)
    const today = new Date().toISOString().slice(0, 10);

    function prevDay(dateStr: string): string {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    }

    // Fetch all logs for all users at once
    const allLogs: Array<{ userId: mongoose.Types.ObjectId; date: string; prayers: Record<string, boolean> }> =
      await PrayerLog.find({ userId: { $in: userIds } }, 'userId date prayers').lean() as any;

    // Build a map: userId → Set of "all-done" date strings
    const doneDatesMap = new Map<string, Set<string>>();
    for (const log of allLogs) {
      const uid = log.userId.toString();
      if (!doneDatesMap.has(uid)) doneDatesMap.set(uid, new Set());
      const prayers = log.prayers as Record<string, boolean>;
      const allDone = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].every(p => prayers[p] === true);
      if (allDone) doneDatesMap.get(uid)!.add(log.date);
    }

    function currentStreak(userId: string): number {
      const done = doneDatesMap.get(userId) ?? new Set<string>();
      let streak = 0;
      let cursor = today;
      while (done.has(cursor)) {
        streak++;
        cursor = prevDay(cursor);
      }
      return streak;
    }

    // 4. Build points lookup map
    const pointsMap = new Map<string, number>();
    for (const p of pointsAgg) pointsMap.set(p._id.toString(), p.totalPoints);

    // 5. Assemble + sort
    const entries = members.map(m => ({
      userId:      m._id.toString(),
      name:        m.name,
      role:        m.role,
      points:      pointsMap.get(m._id.toString()) ?? 0,
      streak:      currentStreak(m._id.toString()),
    }));

    entries.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.streak !== a.streak) return b.streak - a.streak;
      return a.name.localeCompare(b.name);
    });

    sendSuccess(res, entries, 'Leaderboard fetched');
  } catch (err) {
    sendError(res, 'Failed to fetch leaderboard', 500, String(err));
  }
};

