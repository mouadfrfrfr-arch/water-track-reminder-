"use client";

/**
 * Single hook that wires:
 *   IndexedDB (db.ts) <-- write-through -- dispatcher (appEvents.ts) <-- UI buttons
 *
 * Components never touch IDB directly. All mutations go through `dispatch()`.
 * On mount, the hook hydrates from IDB (one read), registers the dispatcher,
 * and returns the in-memory store. After every successful mutation, the
 * affected slice is re-read from IDB so React state stays in sync.
 *
 * See plan.md §3d (data flow) and §5a (event router).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  entriesAll,
  entryAdd,
  entryRemove,
  getOrCreateDeviceId,
  kvGet,
  kvSet,
  type Entry,
} from "./db";
import {
  dispatch,
  registerDispatcher,
  EMPTY_REMINDER_QUEUE,
  type AppEvent,
  type Profile,
  type ReminderConfig,
  type ReminderQueue,
} from "./appEvents";

const DEFAULT_GOAL_ML = 2500;

const DEFAULT_PROFILE: Profile = {
  name: "",
  weightKg: 70,
  activity: "Sedentary",
  climate: "Mild",
};

const DEFAULT_REMINDERS: ReminderConfig = {
  enabled: true,
  wakeTime: "07:00",
  sleepTime: "22:30",
  frequencyMin: 45,
  sound: "pure_drop",
};

export type HydraState = {
  ready: boolean;
  entries: Entry[];
  goalMl: number;
  profile: Profile;
  reminders: ReminderConfig;
  reminderQueue: ReminderQueue;
  hasCompletedOnboarding: boolean;
};

function genEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useHydraStore() {
  const [state, setState] = useState<HydraState>({
    ready: false,
    entries: [],
    goalMl: DEFAULT_GOAL_ML,
    profile: DEFAULT_PROFILE,
    reminders: DEFAULT_REMINDERS,
    reminderQueue: EMPTY_REMINDER_QUEUE,
    hasCompletedOnboarding: false,
  });
  const mounted = useRef(false);

  // Hydrate from IDB on mount.
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        await getOrCreateDeviceId(); // ensure a per-device id exists
        const [entries, goalMl, profile, reminders, reminderQueue, onboarded] =
          await Promise.all([
            entriesAll(),
            kvGet<number>("goal"),
            kvGet<Profile>("profile"),
            kvGet<ReminderConfig>("reminders"),
            kvGet<ReminderQueue>("reminderQueue"),
            kvGet<boolean>("onboarded"),
          ]);
        if (cancelled) return;
        setState({
          ready: true,
          entries: entries.sort((a, b) => b.atIso.localeCompare(a.atIso)),
          goalMl: goalMl ?? DEFAULT_GOAL_ML,
          profile: profile ?? DEFAULT_PROFILE,
          reminders: reminders ?? DEFAULT_REMINDERS,
          reminderQueue: reminderQueue ?? EMPTY_REMINDER_QUEUE,
          hasCompletedOnboarding: onboarded === true,
        });
      } catch {
        // IDB unavailable (e.g. SSR or private mode without storage)
        // fall back to in-memory defaults but mark ready so UI renders.
        if (!cancelled) setState((s) => ({ ...s, ready: true }));
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, []);

  // Register dispatcher.
  const handler = useCallback(async (event: AppEvent) => {
    switch (event.type) {
      case "intake/add": {
        const entry: Entry = {
          id: genEntryId(),
          ml: event.ml,
          label: event.label,
          atIso: new Date().toISOString(),
        };
        await entryAdd(entry);
        setState((s) => ({
          ...s,
          entries: [entry, ...s.entries],
        }));
        return;
      }
      case "intake/remove": {
        await entryRemove(event.id);
        setState((s) => ({
          ...s,
          entries: s.entries.filter((e) => e.id !== event.id),
        }));
        return;
      }
      case "goal/set": {
        await kvSet("goal", event.ml);
        setState((s) => ({ ...s, goalMl: event.ml }));
        return;
      }
      case "profile/save": {
        await kvSet("profile", event.profile);
        setState((s) => ({ ...s, profile: event.profile }));
        return;
      }
      case "reminder/save": {
        await kvSet("reminders", event.config);
        setState((s) => ({ ...s, reminders: event.config }));
        return;
      }
      case "reminder/fire": {
        // Queue model: if nothing is showing, this becomes `current`; if
        // another takeover is already open, append to `pending`. Slots are
        // deduplicated by id so a re-dispatch (e.g. SW message + foreground
        // tick both fire for the same id) is a no-op.
        let next: ReminderQueue | null = null;
        setState((s) => {
          const inFlight =
            s.reminderQueue.current?.id === event.slot.id ||
            s.reminderQueue.pending.some((p) => p.id === event.slot.id);
          if (inFlight) {
            next = s.reminderQueue;
            return s;
          }
          const q: ReminderQueue =
            s.reminderQueue.current === null
              ? { current: event.slot, pending: s.reminderQueue.pending }
              : {
                  current: s.reminderQueue.current,
                  pending: [...s.reminderQueue.pending, event.slot],
                };
          next = q;
          return { ...s, reminderQueue: q };
        });
        if (next) await kvSet("reminderQueue", next);
        return;
      }
      case "reminder/dismiss": {
        // Pop `current`; promote the next pending slot (if any) into
        // `current`. Used by the takeover's X / "Add Water" CTA.
        let next: ReminderQueue | null = null;
        setState((s) => {
          if (
            !s.reminderQueue.current ||
            s.reminderQueue.current.id !== event.slotId
          ) {
            return s;
          }
          const [head, ...rest] = s.reminderQueue.pending;
          const q: ReminderQueue = {
            current: head ?? null,
            pending: rest,
          };
          next = q;
          return { ...s, reminderQueue: q };
        });
        if (next) await kvSet("reminderQueue", next);
        return;
      }
      case "reminder/skip": {
        // Same shape as dismiss but emits a distinct event so analytics /
        // future UI (e.g. snooze) can distinguish "I drank" vs "not now".
        let next: ReminderQueue | null = null;
        setState((s) => {
          let q: ReminderQueue;
          if (s.reminderQueue.current?.id === event.slotId) {
            const [head, ...rest] = s.reminderQueue.pending;
            q = { current: head ?? null, pending: rest };
          } else {
            q = {
              current: s.reminderQueue.current,
              pending: s.reminderQueue.pending.filter(
                (p) => p.id !== event.slotId,
              ),
            };
          }
          next = q;
          return { ...s, reminderQueue: q };
        });
        if (next) await kvSet("reminderQueue", next);
        return;
      }
      case "onboarding/complete": {
        const nextProfile: Profile = {
          ...DEFAULT_PROFILE,
          name: event.name,
        };
        await Promise.all([
          kvSet("profile", nextProfile),
          kvSet("goal", event.goalMl),
          kvSet("onboarded", true),
        ]);
        setState((s) => ({
          ...s,
          profile: nextProfile,
          goalMl: event.goalMl,
          hasCompletedOnboarding: true,
        }));
        return;
      }
    }
  }, []);

  useEffect(() => registerDispatcher(handler), [handler]);

  return { state, dispatch };
}

export { DEFAULT_GOAL_ML };
