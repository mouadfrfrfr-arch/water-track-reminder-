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
  | { type: "profile/save"; profile: Profile }
  | { type: "goal/set"; ml: number }
  | { type: "onboarding/complete"; name: string; goalMl: number };

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
