import Otp from '../models/Otp';
import { logInfo } from '../utils/logger';

/** OTP validity window in milliseconds (5 minutes) */
const OTP_TTL_MS = 5 * 60 * 1000;

/**
 * Service responsible for generating, sending (mock), and verifying OTP codes.
 * In production this would integrate with an SMS gateway (e.g., MSG91 / Twilio).
 */
export class OtpService {
  /**
   * Generates a random 6-digit OTP, stores it in MongoDB with a TTL,
   * and logs it to the console (mock delivery).
   * Any existing OTP for the same phone is invalidated first.
   * @param phone - The recipient's phone number
   * @returns The generated OTP code (for testing purposes only)
   */
  async sendOtp(phone: string): Promise<string> {
    // Invalidate any existing OTP for this phone number
    await Otp.deleteMany({ phone });

    // Generate a cryptographically simple 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    // Persist the OTP in MongoDB (TTL index handles automatic cleanup)
    await Otp.create({ phone, code, expiresAt });

    // --- MOCK DELIVERY: log to console instead of real SMS ---
    logInfo(`[OTP MOCK] Phone: ${phone} | Code: ${code} | Expires: ${expiresAt.toISOString()}`);

    return code;
  }

  /**
   * Verifies the provided OTP code against the stored record.
   * Marks the OTP as consumed on success to prevent reuse.
   * @param phone - The phone number the OTP was sent to
   * @param code - The code submitted by the user
   * @returns true if valid and not yet verified, false otherwise
   */
  async verifyOtp(phone: string, code: string): Promise<boolean> {
    const otpRecord = await Otp.findOne({
      phone,
      code,
      expiresAt: { $gt: new Date() }, // Must not be expired
      verified: false,                 // Must not be already used
    });

    if (!otpRecord) return false;

    // Mark as consumed so it cannot be reused
    otpRecord.verified = true;
    await otpRecord.save();

    return true;
  }

  /**
   * Checks whether the OTP for a given phone was already verified.
   * Used by /complete-registration to confirm the user went through OTP first.
   * @param phone - The phone number to check
   * @returns true if a verified OTP record exists for this phone
   */
  async isPhoneVerified(phone: string): Promise<boolean> {
    const record = await Otp.findOne({ phone, verified: true });
    return record !== null;
  }
}

