import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Masjid from '../../../models/Masjid';
import User, { UserRole } from '../../../models/User';
import Family from '../../../models/Family';
import JoinRequest, { JoinRequestStatus } from '../../../models/JoinRequest';
import Payment from '../../../models/Payment';
import ChangeRequest from '../../../models/ChangeRequest';
import { PrayerService } from '../../../services/prayer.service';
import {
  RegisterMasjidSchema,
  PrayerOverridesSchema,
  SetCustomPrayerTimesSchema,
  UpdateMasjidSettingsSchema,
  UpdateSavingsSchema,
  JoinRequestSchema,
  AddFamilyByAdminSchema,
  AddCoAdminSchema,
} from '../schemas/masjid.schema';
import { sendSuccess, sendError } from '../../../utils/response';

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
//  REGISTRATION & RETRIEVAL
// ─────────────────────────────────────────────────────────────────────────────

export const registerMasjid = async (req: Request, res: Response): Promise<void> => {
  const parse = RegisterMasjidSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }
  const user = req.user!;
  if (user.masjidRef) { sendError(res, 'You are already linked to a Masjid', 400); return; }
  const masjid = await Masjid.create({ ...parse.data, adminRef: user._id, coAdmins: [] });
  await User.findByIdAndUpdate(user._id, { role: UserRole.MasjidAdmin, masjidRef: masjid._id });
  sendSuccess(res, masjid, 'Masjid registered successfully. Awaiting SuperAdmin approval.', 201);
};

export const getMasjid = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id).populate('adminRef', 'name phone').populate('coAdmins', 'name phone');
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  sendSuccess(res, masjid, 'Masjid fetched successfully');
};

export const findByShortId = async (req: Request, res: Response): Promise<void> => {
  const shortId = String(req.params.shortId ?? '').toUpperCase().trim();
  if (shortId.length !== 6) { sendError(res, 'Invalid code — must be exactly 6 characters', 400); return; }
  const masjid = await Masjid.findOne({ shortId });
  if (!masjid) { sendError(res, 'No Masjid found with that code', 404); return; }
  if (masjid.approvedStatus !== 'APPROVED') { sendError(res, 'This Masjid is not yet approved', 403); return; }
  sendSuccess(res, { _id: masjid._id, name: masjid.name, city: masjid.city, shortId: masjid.shortId }, 'Masjid found');
};

// ─────────────────────────────────────────────────────────────────────────────
//  PRAYER TIMES
// ─────────────────────────────────────────────────────────────────────────────

export const getMasjidPrayerTimes = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  const prayerTimes = await prayerService.getPrayerTimes(masjid.prayerOverrides, masjid.customPrayerTimes as any);
  sendSuccess(res, prayerTimes, 'Prayer times fetched successfully');
};

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
//  MASJID SETTINGS
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

export const updateMasjidFinancials = updateMasjidSettings; // backward compat alias

// ─────────────────────────────────────────────────────────────────────────────
//  SAVINGS
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
    const cr = await ChangeRequest.create({ masjidId: masjid._id, requestedBy: req.user!._id, oldValue: masjid.savings, newValue: parse.data.savings });
    sendSuccess(res, { changeRequested: true, requestId: cr._id }, 'Change request submitted. Awaiting SuperAdmin approval.');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CO-ADMIN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const addCoAdmin = async (req: Request, res: Response): Promise<void> => {
  const parse = AddCoAdminSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (masjid.adminRef.toString() !== req.user!._id.toString()) { sendError(res, 'Only the primary admin can manage the committee', 403); return; }
  if (masjid.coAdmins.length >= 5) { sendError(res, 'Maximum 6 admins allowed (1 primary + 5 co-admins)', 400); return; }
  const targetUser = await User.findOne({ phone: parse.data.phone });
  if (!targetUser) { sendError(res, 'No user found with that phone number. They must register on Noor first.', 404); return; }
  const alreadyAdmin = masjid.coAdmins.some(id => id.toString() === targetUser._id.toString()) || masjid.adminRef.toString() === targetUser._id.toString();
  if (alreadyAdmin) { sendError(res, 'This user is already an admin of this Masjid', 400); return; }
  masjid.coAdmins.push(targetUser._id as mongoose.Types.ObjectId);
  await masjid.save();
  await User.findByIdAndUpdate(targetUser._id, { role: UserRole.MasjidAdmin, masjidRef: masjid._id });
  sendSuccess(res, { userId: targetUser._id, name: targetUser.name }, 'Co-admin added to committee');
};

