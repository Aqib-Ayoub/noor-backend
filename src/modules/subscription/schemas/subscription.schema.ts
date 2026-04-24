import { z } from 'zod';

// ─── Subscription Config (SuperAdmin) ─────────────────────────────────────────

export const UpdateSubscriptionConfigSchema = z.object({
  trialDays:        z.number().int().min(0).optional(),
  monthlyPrice:     z.number().min(0).optional(),
  sixMonthPrice:    z.number().min(0).optional(),
  yearlyPrice:      z.number().min(0).optional(),
  sixMonthDiscount: z.number().min(0).max(100).optional(),
  yearlyDiscount:   z.number().min(0).max(100).optional(),
});

// ─── Create Order ─────────────────────────────────────────────────────────────

export const CreateOrderSchema = z.object({
  planType: z.enum(['1month', '6months', '1year'], { message: 'Invalid plan type' }),
});

// ─── Inferred Types ────────────────────────────────────────────────────────────

export type UpdateSubscriptionConfigInput = z.infer<typeof UpdateSubscriptionConfigSchema>;
export type CreateOrderInput              = z.infer<typeof CreateOrderSchema>;
