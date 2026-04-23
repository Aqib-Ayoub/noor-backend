import mongoose, { Document, Schema, Model } from 'mongoose';

/** One record per user per calendar day (YYYY-MM-DD). */
export interface IPrayerLog extends Document {
  userId:   mongoose.Types.ObjectId;
  date:     string;   // 'YYYY-MM-DD' in user's local calendar
  prayers:  Record<string, boolean>; // { Fajr: true, Dhuhr: false, … }
  points:   number;   // total points earned this day
  createdAt: Date;
  updatedAt: Date;
}

const PrayerLogSchema = new Schema<IPrayerLog>(
  {
    userId: {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    /** ISO date string e.g. "2026-04-23" — no time component */
    date: {
      type:     String,
      required: true,
    },
    /**
     * Map of prayer name → prayed boolean.
     * Stored as a plain object in Mongo (not a Map type) for easy querying.
     */
    prayers: {
      type:    Schema.Types.Mixed,
      default: {
        Fajr:    false,
        Dhuhr:   false,
        Asr:     false,
        Maghrib: false,
        Isha:    false,
      },
    },
    points: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One log document per user per day
PrayerLogSchema.index({ userId: 1, date: 1 }, { unique: true });

const PrayerLog: Model<IPrayerLog> = mongoose.model<IPrayerLog>('PrayerLog', PrayerLogSchema);
export default PrayerLog;
