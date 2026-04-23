import mongoose, { Document, Schema, Model } from 'mongoose';

/** TypeScript interface representing a one-time password document */
export interface IOtp extends Document {
  phone: string;
  code: string;
  expiresAt: Date;
  verified: boolean;
}

/** Mongoose schema for OTP documents — TTL index auto-deletes expired records */
const OtpSchema = new Schema<IOtp>({
  /** The phone number this OTP was sent to */
  phone: { type: String, required: true, trim: true },

  /** The 6-digit OTP code (plain string — no sensitive hash needed for short-lived codes) */
  code: { type: String, required: true },

  /** Timestamp when this OTP expires (5 minutes from creation) */
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // MongoDB TTL: auto-delete when expiresAt is reached
  },

  /** Whether this OTP has already been successfully consumed */
  verified: { type: Boolean, default: false },
});

/** Mongoose model for the Otp collection */
const Otp: Model<IOtp> = mongoose.model<IOtp>('Otp', OtpSchema);
export default Otp;
