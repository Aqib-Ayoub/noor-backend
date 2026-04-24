import { z } from 'zod';

// ─── Prayer Log Schemas ────────────────────────────────────────────────────────

const VALID_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;

export const TickPrayerSchema = z.object({
  prayerName: z.enum(VALID_PRAYERS, { message: 'Invalid prayer name' }),
  date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type TickPrayerInput = z.infer<typeof TickPrayerSchema>;
