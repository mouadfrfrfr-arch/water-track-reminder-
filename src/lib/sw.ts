"use client";

/**
 * Service worker registration + scheduling helpers (client-side).
 *
 * The SW lives at `/sw.js` (top-level scope). Its only job is to fire
 * notifications on schedule and forward `notificationclick` events back to
 * the page so the in-app takeover can render.
 *
 * Two scheduling strategies:
 *   - Chrome / Edge (desktop + Android): TimestampTrigger via showTrigger.
 *     This wakes the SW even if the page is closed and the screen is off.
 *   - Safari (iOS / macOS): no triggers API. Foreground-only fallback —
 *     the in-app interval tick catches passed slots when the page is open.
 *     A UA banner in the Reminders tab tells the user this honestly.
 */

import type { ReminderConfig } from "./appEvents";
import { computeSlots, type ReminderSlot } from "./reminderSlots";

const SW_URL = "/sw.js";

let registration: ServiceWorkerRegistration | null = null;

/** True if the browser exposes Notification Triggers (Chromium only today). */
export function hasNotificationTriggers(): boolean {
  if (typeof window === "undefined") return false;
  // TimestampTrigger is the marker; it lives on the global in Chrome/Edge
  // and is absent in Safari/Firefox. We never reference the constructor by
  // name elsewhere — only the SW posts the trigger metadata.
  return (
    typeof (globalThis as { TimestampTrigger?: unknown }).TimestampTrigger !==
    "undefined"
  );
}

/** Crude UA-based iOS detection — used to surface the honesty banner. */
export function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Mac/.test(ua) && "ontouchend" in document);
}

export async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    registration = await navigator.serviceWorker.register(SW_URL);
    return registration;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * Re-register all slots in the next `daysAhead` window via the SW. Called
 * on Reminders save AND on every `visibilitychange → visible` (foreground
 * reschedule). The SW dedupes by tag; safe to call repeatedly.
 */
export async function scheduleNext30Days(
  config: ReminderConfig,
  daysAhead = 30,
): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const reg = registration ?? (await navigator.serviceWorker.getRegistration());
  if (!reg || !reg.active) return;
  const slots = computeSlots(config, new Date(), daysAhead);
  reg.active.postMessage({ type: "SCHEDULE", slots, sound: config.sound });
}

/**
 * Foreground-only fallback: walks the slot list and dispatches
 * `reminder/fire` for any slot whose time has passed since `since`. Used by
 * useHydraStore's tick effect to catch reminders on Safari and to make
 * "Test Reminder" instant in Playwright.
 */
export function passedSlots(
  config: ReminderConfig,
  since: Date,
  now: Date,
): ReminderSlot[] {
  if (!config.enabled || since.getTime() >= now.getTime()) return [];
  // We pull the next ~2 days of slots and filter by time window. Cheap.
  const horizon = computeSlots(config, since, 2);
  return horizon.filter((s) => {
    const at = Date.parse(s.atIso);
    return at > since.getTime() && at <= now.getTime();
  });
}
