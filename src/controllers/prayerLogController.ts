import { Request, Response } from 'express';
import PrayerLog from '../models/PrayerLog';
import mongoose from 'mongoose';

// ── Points per prayer (based on rakats) ──────────────────────────────────────
const PRAYER_POINTS: Record<string, number> = {
  Fajr:    4,
  Dhuhr:   4,
  Asr:     4,
  Maghrib: 3,
  Isha:    4,
};

// ── Milestone bonuses ─────────────────────────────────────────────────────────
const MILESTONES = [
  { days: 3,  bonus: 50  },
  { days: 6,  bonus: 50  },
  { days: 30, bonus: 100 },
  { days: 60, bonus: 200 },
];

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

/** Returns today's date string "YYYY-MM-DD" */
function todayStr(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Date string N days before a given date string */
function prevDateStr(dateStr: string, days = 1): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() - days);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Recalculate total points for a prayers map */
function calcPoints(prayers: Record<string, boolean>): number {
  return Object.entries(prayers).reduce(
    (sum, [name, done]) => sum + (done ? (PRAYER_POINTS[name] ?? 0) : 0),
    0
  );
}

/** True if all 5 prayers are marked done */
function allDone(prayers: Record<string, boolean>): boolean {
  return PRAYER_ORDER.every(n => prayers[n] === true);
}

// ── tick ──────────────────────────────────────────────────────────────────────

/**
 * POST /api/prayer-log/tick
 * Body: { prayerName: string, date?: string }
 *
 * Toggles the prayer completion for the given day (defaults to today).
 * Returns the updated log for that day.
 */
export async function tickPrayer(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const { prayerName, date } = req.body as { prayerName?: string; date?: string };
    if (!prayerName || !(prayerName in PRAYER_POINTS)) {
      res.status(400).json({ success: false, message: 'Invalid prayerName' });
      return;
    }

    const logDate = date ?? todayStr();

    let log = await PrayerLog.findOne({ userId, date: logDate });
    if (!log) {
      log = new PrayerLog({
        userId,
        date: logDate,
        prayers: { Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false },
        points: 0,
      });
    }

    const prayers = { ...(log.prayers as Record<string, boolean>) };
    prayers[prayerName] = !prayers[prayerName];
    log.prayers = prayers;
    log.points  = calcPoints(prayers);
    log.markModified('prayers');
    await log.save();

    res.json({
      success: true,
      data: { date: logDate, prayers: log.prayers, points: log.points },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: String(err) });
  }
}

// ── getStreak ─────────────────────────────────────────────────────────────────

/**
 * GET /api/prayer-log/streak
 *
 * Returns streak stats + today's prayer state.
 */
export async function getStreak(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?._id as mongoose.Types.ObjectId | undefined;
    if (!userId) { res.status(401).json({ success: false, message: 'Unauthorized' }); return; }

    const today = todayStr();

    // Fetch all logs sorted descending
    const allLogs = await PrayerLog.find({ userId }).sort({ date: -1 }).lean();

    const logMap = new Map(allLogs.map(l => [l.date, l.prayers as Record<string, boolean>]));

    // ── Current streak (walking back from today) ──────────────────────────────
    let currentStreak = 0;
    {
      let cursor = today;
      while (true) {
        const p = logMap.get(cursor);
        if (p && allDone(p)) {
          currentStreak++;
          cursor = prevDateStr(cursor);
        } else {
          break;
        }
      }
    }

    // ── Longest streak ────────────────────────────────────────────────────────
    let longestStreak = 0;
    {
      const doneDates = allLogs
        .filter(l => allDone(l.prayers as Record<string, boolean>))
        .map(l => l.date)
        .sort();

      let run = 0;
      for (let i = 0; i < doneDates.length; i++) {
        if (i === 0) { run = 1; }
        else {
          const expected = prevDateStr(doneDates[i], -1); // next day after doneDates[i-1]
          // Easier: compare if doneDates[i] is exactly one day after doneDates[i-1]
          const prev = new Date(doneDates[i - 1] + 'T00:00:00');
          prev.setDate(prev.getDate() + 1);
          const nextExpected = [
            prev.getFullYear(),
            String(prev.getMonth() + 1).padStart(2, '0'),
            String(prev.getDate()).padStart(2, '0'),
          ].join('-');
          if (nextExpected === doneDates[i]) { run++; } else { run = 1; }
        }
        longestStreak = Math.max(longestStreak, run);
      }
    }

    // ── This week count (Mon-Sun) ─────────────────────────────────────────────
    let weekCount = 0;
    {
      const now = new Date();
      const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1; // Mon=0
      for (let d = 0; d <= dayOfWeek; d++) {
        const check = new Date(now);
        check.setDate(now.getDate() - dayOfWeek + d);
        const ds = [
          check.getFullYear(),
          String(check.getMonth() + 1).padStart(2, '0'),
          String(check.getDate()).padStart(2, '0'),
        ].join('-');
        const p = logMap.get(ds);
        if (p && allDone(p)) weekCount++;
      }
    }

    // ── This month count ──────────────────────────────────────────────────────
    let monthCount = 0;
    {
      const prefix = today.slice(0, 7); // "YYYY-MM"
      allLogs.forEach(l => {
        if (l.date.startsWith(prefix) && allDone(l.prayers as Record<string, boolean>)) monthCount++;
      });
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    const totalPoints = allLogs.reduce((s, l) => s + (l.points ?? 0), 0);
    const todayLog    = allLogs.find(l => l.date === today);
    const todayPrayers = (todayLog?.prayers ?? {
      Fajr: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false,
    }) as Record<string, boolean>;
    const todayPoints = todayLog?.points ?? 0;

    // ── Next milestone ────────────────────────────────────────────────────────
    const nextMilestone = MILESTONES.find(m => currentStreak < m.days) ?? null;

    res.json({
      success: true,
      data: {
        currentStreak,
        weekCount,
        monthCount,
        longestStreak,
        totalPoints,
        todayPoints,
        todayPrayers,
        nextMilestone: nextMilestone
          ? {
              days:      nextMilestone.days,
              bonus:     nextMilestone.bonus,
              remaining: nextMilestone.days - currentStreak,
            }
          : null,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: String(err) });
  }
}
