import mongoose, { Document, Schema, Model } from 'mongoose';

export enum SubscriptionStatus {
  Trial   = 'trial',
  Active  = 'active',
  Expired = 'expired',
}

export enum PlanType {
  Trial    = 'trial',
  Monthly  = '1month',
  SixMonth = '6months',
  Yearly   = '1year',
}

/**
 * One subscription record per Masjid.
 * Created automatically when SuperAdmin approves a Masjid.
 */
export interface IMasjidSubscription extends Document {
  masjidRef:         mongoose.Types.ObjectId;
  status:            SubscriptionStatus;
  planType:          PlanType;
  /** When the free trial ends */
  trialEndsAt:       Date;
  /** When the current paid plan ends (null for trial/expired) */
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MasjidSubscriptionSchema = new Schema<IMasjidSubscription>(
  {
    masjidRef: {
      type:     Schema.Types.ObjectId,
      ref:      'Masjid',
      required: true,
      unique:   true,
    },
    status: {
      type:    String,
      enum:    Object.values(SubscriptionStatus),
      default: SubscriptionStatus.Trial,
    },
    planType: {
      type:    String,
      enum:    Object.values(PlanType),
      default: PlanType.Trial,
    },
    trialEndsAt:       { type: Date, required: true },
    currentPeriodEnd:  { type: Date, default: null },
  },
  { timestamps: true }
);

const MasjidSubscription: Model<IMasjidSubscription> =
  mongoose.model<IMasjidSubscription>('MasjidSubscription', MasjidSubscriptionSchema);
export default MasjidSubscription;
