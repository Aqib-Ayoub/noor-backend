import mongoose, { Document, Schema, Model } from 'mongoose';

/** Enumeration of all possible user roles in the Noor platform */
export enum UserRole {
  SuperAdmin  = 'SuperAdmin',
  MasjidAdmin = 'MasjidAdmin',
  User        = 'User',
}

/** TypeScript interface representing a User document */
export interface IUser extends Document {
  phone: string;
  name: string;
  city?: string;           // Optional — not required for regular users
  role: UserRole;
  masjidRef?: mongoose.Types.ObjectId;
  email?: string;          // SuperAdmin only
  passwordHash?: string;   // SuperAdmin only
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    /** City is no longer required for regular users — only stored for legacy/admin reasons */
    city: {
      type: String,
      trim: true,
      default: null,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.User,
    },
    masjidRef: {
      type: Schema.Types.ObjectId,
      ref: 'Masjid',
      default: null,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
    },
  },
  { timestamps: true }
);

const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
export default User;