export const removeCoAdmin = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (masjid.adminRef.toString() !== req.user!._id.toString()) { sendError(res, 'Only the primary admin can remove committee members', 403); return; }
  masjid.coAdmins = masjid.coAdmins.filter(id => id.toString() !== req.params.userId) as any;
  await masjid.save();
  await User.findByIdAndUpdate(req.params.userId, { role: UserRole.User });
  sendSuccess(res, null, 'Co-admin removed. They remain a Masjid member.');
};

export const getCoAdmins = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id).populate('adminRef', 'name phone').populate('coAdmins', 'name phone');
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  sendSuccess(res, { primaryAdmin: masjid.adminRef, coAdmins: masjid.coAdmins }, 'Committee fetched');
};

// ─────────────────────────────────────────────────────────────────────────────
//  FAMILY MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export const addFamilyByAdmin = async (req: Request, res: Response): Promise<void> => {
  const parse = AddFamilyByAdminSchema.safeParse(req.body);
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }
  const { familyHeadPhone, familyHeadName, membersCount } = parse.data;
  let familyHead = await User.findOne({ phone: familyHeadPhone });
  if (!familyHead) {
    familyHead = await User.create({ phone: familyHeadPhone, name: familyHeadName, role: UserRole.User });
  } else if (familyHead.name !== familyHeadName) {
    familyHead.name = familyHeadName;
    await familyHead.save();
  }
  const existing = await Family.findOne({ familyHead: familyHead._id, masjidRef: masjid._id });
  if (existing) { sendError(res, 'This user already has a family record in this Masjid', 400); return; }
  await User.findByIdAndUpdate(familyHead._id, { masjidRef: masjid._id });
  const fee = masjid.perPersonFee ?? 0;
  const family = await Family.create({ familyHead: familyHead._id, masjidRef: masjid._id, membersCount, payPerPerson: fee });
  const populated = await family.populate('familyHead', 'name phone');
  sendSuccess(res, populated, 'Family added successfully', 201);
};

export const listFamilies = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }
  const families = await Family.find({ masjidRef: req.params.id }).populate('familyHead', 'name phone').sort({ createdAt: -1 });
  const fee = masjid.perPersonFee ?? 0;
  const totalMonthly = families.reduce((sum, f) => sum + f.membersCount * fee, 0);

  // Enrich each family with current-month payment status
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curYear  = now.getFullYear();
  const familyIds = families.map(f => f._id);
  const paidThisMonth = await Payment.find({ familyRef: { $in: familyIds }, month: curMonth, year: curYear });
  const paidSet = new Set(paidThisMonth.map(p => p.familyRef.toString()));

  const enriched = families.map(f => ({
    ...(f as any).toObject(),
    isPaidThisMonth: paidSet.has(f._id.toString()),
  }));

  const unpaidOnly = req.query.unpaidOnly === 'true';
  const result = unpaidOnly ? enriched.filter(f => !f.isPaidThisMonth) : enriched;

  sendSuccess(res, { families: result, totalMonthly, perPersonFee: fee }, 'Families fetched');
};

