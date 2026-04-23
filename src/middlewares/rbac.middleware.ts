import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';
import Masjid, { MasjidStatus } from '../models/Masjid';
import { sendError } from '../utils/response';

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Returns a middleware that only allows users whose role matches one of the provided roles.
 * @param roles - One or more UserRole values that are permitted
 */
export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // authenticate middleware must run first and populate req.user
    if (!req.user) {
      sendError(res, 'Unauthorized: Authentication required', 401);
      return;
    }

    // Check if the user's role is in the allowed list
    if (!roles.includes(req.user.role as UserRole)) {
      sendError(
        res,
        `Forbidden: Role '${req.user.role}' is not permitted to access this resource`,
        403
      );
      return;
    }

    next();
  };
};

/**
 * Middleware that blocks MasjidAdmin users if their Masjid is not yet APPROVED by SuperAdmin.
 * Must be used AFTER authenticate and after requireRole(MasjidAdmin).
 */
export const requireApprovedMasjid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      sendError(res, 'Unauthorized', 401);
      return;
    }

    // Only enforce this check for MasjidAdmin role
    if (req.user.role !== UserRole.MasjidAdmin) {
      next();
      return;
    }

    // Ensure the admin has a masjid linked to their account
    if (!req.user.masjidRef) {
      sendError(res, 'Forbidden: No Masjid linked to your account', 403);
      return;
    }

    // Fetch the associated Masjid and check its approval status
    const masjid = await Masjid.findById(req.user.masjidRef);
    if (!masjid) {
      sendError(res, 'Forbidden: Linked Masjid not found', 403);
      return;
    }

    if (masjid.approvedStatus !== MasjidStatus.Approved) {
      sendError(
        res,
        `Forbidden: Your Masjid is currently '${masjid.approvedStatus}'. Please wait for SuperAdmin approval.`,
        403
      );
      return;
    }

    next();
  } catch (error) {
    sendError(res, 'Internal server error in RBAC check', 500);
  }
};
