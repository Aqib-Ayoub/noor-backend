import { z } from 'zod';

// ─── Masjid Registration ──────────────────────────────────────────────────────

export const RegisterMasjidSchema = z.object({
  name:    z.string().trim().min(3, 'Masjid name must be at least 3 characters'),
  city:    z.string().trim().min(2, 'City is required'),
  address: z.string().trim().min(5, 'Address must be at least 5 characters'),
  phone:   z.string().trim().regex(/^\d{10}$/, 'Enter a valid 10-digit phone number').optional(),
});

// ─── Prayer Overrides ─────────────────────────────────────────────────────────

export const PrayerOverridesSchema = z.object({
  Fajr:    z.number().optional(),
  Dhuhr:   z.number().optional(),
  Asr:     z.number().optional(),
  Maghrib: z.number().optional(),
  Isha:    z.number().optional(),
});

/** Admin sets actual clock times per prayer (from drum picker). "HH:mm" 24hr format. */
export const SetCustomPrayerTimesSchema = z.object({
  Fajr:    z.string().regex(/^\d{2}:\d{2}$/).optional(),
  Dhuhr:   z.string().regex(/^\d{2}:\d{2}$/).optional(),
  Asr:     z.string().regex(/^\d{2}:\d{2}$/).optional(),
  Maghrib: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  Isha:    z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// ─── Masjid Settings ──────────────────────────────────────────────────────────

export const UpdateMasjidSettingsSchema = z.object({
  imamName:      z.string().trim().min(2).optional(),
  imamSalary:    z.number().min(0).optional(),
  accountNumber: z.string().trim().optional(),
  phone:         z.string().trim().regex(/^\d{10}$/).optional(),
  perPersonFee:  z.number().min(0).optional(),
});

// ─── Savings ──────────────────────────────────────────────────────────────────

export const UpdateSavingsSchema = z.object({
  savings: z.number().min(0),
});

// ─── Join Request ─────────────────────────────────────────────────────────────

export const JoinRequestSchema = z.object({
  masjidId:     z.string().min(1, 'Masjid ID is required'),
  membersCount: z.number().int().min(1, 'Must have at least 1 member'),
});

// ─── Family (admin adds directly) ────────────────────────────────────────────

export const AddFamilyByAdminSchema = z.object({
  familyHeadPhone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid 10-digit phone required'),
  familyHeadName:  z.string().trim().min(2, 'Name is required'),
  membersCount:    z.number().int().min(1),
});

// ─── Co-Admin Management ──────────────────────────────────────────────────────

export const AddCoAdminSchema = z.object({
  phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Valid 10-digit phone required'),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type RegisterMasjidInput       = z.infer<typeof RegisterMasjidSchema>;
export type PrayerOverridesInput      = z.infer<typeof PrayerOverridesSchema>;
export type UpdateMasjidSettingsInput = z.infer<typeof UpdateMasjidSettingsSchema>;
export type UpdateSavingsInput        = z.infer<typeof UpdateSavingsSchema>;
export type JoinRequestInput          = z.infer<typeof JoinRequestSchema>;
export type AddFamilyByAdminInput     = z.infer<typeof AddFamilyByAdminSchema>;
export type AddCoAdminInput           = z.infer<typeof AddCoAdminSchema>;
