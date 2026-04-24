import { Request, Response } from 'express';
import Family from '../../../models/Family';
import User from '../../../models/User';
import { AddFamilySchema } from '../schemas/family.schema';
import { sendSuccess, sendError } from '../../../utils/response';

/**
 * POST /api/family
 * Adds a family head to the MasjidAdmin's Masjid.
 * The family head is looked up by phone number; they must already have a Noor account.
 */
export const addFamily = async (req: Request, res: Response): Promise<void> => {
  const parse = AddFamilySchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const admin = req.user!;
  const { familyHeadPhone, membersCount, payPerPerson } = parse.data;

  if (!admin.masjidRef) {
    sendError(res, 'No Masjid linked to your account', 400);
    return;
  }

  const familyHead = await User.findOne({ phone: familyHeadPhone });
  if (!familyHead) {
    sendError(res, 'No user found with that phone number. Ask them to register first.', 404);
    return;
  }

  const existing = await Family.findOne({ familyHead: familyHead._id, masjidRef: admin.masjidRef });
  if (existing) {
    sendError(res, 'This user is already a family head in your Masjid', 400);
    return;
  }

  const family = await Family.create({ familyHead: familyHead._id, masjidRef: admin.masjidRef, membersCount, payPerPerson });
  sendSuccess(res, family, 'Family head added successfully', 201);
};

/**
 * GET /api/family/masjid/:masjidId
 * Returns all families registered under a given Masjid.
 */
export const getFamiliesByMasjid = async (req: Request, res: Response): Promise<void> => {
  const { masjidId } = req.params;
  const families = await Family.find({ masjidRef: masjidId }).populate('familyHead', 'name phone city');
  sendSuccess(res, families, 'Families fetched successfully');
};
