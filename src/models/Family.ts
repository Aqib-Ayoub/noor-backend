import mongoose, { Document, Schema, Model } from 'mongoose';

/** TypeScript interface representing a Family document */
export interface IFamily extends Document {
  familyHead: mongoose.Types.ObjectId; // Reference to User
  masjidRef: mongoose.Types.ObjectId;  // Reference to Masjid
  membersCount: number;
  payPerPerson: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Mongoose schema for the Family collection */
const FamilySchema = new Schema<IFamily>(
  {
    /** The User who is the head of this family unit */
    familyHead: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    /** The Masjid this family is registered under */
    masjidRef: {
      type: Schema.Types.ObjectId,
      ref: 'Masjid',
      required: true,
    },

    /** Total number of members in this family */
    membersCount: {
      type: Number,
      required: true,
      min: 1,
    },

    /** Amount in INR each family member contributes per month */
    payPerPerson: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

/** Mongoose model for the Family collection */
const Family: Model<IFamily> = mongoose.model<IFamily>('Family', FamilySchema);
export default Family;
