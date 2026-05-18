"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { dispatch, type ReminderConfig, type ReminderSlot } from "@/lib/appEvents";
import { computeStreak } from "@/lib/streak";
import { passedSlots, registerSw, requestNotificationPermission, scheduleNext30Days } from "@/lib/sw";
import { useHydraStore } from "@/lib/useHydraStore";
import { AppHeader } from "./AppHeader";
import { Onboarding } from "./Onboarding";
import { PinLock } from "./PinLock";
import { ReminderTakeover } from "./ReminderTakeover";
import { TabBar, type TabKey } from "./TabBar";
import { Dashboard, type QuickAddPreset } from "./tabs/Dashboard";
import { History } from "./tabs/History";
import { Profile } from "./tabs/Profile";
import { Reminders } from "./tabs/Reminders";

export function HydraBlueApp() {
  const { state } = useHydraStore();
  const [tab, setTab] = useState<TabKey>("dashboard");

  // UI-only animation state (not persisted)
  const [sloshKey, setSloshKey] = useState(0);
  const [splash, setSplash] = useState<{ id: number; ml: number } | null>(null);
  const splashIdRef = useRef(0);

  // Reminders draft — the Save button persists this to the store
  const [reminderDraft, setReminderDraft] = useState<ReminderConfig>(
    state.reminders,
  );
  const lastSavedRemindersRef = useRef(state.reminders);
  useEffect(() => {
    // When the store finishes hydrating (or another path saves a new config),
    // refresh the draft so the UI shows the persisted values.
    if (state.reminders !== lastSavedRemindersRef.current) {
      setReminderDraft(state.reminders);
      lastSavedRemindersRef.current = state.reminders;
    }
  }, [state.reminders]);

  // Dashboard hero shows today's intake only; `state.entries` is the full
  // persisted log. `computeStreak` already buckets by local day so we reuse
  // its `todayMl` value rather than re-filtering.
  const { streak, todayMl } = computeStreak(state.entries, state.goalMl);
  const intakeMl = todayMl;
  const lastDrinkAt = state.entries.length
    ? Date.parse(state.entries[0].atIso)
    : null;

  const addWater = useCallback(
    (preset: QuickAddPreset) => {
      void dispatch({ type: "intake/add", ml: preset.ml, label: preset.label });
      setSloshKey((k) => k + 1);
      splashIdRef.current += 1;
      setSplash({ id: splashIdRef.current, ml: preset.ml });
    },
    [],
  );

  // Auto-hide splash chip
  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => setSplash(null), 1200);
    return () => clearTimeout(t);
  }, [splash]);

  // History "Log Water" CTA — adds 250ml and switches to dashboard
  const logFromHistory = useCallback(() => {
    addWater({ ml: 250, label: "Glass", Icon: () => <span /> });
    setTab("dashboard");
  }, [addWater]);

  // Register the service worker once the app is mounted. The SW is
  // responsible for OS-level notifications when the page is closed; on iOS
  // it's effectively a no-op for triggers, but we still register it so
  // notificationclick can route back into the app.
  useEffect(() => {
    void registerSw();
  }, []);

  // Re-schedule reminders whenever the saved config changes, AND whenever
  // the page returns to the foreground. The foreground reschedule is what
  // keeps Chromium Android alive without a backend.
  useEffect(() => {
    if (!state.ready) return;
    void scheduleNext30Days(state.reminders);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void scheduleNext30Days(state.reminders);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [state.ready, state.reminders]);

  // Foreground tick: catch slots whose `atIso` passed while the app is
  // open. This is the only path that works on Safari (no Notification
  // Triggers there) and it also fires the in-app takeover on every
  // platform once the user is looking at the app.
  const lastTickRef = useRef<Date>(new Date());
  useEffect(() => {
    if (!state.ready) return;
    const tick = () => {
      const now = new Date();
      const due = passedSlots(state.reminders, lastTickRef.current, now);
      lastTickRef.current = now;
      for (const slot of due) {
        void dispatch({ type: "reminder/fire", slot });
      }
    };
    const id = window.setInterval(tick, 15_000); // 15s is fine — cheap pure fn.
    return () => window.clearInterval(id);
  }, [state.ready, state.reminders]);

  // SW → page bridge: notification click on a closed/background tab posts
  // REMINDER_FIRED to whichever tab gets focused; treat it as a fire.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      const data = e.data as { type?: string; slot?: ReminderSlot } | null;
      if (data?.type === "REMINDER_FIRED" && data.slot) {
        void dispatch({ type: "reminder/fire", slot: data.slot });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  // Don't render UI before IDB hydration finishes — avoids a flash of seed values.
  if (!state.ready) {
    return <div className="flex h-full flex-col" aria-busy="true" />;
  }

  // Lock screen: PIN is enabled but the user hasn't entered it yet. Render
  // the lock above everything (no chrome, no tabs) so there's no way to
  // peek at data underneath.
  if (state.locked) {
    return (
      <PinLock
        attemptsLeft={state.pinAttemptsLeft}
        maxAttempts={3}
        lockoutUntilIso={state.lockoutUntilIso}
        onSubmit={(pin) => void dispatch({ type: "pin/unlock", pin })}
        onReset={() => void dispatch({ type: "data/reset" })}
      />
    );
  }

  // First-launch onboarding (name + goal). Persists then drops through to the app.
  if (!state.hasCompletedOnboarding) {
    return <Onboarding initialGoalMl={state.goalMl} />;
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        subtitle={state.profile.name ? `Hi, ${state.profile.name}` : undefined}
      />

      <main className="no-scrollbar relative flex-1 overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            {tab === "dashboard" && (
              <Dashboard
                intakeMl={intakeMl}
                goalMl={state.goalMl}
                sloshKey={sloshKey}
                splash={splash}
                lastDrinkAt={lastDrinkAt}
                streakDays={streak}
                onAdd={addWater}
              />
            )}
            {tab === "history" && (
              <History
                entries={state.entries}
                goalMl={state.goalMl}
                streakDays={streak}
                onLogWater={logFromHistory}
              />
            )}
            {tab === "reminders" && (
              <Reminders
                config={reminderDraft}
                onChange={setReminderDraft}
                onSave={async () => {
                  await dispatch({
                    type: "reminder/save",
                    config: reminderDraft,
                  });
                  // Ask for permission opportunistically; the user can
                  // always re-grant from the browser settings if denied.
                  await requestNotificationPermission();
                }}
                onTestReminder={() => {
                  const now = new Date();
                  void dispatch({
                    type: "reminder/fire",
                    slot: {
                      id: `test-${now.getTime()}`,
                      atIso: now.toISOString(),
                      label: "Test reminder — tap Add Water to log",
                    },
                  });
                }}
              />
            )}
            {tab === "profile" && (
              <Profile
                name={state.profile.name}
                goalMl={state.goalMl}
                entries={state.entries}
                streakDays={streak}
                profile={state.profile}
                pinEnabled={state.pinEnabled}
                onRename={(next) =>
                  void dispatch({
                    type: "profile/save",
                    profile: { ...state.profile, name: next },
                  })
                }
                onGoalChange={(ml) =>
                  void dispatch({ type: "goal/set", ml })
                }
                onProfileChange={(patch) =>
                  void dispatch({
                    type: "profile/save",
                    profile: { ...state.profile, ...patch },
                  })
                }
                onPinSet={(pin) =>
                  void dispatch({ type: "pin/set", pin })
                }
                onPinClear={() => void dispatch({ type: "pin/clear" })}
                onBackupExport={() =>
                  void dispatch({ type: "backup/export" })
                }
                onBackupImport={(data) =>
                  void dispatch({ type: "backup/import", data })
                }
                onDataReset={() => void dispatch({ type: "data/reset" })}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar active={tab} onChange={setTab} />

      <AnimatePresence>
        {state.reminderQueue.current && (
          <ReminderTakeover
            queue={state.reminderQueue}
            intakeMl={intakeMl}
            goalMl={state.goalMl}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
