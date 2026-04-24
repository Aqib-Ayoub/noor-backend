import { Router } from 'express';
import {
  getSubscriptionStatus,
  getPaymentHistory,
  createOrder,
  handleWebhook,
  getReceipt,
  devActivateSubscription,
} from '../controllers/subscription.controller';
import { authenticate } from '../../../middlewares/auth.middleware';
import { requireRole } from '../../../middlewares/rbac.middleware';
import { UserRole } from '../../../models/User';

const subscriptionRouter = Router();

// ── MasjidAdmin routes ────────────────────────────────────────────────────────

/** GET /api/subscription/status — current plan, days remaining, pricing */
subscriptionRouter.get('/status',  authenticate, requireRole(UserRole.MasjidAdmin), getSubscriptionStatus);

/** GET /api/subscription/history — all paid invoices */
subscriptionRouter.get('/history', authenticate, requireRole(UserRole.MasjidAdmin), getPaymentHistory);

/** POST /api/subscription/create-order — create Razorpay payment link */
subscriptionRouter.post('/create-order', authenticate, requireRole(UserRole.MasjidAdmin), createOrder);

/** GET /api/subscription/receipt/:paymentId — download receipt JSON */
subscriptionRouter.get('/receipt/:paymentId', authenticate, requireRole(UserRole.MasjidAdmin), getReceipt);

// ── Razorpay webhook (public — Razorpay calls this) ──────────────────────────

/** POST /api/subscription/webhook — Razorpay payment confirmation */
subscriptionRouter.post('/webhook', handleWebhook);

// ── DEV ONLY — Manual subscription activation (not available in production) ──
if (process.env.NODE_ENV !== 'production') {
  /**
   * POST /api/subscription/test-activate
   * Body: { planType: '1month' | '6months' | '1year' }
   *
   * Instantly activates a subscription without going through Razorpay.
   * Use this during development to test the subscription UI.
   * ⚠️  This endpoint does NOT exist in production.
   */
  subscriptionRouter.post(
    '/test-activate',
    authenticate,
    requireRole(UserRole.MasjidAdmin),
    devActivateSubscription,
  );
}

export default subscriptionRouter;
