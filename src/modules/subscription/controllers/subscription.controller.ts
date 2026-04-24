import { Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import MasjidSubscription, { SubscriptionStatus, PlanType } from '../../../models/MasjidSubscription';
import SubscriptionPayment, { PaymentStatus } from '../../../models/SubscriptionPayment';
import SubscriptionConfig from '../../../models/SubscriptionConfig';
import Masjid from '../../../models/Masjid';
import { sendSuccess, sendError } from '../../../utils/response';
import { CreateOrderSchema, UpdateSubscriptionConfigSchema } from '../schemas/subscription.schema';

// ── Razorpay client (lazy — reads env vars at runtime) ────────────────────────
function getRazorpay(): Razorpay {
  return new Razorpay({
    key_id:     process.env.RAZORPAY_KEY_ID     ?? '',
    key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function generateReceiptNumber(): Promise<string> {
  const count = await SubscriptionPayment.countDocuments();
  const year  = new Date().getFullYear();
  return `NOOR-${year}-${String(count + 1).padStart(6, '0')}`;
}

function getPlanPrice(config: InstanceType<typeof SubscriptionConfig>, planType: PlanType): number {
  if (planType === PlanType.Monthly)  return (config as any).monthlyPrice;
  if (planType === PlanType.SixMonth) return (config as any).sixMonthPrice;
  if (planType === PlanType.Yearly)   return (config as any).yearlyPrice;
  return 0;
}

function getPlanMonths(planType: PlanType): number {
  if (planType === PlanType.Monthly)  return 1;
  if (planType === PlanType.SixMonth) return 6;
  if (planType === PlanType.Yearly)   return 12;
  return 0;
}

function daysLeft(endDate?: Date | null): number {
  if (!endDate) return 0;
  const diff = endDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUBSCRIPTION STATUS
// ─────────────────────────────────────────────────────────────────────────────

export const getSubscriptionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!user.masjidRef) { sendError(res, 'No Masjid linked to your account', 400); return; }

    const sub = await MasjidSubscription.findOne({ masjidRef: user.masjidRef });
    if (!sub) { sendError(res, 'Subscription not found. Contact support.', 404); return; }

    const config = await SubscriptionConfig.findOne();

    let daysRemaining = 0;
    if (sub.status === SubscriptionStatus.Trial)  daysRemaining = daysLeft(sub.trialEndsAt);
    if (sub.status === SubscriptionStatus.Active) daysRemaining = daysLeft(sub.currentPeriodEnd);

    sendSuccess(res, {
      status:           sub.status,
      planType:         sub.planType,
      daysRemaining,
      trialEndsAt:      sub.trialEndsAt,
      currentPeriodEnd: sub.currentPeriodEnd,
      pricing: config ? {
        monthlyPrice:     config.monthlyPrice,
        sixMonthPrice:    config.sixMonthPrice,
        yearlyPrice:      config.yearlyPrice,
        sixMonthDiscount: config.sixMonthDiscount,
        yearlyDiscount:   config.yearlyDiscount,
      } : null,
    }, 'Subscription status fetched');
  } catch (err) {
    sendError(res, 'Failed to fetch subscription status', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  PAYMENT HISTORY
// ─────────────────────────────────────────────────────────────────────────────

export const getPaymentHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!user.masjidRef) { sendError(res, 'No Masjid linked to your account', 400); return; }

    const payments = await SubscriptionPayment.find({
      masjidRef: user.masjidRef,
      status:    PaymentStatus.Paid,
    }).sort({ paidAt: -1 });

    sendSuccess(res, payments, 'Payment history fetched');
  } catch (err) {
    sendError(res, 'Failed to fetch payment history', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CREATE ORDER (Razorpay)
// ─────────────────────────────────────────────────────────────────────────────

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = CreateOrderSchema.safeParse(req.body);
    if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

    const user = req.user!;
    if (!user.masjidRef) { sendError(res, 'No Masjid linked to your account', 400); return; }

    const masjid = await Masjid.findById(user.masjidRef);
    if (!masjid) { sendError(res, 'Masjid not found', 404); return; }

    const config = await SubscriptionConfig.findOne();
    if (!config) { sendError(res, 'Subscription pricing not configured. Contact SuperAdmin.', 503); return; }

    const planType      = parse.data.planType as PlanType;
    const amount        = getPlanPrice(config, planType);
    const receiptNumber = await generateReceiptNumber();

    // Validate that Razorpay keys are configured
    if (!process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('xxx')) {
      sendError(res, 'Payment gateway not configured. Please contact support.', 503);
      return;
    }

    const razorpay   = getRazorpay();
    let paymentLink: any;

    try {
      paymentLink = await (razorpay.paymentLink as any).create({
        amount:          amount * 100, // Razorpay expects paise
        currency:        'INR',
        accept_partial:  false,
        description:     `Noor Platform — ${planType} subscription for ${masjid.name}`,
        customer: {
          name:  user.name,
          email: user.email ?? undefined,
        },
        notify:          { sms: false, email: false },
        reminder_enable: false,
        notes:           { masjidId: masjid._id.toString(), masjidName: masjid.name, planType, receiptNumber },
        callback_url:    `${process.env.FRONTEND_URL ?? 'https://aqooi.in'}/payment/success`,
        callback_method: 'get',
      });
    } catch (razorpayErr: any) {
      // Razorpay throws a structured error object with .error property
      const msg = razorpayErr?.error?.description ?? razorpayErr?.message ?? 'Payment gateway error';
      sendError(res, `Payment gateway error: ${msg}`, 502);
      return;
    }

    // Save pending payment record
    await SubscriptionPayment.create({
      masjidRef:       user.masjidRef,
      planType,
      amount,
      razorpayOrderId: paymentLink.id,
      status:          PaymentStatus.Pending,
      receiptNumber,
    });

    sendSuccess(res, {
      paymentUrl:    paymentLink.short_url,
      orderId:       paymentLink.id,
      amount,
      receiptNumber,
    }, 'Payment link created');
  } catch (err) {
    sendError(res, 'Failed to create payment order', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  RAZORPAY WEBHOOK
// ─────────────────────────────────────────────────────────────────────────────

export const handleWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const secret    = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
    const signature = req.headers['x-razorpay-signature'] as string;
    const body      = JSON.stringify(req.body);

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (expectedSig !== signature) {
      res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      return;
    }

    const event = req.body;

    if (event.event === 'payment_link.paid') {
      const paymentLinkId     = event.payload.payment_link.entity.id as string;
      const razorpayPaymentId = event.payload.payment.entity.id as string;

      const paymentRecord = await SubscriptionPayment.findOne({ razorpayOrderId: paymentLinkId });
      if (!paymentRecord || paymentRecord.status === PaymentStatus.Paid) {
        res.json({ success: true });
        return;
      }

      paymentRecord.status            = PaymentStatus.Paid;
      paymentRecord.razorpayPaymentId = razorpayPaymentId;
      paymentRecord.razorpaySignature = signature;
      paymentRecord.paidAt            = new Date();
      await paymentRecord.save();

      const now       = new Date();
      const months    = getPlanMonths(paymentRecord.planType);
      const periodEnd = addMonths(now, months);

      await MasjidSubscription.findOneAndUpdate(
        { masjidRef: paymentRecord.masjidRef },
        { status: SubscriptionStatus.Active, planType: paymentRecord.planType, currentPeriodEnd: periodEnd },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  RECEIPT
// ─────────────────────────────────────────────────────────────────────────────

export const getReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    if (!user.masjidRef) { sendError(res, 'No Masjid linked to your account', 400); return; }

    const payment = await SubscriptionPayment.findOne({
      _id:       req.params.paymentId,
      masjidRef: user.masjidRef,
      status:    PaymentStatus.Paid,
    });

    if (!payment) { sendError(res, 'Receipt not found', 404); return; }

    const masjid = await Masjid.findById(user.masjidRef);

    sendSuccess(res, {
      receiptNumber:     payment.receiptNumber,
      masjidName:        masjid?.name ?? '',
      planType:          payment.planType,
      amount:            payment.amount,
      currency:          'INR',
      razorpayPaymentId: payment.razorpayPaymentId,
      paidAt:            payment.paidAt,
      issuedBy:          'Noor Platform',
    }, 'Receipt fetched');
  } catch (err) {
    sendError(res, 'Failed to fetch receipt', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  SUPER ADMIN — SUBSCRIPTION CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const getSubscriptionConfig = async (_req: Request, res: Response): Promise<void> => {
  try {
    let config = await SubscriptionConfig.findOne();
    if (!config) config = await SubscriptionConfig.create({});
    sendSuccess(res, config, 'Subscription config fetched');
  } catch (err) {
    sendError(res, 'Failed to fetch subscription config', 500);
  }
};

export const updateSubscriptionConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = UpdateSubscriptionConfigSchema.safeParse(req.body);
    if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

    const config = await SubscriptionConfig.findOneAndUpdate(
      {},
      { $set: parse.data },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    sendSuccess(res, config, 'Subscription config updated');
  } catch (err) {
    sendError(res, 'Failed to update subscription config', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  DEV ONLY — Manual test activation (stripped in production by routes guard)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/subscription/test-activate   [DEV ONLY]
 * Body: { planType: '1month' | '6months' | '1year' }
 *
 * Instantly activates a subscription without Razorpay.
 * Creates a fake payment record so history and receipts work too.
 */
export const devActivateSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const parse = CreateOrderSchema.safeParse(req.body);
    if (!parse.success) { sendError(res, 'Validation failed', 400, parse.error.flatten().fieldErrors); return; }

    const user = req.user!;
    if (!user.masjidRef) { sendError(res, 'No Masjid linked to your account', 400); return; }

    const config    = await SubscriptionConfig.findOne();
    const planType  = parse.data.planType as PlanType;
    const amount    = config ? getPlanPrice(config, planType) : 0;
    const months    = getPlanMonths(planType);
    const now       = new Date();
    const periodEnd = addMonths(now, months);
    const receiptNumber = await generateReceiptNumber();

    // Create a fake paid payment record
    const payment = await SubscriptionPayment.create({
      masjidRef:         user.masjidRef,
      planType,
      amount,
      razorpayOrderId:   `DEV-${Date.now()}`,
      razorpayPaymentId: `DEV-PAY-${Date.now()}`,
      razorpaySignature: 'dev-test',
      status:            PaymentStatus.Paid,
      receiptNumber,
      paidAt:            now,
    });

    // Activate subscription
    await MasjidSubscription.findOneAndUpdate(
      { masjidRef: user.masjidRef },
      { status: SubscriptionStatus.Active, planType, currentPeriodEnd: periodEnd },
      { upsert: true, new: true }
    );

    sendSuccess(res, {
      planType,
      periodEnd,
      receiptNumber: payment.receiptNumber,
    }, `[DEV] Subscription activated for ${planType}`);
  } catch (err) {
    sendError(res, 'Failed to activate test subscription', 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL — Start trial when Masjid is approved
// ─────────────────────────────────────────────────────────────────────────────

export async function startTrialForMasjid(masjidId: string): Promise<void> {
  try {
    let config = await SubscriptionConfig.findOne();
    if (!config) config = await SubscriptionConfig.create({});

    const trialEndsAt = addDays(new Date(), (config as any).trialDays);

    await MasjidSubscription.findOneAndUpdate(
      { masjidRef: masjidId },
      { masjidRef: masjidId, status: SubscriptionStatus.Trial, planType: PlanType.Trial, trialEndsAt },
      { upsert: true, new: true }
    );
  } catch (err) {
    // Don't throw — trial creation failure should not block Masjid approval
    console.error('[startTrialForMasjid] Failed to create trial subscription:', err);
  }
}
