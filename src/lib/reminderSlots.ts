/**
 * Pure slot math for HydraBlue smart reminders.
 *
 * Given a ReminderConfig and a "now", compute the next N days of reminder
 * slots between wakeTime and sleepTime at `frequencyMin` spacing. Pure,
 * deterministic, no DOM / IDB / React deps so it can be unit-tested and
 * imported from both the main thread and the service worker.
 */

import type { ReminderConfig } from "./appEvents";

export type ReminderSlot = {
  /** Stable id derived from the ISO timestamp — used for dedup + queue keys. */
  id: string;
  /** ISO timestamp at which this slot fires. */
  atIso: string;
  /**
   * Human label shown in the takeover ("Morning hydration", "Before sleep",
   * …). Picked from `slotLabel()` based on time-of-day.
   */
  label: string;
};

/**
 * Parse "HH:MM" into minutes-since-midnight. Defaults to 0 if malformed.
 */
function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

/**
 * Contextual label based on time-of-day. These are user-visible in the
 * takeover; keep them short + warm.
 */
export function slotLabel(at: Date): string {
  const minutes = at.getHours() * 60 + at.getMinutes();
  if (minutes < 9 * 60) return "Morning hydration";
  if (minutes < 11 * 60) return "Mid-morning sip";
  if (minutes < 13 * 60) return "Before lunch";
  if (minutes < 15 * 60) return "Afternoon refresh";
  if (minutes < 17 * 60) return "Stay sharp";
  if (minutes < 19 * 60) return "Evening hydration";
  if (minutes < 21 * 60) return "Before dinner";
  return "Wind down — drink before sleep";
}

/**
 * Deterministic id from a Date — used so the same slot keeps its id across
 * reschedules and the SW can dedup notifications.
 */
function slotId(at: Date): string {
  return `slot-${at.toISOString()}`;
}

/**
 * Compute reminder slots strictly AFTER `now` and within `daysAhead` days.
 * Returns [] if reminders are disabled. Wakes/sleeps are interpreted in the
 * local time zone (same convention used by `streak.ts`).
 *
 * When sleepTime is "earlier" than wakeTime (e.g. wake 07:00, sleep 01:30),
 * we treat sleep as next-day — common for night-owl schedules.
 */
export function computeSlots(
  config: ReminderConfig,
  now: Date,
  daysAhead: number,
): ReminderSlot[] {
  if (!config.enabled) return [];
  const freq = Math.max(15, config.frequencyMin | 0);
  const wake = parseHm(config.wakeTime);
  const sleep = parseHm(config.sleepTime);
  const sleepOffsetMin = sleep <= wake ? sleep + 24 * 60 : sleep;

  const slots: ReminderSlot[] = [];
  const startDay = new Date(now);
  startDay.setHours(0, 0, 0, 0);

  for (let day = 0; day <= daysAhead; day++) {
    const dayStart = new Date(startDay);
    dayStart.setDate(dayStart.getDate() + day);
    for (let m = wake; m <= sleepOffsetMin; m += freq) {
      const at = new Date(dayStart);
      at.setMinutes(at.getMinutes() + m);
      if (at <= now) continue;
      if (at.getTime() - now.getTime() > daysAhead * 86400000) break;
      slots.push({ id: slotId(at), atIso: at.toISOString(), label: slotLabel(at) });
    }
  }

  return slots;
}

/**
 * Convenience: the single next slot after `now`, or null if none in the
 * given horizon. Used by the foreground re-scheduling loop.
 */
export function nextSlot(
  config: ReminderConfig,
  now: Date,
  daysAhead = 30,
): ReminderSlot | null {
  const slots = computeSlots(config, now, daysAhead);
  return slots[0] ?? null;
}
