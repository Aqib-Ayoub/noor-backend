import mongoose, { Document, Schema, Model } from 'mongoose';

/**
 * Singleton document that holds all subscription pricing and trial config.
 * SuperAdmin updates this via /api/admin/subscription-config.
 * Only one document should ever exist (use upsert).
 */
export interface ISubscriptionConfig extends Document {
  trialDays:          number;   // How many free trial days after Masjid is approved
  monthlyPrice:       number;   // Price in INR for 1-month plan
  sixMonthPrice:      number;   // Price in INR for 6-month plan
  yearlyPrice:        number;   // Price in INR for 1-year plan
  sixMonthDiscount:   number;   // Discount % shown on 6-month card (display only)
  yearlyDiscount:     number;   // Discount % shown on yearly card (display only)
  updatedAt: Date;
}

const SubscriptionConfigSchema = new Schema<ISubscriptionConfig>(
  {
    trialDays:        { type: Number, default: 30,   min: 0 },
    monthlyPrice:     { type: Number, default: 299,  min: 0 },
    sixMonthPrice:    { type: Number, default: 1499, min: 0 },
    yearlyPrice:      { type: Number, default: 2499, min: 0 },
    sixMonthDiscount: { type: Number, default: 15,   min: 0, max: 100 },
    yearlyDiscount:   { type: Number, default: 25,   min: 0, max: 100 },
  },
  { timestamps: true }
);

const SubscriptionConfig: Model<ISubscriptionConfig> =
  mongoose.model<ISubscriptionConfig>('SubscriptionConfig', SubscriptionConfigSchema);
export default SubscriptionConfig;
