import { z } from 'zod';

// ─── Auth Schemas ──────────────────────────────────────────────────────────────

export const SendOtpSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
});

export const VerifyOtpSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
  code:  z.string().length(6, 'OTP must be exactly 6 digits').regex(/^\d{6}$/, 'OTP must contain only digits'),
});

/** Called after first-time OTP — only name required now (city removed from users) */
export const CompleteRegistrationSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Phone must be a valid 10-digit Indian mobile number'),
  name:  z.string().trim().min(2, 'Name must be at least 2 characters'),
});

export const AdminLoginSchema = z.object({
  email:    z.string().email('Must be a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type SendOtpInput              = z.infer<typeof SendOtpSchema>;
export type VerifyOtpInput            = z.infer<typeof VerifyOtpSchema>;
export type CompleteRegistrationInput = z.infer<typeof CompleteRegistrationSchema>;
export type AdminLoginInput           = z.infer<typeof AdminLoginSchema>;
