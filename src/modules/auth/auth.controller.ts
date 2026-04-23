import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { OtpService } from '../../services/otp.service';
import { JwtService } from '../../services/jwt.service';
import User, { UserRole } from '../../models/User';
import { SendOtpSchema, VerifyOtpSchema, CompleteRegistrationSchema, AdminLoginSchema } from './auth.schema';
import { sendSuccess, sendError } from '../../utils/response';

const otpService = new OtpService();
const jwtService = new JwtService();

/**
 * POST /api/auth/send-otp
 * Validates the phone and dispatches a mock OTP. Also returns whether the phone
 * is already registered so the client can prepare the correct post-OTP flow.
 */
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  const parse = SendOtpSchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const { phone } = parse.data;
  const code = await otpService.sendOtp(phone);

  // In development: include the OTP in the response so the app can display it.
  // Remove this in production when a real SMS gateway (Twilio) is wired up.
  const devOtp = process.env.NODE_ENV !== 'production' ? code : undefined;

  sendSuccess(res, { devOtp }, 'OTP sent successfully.');
};

/**
 * POST /api/auth/verify-otp
 * Verifies the submitted OTP.
 * - Existing user  → returns { token, user, isNewUser: false }
 * - New phone      → marks OTP as verified, returns { isNewUser: true }
 *                    The client must then call /complete-registration.
 */
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  const parse = VerifyOtpSchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const { phone, code } = parse.data;

  const isValid = await otpService.verifyOtp(phone, code);
  if (!isValid) {
    sendError(res, 'Invalid or expired OTP', 400);
    return;
  }

  // Check if user already exists
  const user = await User.findOne({ phone });
  if (user) {
    // Returning user — issue JWT immediately
    const token = jwtService.sign(user._id.toString(), user.role);
    sendSuccess(res, { token, user, isNewUser: false }, 'Login successful');
    return;
  }

  // New phone — OTP is verified (otpService marks it verified internally)
  // Client proceeds to /complete-registration with name & city
  sendSuccess(res, { isNewUser: true, phone }, 'OTP verified. Please complete registration.');
};

/**
 * POST /api/auth/complete-registration
 * Called only for new phones after OTP verification.
 * Creates the user account and returns a JWT.
 */
export const completeRegistration = async (req: Request, res: Response): Promise<void> => {
  const parse = CompleteRegistrationSchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const { phone, name } = parse.data;

  // Safety check: ensure phone isn't already registered
  const existing = await User.findOne({ phone });
  if (existing) {
    sendError(res, 'This phone is already registered. Please log in.', 400);
    return;
  }

  // Safety check: ensure the OTP was verified for this phone
  const wasVerified = await otpService.isPhoneVerified(phone);
  if (!wasVerified) {
    sendError(res, 'OTP not verified for this phone. Please restart login.', 400);
    return;
  }

  const user = await User.create({ phone, name, role: UserRole.User });
  const token = jwtService.sign(user._id.toString(), user.role);

  sendSuccess(res, { token, user, isNewUser: false }, 'Registration complete. Welcome to Noor!');
};

/**
 * POST /api/auth/admin-login
 * Authenticates a SuperAdmin using email and bcrypt-hashed password.
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  const parse = AdminLoginSchema.safeParse(req.body);
  if (!parse.success) {
    sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors);
    return;
  }

  const { email, password } = parse.data;

  const admin = await User.findOne({ email, role: UserRole.SuperAdmin });
  if (!admin || !admin.passwordHash) {
    sendError(res, 'Invalid credentials', 401);
    return;
  }

  const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
  if (!passwordMatch) {
    sendError(res, 'Invalid credentials', 401);
    return;
  }

  const token = jwtService.sign(admin._id.toString(), admin.role);
  sendSuccess(res, { token, admin: { id: admin._id, email: admin.email, role: admin.role } }, 'Admin login successful');
};
