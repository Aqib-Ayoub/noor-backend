import mongoose, { Document, Schema, Model } from 'mongoose';

export enum MasjidStatus {
  Pending   = 'PENDING',
  Approved  = 'APPROVED',
  Rejected  = 'REJECTED',
  Suspended = 'SUSPENDED',
}

export type PrayerOverrides = {
  Fajr?:    number;
  Dhuhr?:   number;
  Asr?:     number;
  Maghrib?: number;
  Isha?:    number;
};

/** Generates a random 6-character alphanumeric short ID (uppercase) */
const generateShortId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0,O,1,I (ambiguous)
  return Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
};

export interface IMasjid extends Document {
  name:              string;
  city:              string;
  address:           string;
  /** 6-char unique short ID shown to members for join requests */
  shortId:           string;
  phone?:            string;
  accountNumber?:    string;
  adminRef:          mongoose.Types.ObjectId;
  coAdmins:          mongoose.Types.ObjectId[];
  imamName?:         string;
  imamSalary:        number;
  savings:           number;
  prayerOverrides:   PrayerOverrides;
  customPrayerTimes: Partial<Record<'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha', string>>;
  approvedStatus:    MasjidStatus;
  backgroundImageUrl?: string;
  hadithOfTheDay?:   string;
  createdAt: Date;
  updatedAt: Date;
}

const MasjidSchema = new Schema<IMasjid>(
  {
    name:    { type: String, required: true, trim: true },
    city:    { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },

    /** Unique 6-char code for joining — auto-generated on first save */
    shortId: {
      type:   String,
      unique: true,
      sparse: true,  // allows null during migration, still unique when set
      trim:   true,
      uppercase: true,
    },

    phone:         { type: String, trim: true, default: null },
    accountNumber: { type: String, trim: true, default: null },

    adminRef: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    coAdmins: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],

    imamName:   { type: String, trim: true, default: null },
    imamSalary: { type: Number, default: 0, min: 0 },
    savings:    { type: Number, default: 0, min: 0 },

    prayerOverrides: {
      type: Schema.Types.Mixed,
      default: {},
    },

    customPrayerTimes: {
      type: Schema.Types.Mixed,
      default: {},
    },

    approvedStatus: {
      type: String,
      enum: Object.values(MasjidStatus),
      default: MasjidStatus.Pending,
    },

    backgroundImageUrl: { type: String, default: null },
    hadithOfTheDay:     { type: String, default: null },
  },
  { timestamps: true }
);

/** Auto-generate shortId on first save if not already set */
MasjidSchema.pre('save', async function () {
  if (!this.shortId) {
    let id: string;
    let exists = true;
    do {
      id = generateShortId();
      exists = !!(await mongoose.model('Masjid').findOne({ shortId: id }).lean());
    } while (exists);
    this.shortId = id!;
  }
});

const Masjid: Model<IMasjid> = mongoose.model<IMasjid>('Masjid', MasjidSchema);
export default Masjid;
