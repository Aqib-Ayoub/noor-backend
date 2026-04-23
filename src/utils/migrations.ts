import Masjid from '../models/Masjid';
import { logInfo, logError } from './logger';

/** Charset without ambiguous chars (0, O, 1, I) */
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const makeId = (): string =>
  Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');

/**
 * Assigns unique shortIds to any Masjid documents that don't have one yet.
 * Safe to run on every startup — skips docs that already have a shortId.
 */
export async function backfillMasjidShortIds(): Promise<void> {
  try {
    // Find all masjids missing a shortId
    const missing = await Masjid.find({
      $or: [{ shortId: { $exists: false } }, { shortId: null }, { shortId: '' }],
    }).lean();

    if (missing.length === 0) {
      logInfo(`[Migration] All Masjids already have a shortId.`);
      return;
    }

    logInfo(`[Migration] Assigning shortIds to ${missing.length} Masjid(s)...`);

    for (const doc of missing) {
      let id: string;
      let exists = true;

      // Retry until unique
      do {
        id = makeId();
        exists = !!(await Masjid.exists({ shortId: id }));
      } while (exists);

      await Masjid.findByIdAndUpdate(doc._id, { shortId: id });
      logInfo(`[Migration] Assigned shortId=${id} to Masjid "${doc.name}" (${doc._id})`);
    }

    logInfo(`[Migration] Done — ${missing.length} Masjid(s) updated.`);
  } catch (err) {
    logError('[Migration] backfillMasjidShortIds failed', err);
  }
}
