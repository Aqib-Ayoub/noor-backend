import { Request, Response } from 'express';
import { z } from 'zod';
import Masjid, { MasjidStatus } from '../../../models/Masjid';
import { sendSuccess, sendError } from '../../../utils/response';
import { startTrialForMasjid, getSubscriptionConfig, updateSubscriptionConfig } from '../../subscription/controllers/subscription.controller';

// ─── Inline Schemas (admin module has no separate schema file, kept here for clarity) ────

/** Zod schema for updating a Masjid's approval status */
const UpdateStatusSchema = z.object({
  status: z.enum([
    MasjidStatus.Approved,
    MasjidStatus.Rejected,
    MasjidStatus.Pending,
    MasjidStatus.Suspended,
  ]),
});

/** Zod schema for uploading content (Hadith or background image) */
const ContentUploadSchema = z.object({
  masjidId:           z.string().min(1, 'masjidId is required'),
  hadithOfTheDay:     z.string().trim().optional(),
  backgroundImageUrl: z.string().url('Must be a valid URL').optional(),
});

/**
 * GET /api/admin/masjids
 * Returns all Masjid registrations, optionally filtered by status.
 * Only accessible by SuperAdmin.
 */
export const getAllMasjids = async (req: Request, res: Response): Promise<void> => {
  const { status } = req.query;

  // Build filter — if status query param is provided, filter by it
  const filter = status ? { approvedStatus: status as MasjidStatus } : {};

  const masjids = await Masjid.find(filter)
    .populate('adminRef', 'name phone city')
    .sort({ createdAt: -1 });

  sendSuccess(res, masjids, 'Masjids fetched successfully');
};

/**
 * PATCH /api/admin/masjid/:id/status
 * Allows SuperAdmin to approve, reject, or suspend a Masjid registration.
 * This is the gate that enables or disables MasjidAdmin access.
 */
export const updateMasjidStatus = async (req: Request, res: Response): Promise<void> => {
  const parse = UpdateStatusSchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const masjid = await Masjid.findById(req.params.id);
  if (!masjid) {
    sendError(res, 'Masjid not found', 404);
    return;
  }

  masjid.approvedStatus = parse.data.status;
  await masjid.save();

  // When a Masjid is approved for the first time, start its free trial
  if (parse.data.status === MasjidStatus.Approved) {
    await startTrialForMasjid(masjid._id.toString());
  }

  sendSuccess(
    res,
    { id: masjid._id, approvedStatus: masjid.approvedStatus },
    `Masjid status updated to '${masjid.approvedStatus}'`
  );
};

/**
 * POST /api/admin/content
 * Allows SuperAdmin to set the Hadith of the Day and/or background image URL for a Masjid.
 */
export const uploadContent = async (req: Request, res: Response): Promise<void> => {
  const parse = ContentUploadSchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const { masjidId, hadithOfTheDay, backgroundImageUrl } = parse.data;

  const masjid = await Masjid.findById(masjidId);
  if (!masjid) {
    sendError(res, 'Masjid not found', 404);
    return;
  }

  if (hadithOfTheDay !== undefined) masjid.hadithOfTheDay = hadithOfTheDay;
  if (backgroundImageUrl !== undefined) masjid.backgroundImageUrl = backgroundImageUrl;
  await masjid.save();

  sendSuccess(res, masjid, 'Content updated successfully');
};

// ─── Re-export subscription config handlers for admin routes ──────────────────
export { getSubscriptionConfig, updateSubscriptionConfig };

