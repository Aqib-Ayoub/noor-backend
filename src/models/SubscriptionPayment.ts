import mongoose, { Document, Schema, Model } from 'mongoose';
import { PlanType } from './MasjidSubscription';

export enum PaymentStatus {
  Pending = 'pending',
  Paid    = 'paid',
  Failed  = 'failed',
}

/**
 * One record per payment attempt (successful or failed).
 * Created when MasjidAdmin initiates a plan purchase.
 * Updated via Razorpay webhook on payment completion.
 */
export interface ISubscriptionPayment extends Document {
  masjidRef:          mongoose.Types.ObjectId;
  planType:           PlanType;
  amount:             number;         // INR amount charged
  razorpayOrderId:    string;         // Set on order creation
  razorpayPaymentId?: string;         // Set after successful webhook
  razorpaySignature?: string;         // Set after successful webhook
  status:             PaymentStatus;
  /** Human-readable receipt number e.g. NOOR-2026-000001 */
  receiptNumber:      string;
  paidAt?:            Date;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionPaymentSchema = new Schema<ISubscriptionPayment>(
  {
    masjidRef:          { type: Schema.Types.ObjectId, ref: 'Masjid', required: true },
    planType:           { type: String, enum: Object.values(PlanType), required: true },
    amount:             { type: Number, required: true, min: 0 },
    razorpayOrderId:    { type: String, required: true, unique: true },
    razorpayPaymentId:  { type: String, default: null },
    razorpaySignature:  { type: String, default: null },
    status:             { type: String, enum: Object.values(PaymentStatus), default: PaymentStatus.Pending },
    receiptNumber:      { type: String, required: true, unique: true },
    paidAt:             { type: Date, default: null },
  },
  { timestamps: true }
);

const SubscriptionPayment: Model<ISubscriptionPayment> =
  mongoose.model<ISubscriptionPayment>('SubscriptionPayment', SubscriptionPaymentSchema);
export default SubscriptionPayment;
