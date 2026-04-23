import mongoose, { Document, Schema, Model } from 'mongoose';

/** Status lifecycle of a savings edit request */
export enum ChangeRequestStatus {
  Pending  = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

/** TypeScript interface for a savings change request */
export interface IChangeRequest extends Document {
  masjidId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  oldValue: number;
  newValue: number;
  status: ChangeRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ChangeRequestSchema = new Schema<IChangeRequest>(
  {
    /** The Masjid whose savings are being edited */
    masjidId: {
      type: Schema.Types.ObjectId,
      ref: 'Masjid',
      required: true,
    },
    /** The MasjidAdmin requesting the change */
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** Previous savings value */
    oldValue: { type: Number, required: true },
    /** Requested new savings value */
    newValue: { type: Number, required: true },
    /** SuperAdmin decision status */
    status: {
      type: String,
      enum: Object.values(ChangeRequestStatus),
      default: ChangeRequestStatus.Pending,
    },
  },
  { timestamps: true }
);

const ChangeRequest: Model<IChangeRequest> = mongoose.model<IChangeRequest>('ChangeRequest', ChangeRequestSchema);
export default ChangeRequest;
