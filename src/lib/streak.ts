/**
 * Streak computation — plan.md §3e.
 *
 *  - "A day" is the user's local calendar date, NOT UTC. We bucket entries
 *    by `Date#toLocaleDateString("en-CA")` because `"en-CA"` formats as
 *    "YYYY-MM-DD", which sorts lexicographically.
 *  - The streak walks BACKWARDS FROM YESTERDAY. Counting today forward would
 *    penalize a user who opens the app at 8 AM before they've had a chance
 *    to drink anything. Today's progress shows separately as `todayMl`.
 */

import type { Entry } from "./db";

export function computeStreak(
  entries: Entry[],
  goalMl: number,
  now: Date = new Date(),
): { streak: number; todayMl: number } {
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA");

  const byDay = new Map<string, number>();
  for (const e of entries) {
    const k = dayKey(new Date(e.atIso));
    byDay.set(k, (byDay.get(k) ?? 0) + e.ml);
  }

  const todayMl = byDay.get(dayKey(now)) ?? 0;
  if (goalMl <= 0) return { streak: 0, todayMl };

  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - 1); // start at yesterday

  let streak = 0;
  // Bound the loop at a generous limit so a corrupted clock can't loop forever.
  for (let i = 0; i < 3650; i++) {
    const dayTotal = byDay.get(dayKey(cursor)) ?? 0;
    if (dayTotal < goalMl) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { streak, todayMl };
}

/**
 * Sum entries within a date range (inclusive). Used by History's weekly chart.
 */
export function sumInRange(
  entries: Entry[],
  fromIso: string,
  toIsoExclusive: string,
): number {
  let total = 0;
  for (const e of entries) {
    if (e.atIso >= fromIso && e.atIso < toIsoExclusive) total += e.ml;
  }
  return total;
}

/**
 * Group totals by local day (en-CA YYYY-MM-DD) over the trailing N days.
 * Returns oldest-first so chart bars render left-to-right chronologically.
 */
export function trailingDailyTotals(
  entries: Entry[],
  days: number,
  now: Date = new Date(),
): Array<{ key: string; date: Date; ml: number }> {
  const dayKey = (d: Date) => d.toLocaleDateString("en-CA");
  const byDay = new Map<string, number>();
  for (const e of entries) {
    const k = dayKey(new Date(e.atIso));
    byDay.set(k, (byDay.get(k) ?? 0) + e.ml);
  }
  const out: Array<{ key: string; date: Date; ml: number }> = [];
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const k = dayKey(cursor);
    out.push({ key: k, date: new Date(cursor), ml: byDay.get(k) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
