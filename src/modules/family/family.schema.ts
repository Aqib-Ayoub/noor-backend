import { z } from 'zod';

/**
 * Zod schema for adding a new family head under a Masjid.
 * Used by MasjidAdmin from the Admin Dashboard.
 */
export const AddFamilySchema = z.object({
  familyHeadPhone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  membersCount: z.number().int().min(1, 'At least 1 member required'),
  payPerPerson: z.number().min(0, 'Pay per person cannot be negative'),
});

export type AddFamilyInput = z.infer<typeof AddFamilySchema>;