export const getFamilyPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const family = await Family.findById(req.params.familyId).populate('familyHead', 'name phone');
  if (!family) { sendError(res, 'Family not found', 404); return; }

  const payments = await Payment.find({ familyRef: family._id }).sort({ year: -1, month: -1 });

  // Build set of paid month/year combos
  const paidSet = new Set(payments.map(p => `${p.year}-${p.month}`));

  const fee = masjid.perPersonFee > 0 ? masjid.perPersonFee : family.payPerPerson;
  const monthlyAmount = family.membersCount * fee;

  // Calculate pending months: from family creation month up to current month
  const now    = new Date();
  const start  = new Date(family.createdAt);
  const pending: { month: number; year: number; amount: number }[] = [];

  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= endCursor) {
    const m = cursor.getMonth() + 1;
    const y = cursor.getFullYear();
    if (!paidSet.has(`${y}-${m}`)) {
      pending.push({ month: m, year: y, amount: monthlyAmount });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  sendSuccess(res, {
    family: { ...(family as any).toObject(), monthlyAmount },
    payments,
    pendingMonths: pending,
  }, 'Family payment history fetched');
};

export const removeFamily = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }
  await Family.findByIdAndDelete(req.params.familyId);
  sendSuccess(res, null, 'Family removed');
};

export const updateFamily = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const family = await Family.findById(req.params.familyId).populate('familyHead', 'name phone');
  if (!family) { sendError(res, 'Family not found', 404); return; }

  const { familyHeadName, familyHeadPhone, membersCount } = req.body as {
    familyHeadName?: string;
    familyHeadPhone?: string;
    membersCount?: number;
  };

  // Update the linked User's name/phone if provided
  if (familyHeadName || familyHeadPhone) {
    const updateFields: Record<string, string> = {};
    if (familyHeadName)  updateFields.name  = familyHeadName;
    if (familyHeadPhone) updateFields.phone = familyHeadPhone;
    await User.findByIdAndUpdate(family.familyHead, updateFields);
  }

  if (typeof membersCount === 'number' && membersCount > 0) {
    family.membersCount = membersCount;
    await family.save();
  }

  const updated = await Family.findById(family._id).populate('familyHead', 'name phone');
  sendSuccess(res, updated, 'Family updated successfully');
};

export const recordCashPayment = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }

  const family = await Family.findById(req.params.familyId);
  if (!family) { sendError(res, 'Family not found', 404); return; }

  const now = new Date();
  const month = Number(req.body.month) || now.getMonth() + 1;
  const year = Number(req.body.year) || now.getFullYear();
  const fee = masjid.perPersonFee > 0 ? masjid.perPersonFee : family.payPerPerson;
  const computedAmount = family.membersCount * fee;
  const amount = Number(req.body.amount) || computedAmount;

  const existingPayment = await Payment.findOne({ familyRef: family._id, month, year });
  if (existingPayment) {
    sendError(res, `Payment for ${month}/${year} is already recorded`, 400); 
    return;
  }

  const payment = await Payment.create({
    familyRef: family._id,
    masjidRef: masjid._id,
    userRef: family.familyHead,
    month,
    year,
    amount,
  });

  masjid.savings += amount;
  await masjid.save();

  sendSuccess(res, payment, 'Cash payment recorded successfully');
};

// ─────────────────────────────────────────────────────────────────────────────
//  JOIN REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

export const submitJoinRequest = async (req: Request, res: Response): Promise<void> => {
  const parse = JoinRequestSchema.safeParse({ ...req.body, masjidId: req.params.id });
  if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }
  const user = req.user!;
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Invalid Masjid ID', 404); return; }
  if (user.masjidRef) { sendError(res, 'You are already linked to a Masjid', 400); return; }
  const existing = await JoinRequest.findOne({ userId: user._id, masjidId: masjid._id });
  if (existing) { sendError(res, 'You already have a pending request for this Masjid', 400); return; }
  const joinReq = await JoinRequest.create({ userId: user._id, masjidId: masjid._id, membersCount: parse.data.membersCount });
  sendSuccess(res, joinReq, 'Join request submitted. Awaiting Masjid admin approval.', 201);
};

