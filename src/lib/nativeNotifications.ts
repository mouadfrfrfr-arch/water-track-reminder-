/**
 * Capacitor bridge for HydraBlue reminders on Android.
 *
 * Mirrors `src/lib/sw.ts` (Web Service Worker path) but uses
 * `@capacitor/local-notifications` so reminders fire via Android's
 * AlarmManager — which is what makes them deliver while the phone is
 * locked and the app is closed (the image 2 UX from the user's reference).
 *
 * All exports are safe no-ops on web (they bail on `!isNative()`), so
 * components can call them unconditionally if it simplifies wiring.
 */

import {
  LocalNotifications,
  type LocalNotificationSchema,
  type ActionPerformed,
} from "@capacitor/local-notifications";
import { computeSlots, type ReminderSlot } from "./reminderSlots";
import type { ReminderConfig } from "./appEvents";
import { isNative } from "./platform";

const CHANNEL_ID = "hydrablue-reminders";
const ACTION_TYPE_ID = "HYDRABLUE_REMINDER";
const DAYS_AHEAD_DEFAULT = 7;

export type NativeNotificationActionId = "ADD_WATER" | "tap";

export type NativeNotificationHandler = (
  slot: ReminderSlot,
  actionId: NativeNotificationActionId,
) => void;

/**
 * Request POST_NOTIFICATIONS permission (Android 13+). On older Android
 * the plugin returns `granted` without showing a prompt.
 */
export async function ensurePermission(): Promise<boolean> {
  if (!isNative()) return false;
  const status = await LocalNotifications.checkPermissions();
  if (status.display === "granted") return true;
  const after = await LocalNotifications.requestPermissions();
  return after.display === "granted";
}

/**
 * Create the high-importance notification channel HydraBlue uses. Channel
 * creation is idempotent — calling it on every boot is safe.
 *
 * `importance: 5` is IMPORTANCE_HIGH → heads-up + lock-screen visibility,
 * which gives the alarm-style behaviour the user asked for.
 */
export async function ensureChannel(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: "Hydration reminders",
    description: "Scheduled water reminders",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  });
}

/**
 * Register the action buttons that appear inside the notification itself.
 * Currently a single `Add 250ml` action; Snooze can be added in a follow-up.
 */
export async function registerActionTypes(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE_ID,
        actions: [{ id: "ADD_WATER", title: "Add 250ml" }],
      },
    ],
  });
}

/**
 * FNV-1a 32-bit hash of the slot id, top bit cleared so the result fits
 * in a positive int32 (LocalNotifications.id constraint).
 */
function hashSlotId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 1;
}

/**
 * Cancel any HydraBlue notifications we've previously scheduled, then
 * schedule the next `daysAhead` window.
 *
 * Called from `HydraBlueApp` on:
 *   - first paint (after the queue/store hydrates)
 *   - every `reminder/save` (config changed)
 *   - every `visibilitychange` to visible (so a brief background trim
 *     doesn't leave the schedule empty when the user returns)
 */
export async function scheduleNative(
  config: ReminderConfig,
  daysAhead: number = DAYS_AHEAD_DEFAULT,
): Promise<void> {
  if (!isNative()) return;
  if (!config.enabled) {
    await cancelAllNative();
    return;
  }

  await ensureChannel();
  const granted = await ensurePermission();
  if (!granted) return;

  await cancelAllNative();

  const slots = computeSlots(config, new Date(), daysAhead);
  if (slots.length === 0) return;

  const schemas: LocalNotificationSchema[] = slots.map((slot) => ({
    id: hashSlotId(slot.id),
    title: "HydraBlue",
    body: slot.label,
    schedule: {
      at: new Date(Date.parse(slot.atIso)),
      allowWhileIdle: true,
    },
    channelId: CHANNEL_ID,
    smallIcon: "ic_notification",
    actionTypeId: ACTION_TYPE_ID,
    extra: { slot },
  }));

  await LocalNotifications.schedule({ notifications: schemas });
}

async function cancelAllNative(): Promise<void> {
  const { notifications: pending } = await LocalNotifications.getPending();
  if (pending.length === 0) return;
  await LocalNotifications.cancel({
    notifications: pending.map((n) => ({ id: n.id })),
  });
}

/**
 * Wire native notification events to a single page-side handler.
 *
 * Returns a detach function (cleanup for React effects). Caller is
 * expected to dispatch `intake/add` + `reminder/dismiss` on ADD_WATER and
 * `reminder/fire` on bare tap — matches the SW message bridge contract.
 */
export function attachListeners(
  onNotification: NativeNotificationHandler,
): () => void {
  if (!isNative()) return () => {};

  const handles: Array<{ remove: () => Promise<void> }> = [];

  void LocalNotifications.addListener(
    "localNotificationActionPerformed",
    (event: ActionPerformed) => {
      const extra = event.notification.extra as
        | { slot?: ReminderSlot }
        | undefined;
      const slot = extra?.slot;
      if (!slot) return;
      const actionId: NativeNotificationActionId =
        event.actionId === "ADD_WATER" ? "ADD_WATER" : "tap";
      onNotification(slot, actionId);
    },
  ).then((h) => handles.push(h));

  // Foreground: fired when the notification arrives while the app is open.
  // We surface this as a bare-tap so the takeover opens immediately.
  void LocalNotifications.addListener(
    "localNotificationReceived",
    (received) => {
      const extra = received.extra as { slot?: ReminderSlot } | undefined;
      const slot = extra?.slot;
      if (!slot) return;
      onNotification(slot, "tap");
    },
  ).then((h) => handles.push(h));

  return () => {
    for (const h of handles) void h.remove();
  };
}
