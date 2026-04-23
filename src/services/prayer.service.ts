import axios from 'axios';
import { PrayerOverrides } from '../models/Masjid';
import { logError } from '../utils/logger';

/** Srinagar, J&K coordinates */
const SRINAGAR_LATITUDE = 34.0837;
const SRINAGAR_LONGITUDE = 74.7973;
const PRAYER_METHOD = 2; // ISNA

export type PrayerName = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface PrayerTime {
  name:          PrayerName;
  time:          string;  // Raw API time  "HH:mm" 24hr
  adjustedTime:  string;  // After offset or custom override "HH:mm" 24hr
  displayTime:   string;  // 12-hour display "h:mm AM/PM"
  isCustom:      boolean; // true if admin set a custom time
}

interface AladhanTimings {
  Fajr: string; Sunrise: string; Dhuhr: string; Asr: string;
  Sunset: string; Maghrib: string; Isha: string;
  Imsak: string; Midnight: string;
}

/** Converts "HH:mm" 24hr → "h:mm AM" / "h:mm PM" */
export const to12hr = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
};

/** Applies a minute offset to "HH:mm". */
const applyOffset = (time: string, offsetMinutes: number): string => {
  const [hours, minutes] = time.split(':').map(Number);
  const total    = hours * 60 + minutes + offsetMinutes;
  const wrapped  = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60).toString().padStart(2, '0');
  const mn = (wrapped % 60).toString().padStart(2, '0');
  return `${h}:${mn}`;
};

export class PrayerService {
  /**
   * Gets today's prayer times.
   * @param overrides  - minute offset per prayer
   * @param customTimes - admin-set actual times (HH:mm 24hr) — takes priority over API + offset
   */
  async getPrayerTimes(
    overrides:    PrayerOverrides = {},
    customTimes:  Partial<Record<PrayerName, string>> = {}
  ): Promise<PrayerTime[]> {
    let apiTimings: Partial<AladhanTimings> = {};

    try {
      const today  = new Date();
      const dd     = today.getDate().toString().padStart(2, '0');
      const mm     = (today.getMonth() + 1).toString().padStart(2, '0');
      const yyyy   = today.getFullYear();
      const dateStr = `${dd}-${mm}-${yyyy}`;
      const url    = `https://api.aladhan.com/v1/timingsByCity/${dateStr}?city=Srinagar&country=India&method=${PRAYER_METHOD}`;
      const resp   = await axios.get<{ data: { timings: AladhanTimings } }>(url);
      apiTimings   = resp.data.data.timings;
    } catch (error) {
      logError('PrayerService: Failed to fetch from aladhan.com', error);
    }

    const prayers: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

    return prayers.map((name) => {
      const rawTime    = (apiTimings as any)[name] ?? '00:00';
      const isCustom   = !!customTimes[name];
      const adjusted   = isCustom
        ? customTimes[name]!
        : applyOffset(rawTime, overrides[name] ?? 0);

      return {
        name,
        time:        rawTime,
        adjustedTime: adjusted,
        displayTime:  to12hr(adjusted),
        isCustom,
      };
    });
  }
}
