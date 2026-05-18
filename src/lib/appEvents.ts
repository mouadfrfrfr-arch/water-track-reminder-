/**
 * Typed event router for HydraBlue.
 *
 * Rules:
 *  - Every interactive button funnels through `dispatch(event)`.
 *  - The dispatcher is the only place that writes to the store (db.ts).
 *  - In CI, `window.__hydraTestHook` captures dispatched events so the
 *    Playwright smoke test can assert that each visible button actually
 *    triggers a known event. Dead code in production (the global is never set).
 *  - See plan.md §5 for the full wiring guarantee.
 */

import type { Entry } from "./db";
import type { ReminderSlot } from "./reminderSlots";
import type { BackupV2Data } from "./backup";

export type ReminderConfig = {
  enabled: boolean;
  wakeTime: string;
  sleepTime: string;
  frequencyMin: number;
  sound: string;
};

export type Profile = {
  name: string;
  weightKg: number;
  activity: "Sedentary" | "Moderate" | "Active";
  climate: "Cold" | "Mild" | "Hot";
};

export type AppEvent =
  | { type: "intake/add"; ml: number; label: string }
  | { type: "intake/remove"; id: string }
  | { type: "reminder/save"; config: ReminderConfig }
  // Reminder lifecycle — see ReminderTakeover + useHydraStore for queue logic.
  // `reminder/fire` is dispatched both by the foreground scheduler (when a
  // slot's atIso passes while the app is open) and by the SW message handler
  // (when a notification is clicked from outside the app).
  | { type: "reminder/fire"; slot: ReminderSlot }
  | { type: "reminder/dismiss"; slotId: string }
  | { type: "reminder/skip"; slotId: string }
  | { type: "profile/save"; profile: Profile }
  | { type: "goal/set"; ml: number }
  | { type: "onboarding/complete"; name: string; goalMl: number }
  // Security lifecycle. `pin/set` enables encryption-at-rest and seeds the
  // session key; `pin/unlock` derives the key from the entered PIN +
  // persisted salt; `pin/clear` reverses encryption back to plain.
  | { type: "pin/set"; pin: string }
  | { type: "pin/clear" }
  | { type: "pin/unlock"; pin: string }
  // Backup lifecycle. `backup/export` reads the live snapshot and triggers
  // a JSON download; `backup/import` replaces store state with the parsed
  // BackupV2 payload (called by Profile's <input type="file"> handler).
  | { type: "backup/export" }
  | { type: "backup/import"; data: BackupV2Data }
  | { type: "data/reset" }
  // Pure UI acknowledgement. Dispatched by buttons that only toggle
  // local UI state (e.g. opening a confirmation stage, canceling out
  // of a sub-form) so the dispatcher contract — and the Playwright
  // smoke test that asserts it — sees every visible button funnel
  // through the same event router. The store ignores this event.
  | { type: "ui/ack"; intent: string };

export type AppEventHandler = (event: AppEvent) => Promise<void> | void;

let handler: AppEventHandler | null = null;

export function registerDispatcher(h: AppEventHandler): () => void {
  handler = h;
  return () => {
    if (handler === h) handler = null;
  };
}

declare global {
  interface Window {
    __hydraTestHook?: (e: AppEvent) => void;
  }
}

export async function dispatch(event: AppEvent): Promise<void> {
  if (typeof window !== "undefined" && window.__hydraTestHook) {
    try {
      window.__hydraTestHook(event);
    } catch {
      // never let the test hook crash production paths
    }
  }
  if (!handler) {
    // No dispatcher registered yet — happens during SSR / first paint.
    // The store hook installs one in its effect; any event before that is
    // either a bug or a too-early click on a hydrated component.
    if (process.env.NODE_ENV !== "production") {
      console.warn("dispatch() called before store mounted", event);
    }
    return;
  }
  await handler(event);
}

// Re-export the seed shapes that consumers reach for via this barrel.
export type { Entry };
export type { ReminderSlot } from "./reminderSlots";

/**
 * Persisted queue of reminder slots. `current` is the one shown in the
 * full-screen takeover; `pending` accumulates additional slots that fired
 * while the takeover was already open (we never stack two overlays).
 */
export type ReminderQueue = {
  current: ReminderSlot | null;
  pending: ReminderSlot[];
};

export const EMPTY_REMINDER_QUEUE: ReminderQueue = {
  current: null,
  pending: [],
};
