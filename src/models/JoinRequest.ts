import mongoose, { Document, Schema, Model } from 'mongoose';

/** Status lifecycle of a user's request to join a Masjid */
export enum JoinRequestStatus {
  Pending  = 'PENDING',
  Approved = 'APPROVED',
  Rejected = 'REJECTED',
}

/** TypeScript interface representing a join request document */
export interface IJoinRequest extends Document {
  userId: mongoose.Types.ObjectId;    // The user sending the request
  masjidId: mongoose.Types.ObjectId;  // The Masjid they want to join
  membersCount: number;               // Family size
  status: JoinRequestStatus;
  createdAt: Date;
  updatedAt: Date;
}

const JoinRequestSchema = new Schema<IJoinRequest>(
  {
    /** The user requesting to join */
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    /** The target Masjid */
    masjidId: {
      type: Schema.Types.ObjectId,
      ref: 'Masjid',
      required: true,
    },
    /** Number of family members (used to calculate monthly dues) */
    membersCount: {
      type: Number,
      required: true,
      min: 1,
    },
    /** Current status — set by MasjidAdmin */
    status: {
      type: String,
      enum: Object.values(JoinRequestStatus),
      default: JoinRequestStatus.Pending,
    },
  },
  { timestamps: true }
);

// One pending request per user per masjid
JoinRequestSchema.index({ userId: 1, masjidId: 1 }, { unique: true });

const JoinRequest: Model<IJoinRequest> = mongoose.model<IJoinRequest>('JoinRequest', JoinRequestSchema);
export default JoinRequest;
