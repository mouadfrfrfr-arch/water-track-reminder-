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
 * Security: when a PIN is enabled, every IDB read/write is transparently
 * AES-GCM encrypted via the session key set in `db.ts`. On boot we read
 * `pinMeta` (always plaintext) first; if it's enabled we show the lock
 * screen and DEFER hydration until the user submits the correct PIN.
 *
 * See plan.md §3d (data flow) and §5a (event router).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  entriesAll,
  entriesClear,
  entryAdd,
  entryRemove,
  getOrCreateDeviceId,
  hasSessionKey,
  kvGet,
  kvSet,
  reencryptAll,
  resetAllData,
  setSessionKey,
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
import {
  buildBackup,
  downloadBackup,
  type BackupV2Data,
} from "./backup";
import {
  NO_PIN,
  setPin as derivePinMeta,
  verifyPin,
  type PinMeta,
} from "./pin";

const DEFAULT_GOAL_ML = 2500;
const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;
const HYDRA_VERSION = "0.4.0";

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
  /** True when a PIN is enabled (mirrors persisted pinMeta.enabled). */
  pinEnabled: boolean;
  /** True when a PIN is enabled and the user hasn't unlocked yet. */
  locked: boolean;
  /** Remaining attempts before lockout. Resets to MAX after LOCKOUT_MS. */
  pinAttemptsLeft: number;
  /** ISO timestamp when lockout expires, or null when not locked out. */
  lockoutUntilIso: string | null;
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
    pinEnabled: false,
    locked: false,
    pinAttemptsLeft: MAX_PIN_ATTEMPTS,
    lockoutUntilIso: null,
  });
  const mounted = useRef(false);

  /**
   * Read everything from IDB into React state. Called both on initial
   * mount (when no PIN is set) and after a successful unlock (so the
   * just-installed sessionKey can decrypt every stored value).
   */
  const hydrateAll = useCallback(async () => {
    const [entries, goalMl, profile, reminders, reminderQueue, onboarded] =
      await Promise.all([
        entriesAll(),
        kvGet<number>("goal"),
        kvGet<Profile>("profile"),
        kvGet<ReminderConfig>("reminders"),
        kvGet<ReminderQueue>("reminderQueue"),
        kvGet<boolean>("onboarded"),
      ]);
    setState((s) => ({
      ...s,
      ready: true,
      locked: false,
      entries: entries.sort((a, b) => b.atIso.localeCompare(a.atIso)),
      goalMl: goalMl ?? DEFAULT_GOAL_ML,
      profile: profile ?? DEFAULT_PROFILE,
      reminders: reminders ?? DEFAULT_REMINDERS,
      reminderQueue: reminderQueue ?? EMPTY_REMINDER_QUEUE,
      hasCompletedOnboarding: onboarded === true,
    }));
  }, []);

  // Hydrate from IDB on mount.
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    (async () => {
      try {
        await getOrCreateDeviceId(); // ensure a per-device id exists
        // pinMeta is always plaintext, so we can read it before unlock.
        const pinMeta = (await kvGet<PinMeta>("pinMeta")) ?? NO_PIN;
        if (cancelled) return;
        if (pinMeta.enabled) {
          // Defer hydration until the user enters the correct PIN.
          setState((s) => ({
            ...s,
            ready: true,
            pinEnabled: true,
            locked: true,
            pinAttemptsLeft: MAX_PIN_ATTEMPTS,
          }));
          return;
        }
        setSessionKey(null);
        await hydrateAll();
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
  }, [hydrateAll]);

  // Register dispatcher.
  const handler = useCallback(
    async (event: AppEvent) => {
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
        case "pin/set": {
          // Derive a brand-new key + meta. Re-encrypt every existing
          // record under the new key before persisting the meta so a
          // mid-write crash leaves the store recoverable (old key still
          // valid against any rows not yet rewritten).
          const { meta, key } = await derivePinMeta(event.pin);
          const oldKey = hasSessionKey() ? undefined : null;
          // If `hasSessionKey()` was already true we'd be rotating, but
          // the UI only exposes pin/set when PIN is currently off, so
          // oldKey is always null here.
          void oldKey;
          await reencryptAll(null, key);
          setSessionKey(key);
          await kvSet("pinMeta", meta);
          setState((s) => ({
            ...s,
            pinEnabled: true,
            locked: false,
            pinAttemptsLeft: MAX_PIN_ATTEMPTS,
            lockoutUntilIso: null,
          }));
          return;
        }
        case "pin/clear": {
          // Reverse: decrypt every row back to plaintext, then drop meta.
          await reencryptAll(null /* current key from db's session */, null);
          // Order matters: re-encrypt first (uses sessionKey), then drop
          // it so the next write goes plain.
          setSessionKey(null);
          await kvSet("pinMeta", NO_PIN);
          setState((s) => ({
            ...s,
            pinEnabled: false,
            locked: false,
            pinAttemptsLeft: MAX_PIN_ATTEMPTS,
            lockoutUntilIso: null,
          }));
          return;
        }
        case "pin/unlock": {
          const meta = (await kvGet<PinMeta>("pinMeta")) ?? NO_PIN;
          if (!meta.enabled) {
            // Shouldn't happen, but be defensive.
            setState((s) => ({ ...s, locked: false }));
            return;
          }
          const key = await verifyPin(event.pin, meta);
          if (key === null) {
            setState((s) => {
              const attempts = Math.max(0, s.pinAttemptsLeft - 1);
              const lockoutUntilIso =
                attempts === 0
                  ? new Date(Date.now() + LOCKOUT_MS).toISOString()
                  : s.lockoutUntilIso;
              return {
                ...s,
                pinAttemptsLeft: attempts,
                lockoutUntilIso,
              };
            });
            return;
          }
          setSessionKey(key);
          await hydrateAll();
          return;
        }
        case "backup/export": {
          // Capture the live snapshot synchronously off state. Backups
          // are PLAINTEXT — the user is moving them off-device on purpose.
          setState((s) => {
            const snapshot: BackupV2Data = {
              entries: s.entries,
              profile: s.profile,
              reminders: s.reminders,
              goalMl: s.goalMl,
              hasCompletedOnboarding: s.hasCompletedOnboarding,
            };
            downloadBackup(buildBackup(snapshot, HYDRA_VERSION));
            return s;
          });
          return;
        }
        case "backup/import": {
          const d = event.data;
          // Replace entries store wholesale.
          await entriesClear();
          for (const e of d.entries) {
            await entryAdd(e);
          }
          await Promise.all([
            kvSet("goal", d.goalMl),
            kvSet("profile", d.profile),
            kvSet("reminders", d.reminders),
            kvSet("onboarded", d.hasCompletedOnboarding),
          ]);
          setState((s) => ({
            ...s,
            entries: [...d.entries].sort((a, b) =>
              b.atIso.localeCompare(a.atIso),
            ),
            goalMl: d.goalMl,
            profile: d.profile,
            reminders: d.reminders,
            hasCompletedOnboarding: d.hasCompletedOnboarding,
          }));
          return;
        }
        case "data/reset": {
          await resetAllData();
          setSessionKey(null);
          // Reload so the store re-hydrates from a clean slate and the
          // onboarding flow re-appears.
          if (typeof window !== "undefined") {
            window.location.reload();
          }
          return;
        }
      }
    },
    [hydrateAll],
  );

  useEffect(() => registerDispatcher(handler), [handler]);

  return { state, dispatch };
}

export { DEFAULT_GOAL_ML };