export const getJoinRequests = async (req: Request, res: Response): Promise<void> => {
  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) { sendError(res, 'Masjid not found', 404); return; }
  if (!isAdminOf(masjid, req.user!._id.toString())) { sendError(res, 'Forbidden', 403); return; }
  const requests = await JoinRequest.find({ masjidId: req.params.id }).populate('userId', 'name phone').sort({ createdAt: -1 });
  sendSuccess(res, requests, 'Join requests fetched');
};

export const resolveJoinRequest = async (req: Request, res: Response): Promise<void> => {
  const { id: masjidId, reqId } = req.params;
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
    await User.findByIdAndUpdate(joinReq.userId, { masjidRef: masjidId });
    const ppp = typeof payPerPerson === 'number' ? payPerPerson : 0;
    await Family.create({ familyHead: joinReq.userId, masjidRef: new mongoose.Types.ObjectId(masjidId as string), membersCount: joinReq.membersCount, payPerPerson: ppp });
    sendSuccess(res, joinReq, 'Request approved.');
  } else {
    joinReq.status = JoinRequestStatus.Rejected;
    await joinReq.save();
    sendSuccess(res, joinReq, 'Request rejected.');
  }
};

export const getMyJoinRequest = async (req: Request, res: Response): Promise<void> => {
  const joinReq = await JoinRequest.findOne({ userId: req.user!._id, masjidId: req.params.id }).populate('masjidId', 'name city');
  sendSuccess(res, joinReq ?? null, 'Join request status');
};

export const joinMasjid = submitJoinRequest; // legacy alias

// ─────────────────────────────────────────────────────────────────────────────
//  LEADERBOARD
// ─────────────────────────────────────────────────────────────────────────────

export const getLeaderboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const masjidId = req.params.id;
    const members = await User.find({ masjidRef: masjidId }, '_id name role').lean();
    if (!members.length) { sendSuccess(res, [], 'Leaderboard is empty'); return; }
    const userIds = members.map(m => m._id);
    const PrayerLog = mongoose.model('PrayerLog');
    const pointsAgg: Array<{ _id: mongoose.Types.ObjectId; totalPoints: number }> =
      await PrayerLog.aggregate([{ $match: { userId: { $in: userIds } } }, { $group: { _id: '$userId', totalPoints: { $sum: '$points' } } }]);
    const today = new Date().toISOString().slice(0, 10);
    function prevDay(d: string): string { const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() - 1); return dt.toISOString().slice(0, 10); }
    const allLogs: Array<{ userId: mongoose.Types.ObjectId; date: string; prayers: Record<string, boolean> }> =
      await PrayerLog.find({ userId: { $in: userIds } }, 'userId date prayers').lean() as any;
    const doneDatesMap = new Map<string, Set<string>>();
    for (const log of allLogs) {
      const uid = log.userId.toString();
      if (!doneDatesMap.has(uid)) doneDatesMap.set(uid, new Set());
      const prayers = log.prayers as Record<string, boolean>;
      const allDone = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].every(p => prayers[p] === true);
      if (allDone) doneDatesMap.get(uid)!.add(log.date);
    }
    function currentStreak(uid: string): number {
      const done = doneDatesMap.get(uid) ?? new Set<string>();
      let streak = 0; let cursor = today;
      while (done.has(cursor)) { streak++; cursor = prevDay(cursor); }
      return streak;
    }
    const pointsMap = new Map<string, number>();
    for (const p of pointsAgg) pointsMap.set(p._id.toString(), p.totalPoints);
    const entries = members.map(m => ({ userId: m._id.toString(), name: m.name, role: m.role, points: pointsMap.get(m._id.toString()) ?? 0, streak: currentStreak(m._id.toString()) }));
    entries.sort((a, b) => b.points !== a.points ? b.points - a.points : b.streak !== a.streak ? b.streak - a.streak : a.name.localeCompare(b.name));
    sendSuccess(res, entries, 'Leaderboard fetched');
  } catch (err) {
    sendError(res, 'Failed to fetch leaderboard', 500, String(err));
  }
};
