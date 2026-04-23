import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/jwt.service';
import User, { IUser } from '../models/User';
import { sendError } from '../utils/response';

/** Extend Express Request to carry the authenticated user */
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

const jwtService = new JwtService();

/**
 * Authentication middleware.
 * Extracts the Bearer token from the Authorization header,
 * verifies it using JwtService, and attaches the full User
 * document to req.user for downstream use.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // Reject if no Authorization header or wrong format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Unauthorized: No token provided', 401);
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify and decode the JWT
    const decoded = jwtService.verify(token);
    if (!decoded || !decoded.userId) {
      sendError(res, 'Unauthorized: Invalid or expired token', 401);
      return;
    }

    // Fetch the user from DB to ensure they still exist and get latest role
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      sendError(res, 'Unauthorized: User not found', 401);
      return;
    }

    // Attach the user to the request object
    req.user = user;
    next();
  } catch (error) {
    sendError(res, 'Unauthorized: Token verification failed', 401);
  }
};
