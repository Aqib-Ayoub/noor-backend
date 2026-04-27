import { Request, Response } from 'express';
import User from '../../../models/User';
import Masjid from '../../../models/Masjid';
import Family from '../../../models/Family';
import Payment from '../../../models/Payment';
import JoinRequest from '../../../models/JoinRequest';
import { sendSuccess, sendError } from '../../../utils/response';

/**
 * GET /api/user/me
 * Returns the currently authenticated user's profile,
 * along with their linked Masjid (if any).
 */
export const getMe = async (req: Request, res: Response): Promise<void> => {
  const user = await User.findById(req.user!._id)
    .select('-passwordHash')
    .populate('masjidRef', 'name city approvedStatus');

  if (!user) {
    sendError(res, 'User not found', 404);
    return;
  }

  sendSuccess(res, user, 'User profile fetched successfully');
};

/**
 * GET /api/user/masjid-context
 * Returns enriched context for the hub/home screen based on the user's role:
 * - No Masjid: { hasMasjid: false, joinRequestStatus }
 * - MasjidAdmin: admin-level data
 * - Regular User: read-only data + myDues (membersCount × payPerPerson)
 */
export const getMasjidContext = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  // ── No Masjid linked ──
  if (!user.masjidRef) {
    const pendingReq = await JoinRequest.findOne({ userId: user._id })
      .populate('masjidId', 'name city')
      .sort({ createdAt: -1 });

    sendSuccess(res, {
      hasMasjid: false,
      joinRequest: pendingReq ? { status: pendingReq.status, masjidId: pendingReq.masjidId } : null,
    }, 'No Masjid linked');
    return;
  }

  const masjid = await Masjid.findById(user.masjidRef).populate('adminRef', 'name phone');
  if (!masjid) {
    sendError(res, 'Linked Masjid not found', 404);
    return;
  }

  const adminRef = masjid.adminRef as any;

  // ── Calculate monthly dues for regular users ──
  let myDues: { membersCount: number; payPerPerson: number; totalMonthly: number; isPaid: boolean } | null = null;

  const family = await Family.findOne({ familyHead: user._id, masjidRef: masjid._id });
  if (family) {
    const fee          = masjid.perPersonFee > 0 ? masjid.perPersonFee : family.payPerPerson;
    const totalMonthly = family.membersCount * fee;
    const now = new Date();
    const paymentRecord = await Payment.findOne({ familyRef: family._id, month: now.getMonth() + 1, year: now.getFullYear() });
    myDues = { membersCount: family.membersCount, payPerPerson: fee, totalMonthly, isPaid: !!paymentRecord };
  }

  sendSuccess(res, {
    hasMasjid: true,
    role:      user.role,
    myDues,
    masjid: {
      id:                 masjid._id,
      shortId:            (masjid as any).shortId ?? null,
      name:               masjid.name,
      city:               masjid.city,
      address:            masjid.address,
      phone:              masjid.phone,
      accountNumber:      masjid.accountNumber,
      approvedStatus:     masjid.approvedStatus,
      savings:            masjid.savings,
      savingsLocked:      masjid.savings > 0,
      imamName:           masjid.imamName,
      imamSalary:         masjid.imamSalary,
      perPersonFee:       masjid.perPersonFee ?? 0,
      prayerOverrides:    masjid.prayerOverrides,
      customPrayerTimes:  masjid.customPrayerTimes ?? {},
      hadithOfTheDay:     masjid.hadithOfTheDay,
      backgroundImageUrl: masjid.backgroundImageUrl,
      adminPhone:         adminRef?.phone ?? null,
    },
  }, 'Masjid context fetched successfully');
};

/**
 * GET /api/user/payment-history
 * Returns the history of cash payments made by this user (family head).
 */
export const getPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  
  const payments = await Payment.find({ userRef: user._id })
    .populate('masjidRef', 'name')
    .sort({ year: -1, month: -1, createdAt: -1 });

  sendSuccess(res, payments, 'Payment history fetched successfully');
};
