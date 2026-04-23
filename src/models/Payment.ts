import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPayment extends Document {
  familyRef:  mongoose.Types.ObjectId;   // Family._id
  masjidRef:  mongoose.Types.ObjectId;   // Masjid._id
  userRef:    mongoose.Types.ObjectId;   // family head User._id
  month:      number;                    // 1–12
  year:       number;                    // e.g. 2025
  amount:     number;                    // total amount paid
  paidAt:     Date;
  createdAt:  Date;
  updatedAt:  Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    familyRef: { type: Schema.Types.ObjectId, ref: 'Family', required: true },
    masjidRef: { type: Schema.Types.ObjectId, ref: 'Masjid', required: true },
    userRef:   { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    month:     { type: Number, required: true, min: 1, max: 12 },
    year:      { type: Number, required: true },
    amount:    { type: Number, required: true, min: 0 },
    paidAt:    { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

/** Compound index — one payment record per family per month/year */
PaymentSchema.index({ familyRef: 1, month: 1, year: 1 }, { unique: true });

const Payment: Model<IPayment> = mongoose.model<IPayment>('Payment', PaymentSchema);
export default Payment;
