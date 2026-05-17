"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { dispatch, type ReminderConfig } from "@/lib/appEvents";
import { computeStreak } from "@/lib/streak";
import { useHydraStore } from "@/lib/useHydraStore";
import { AppHeader } from "./AppHeader";
import { Onboarding } from "./Onboarding";
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

  // Don't render UI before IDB hydration finishes — avoids a flash of seed values.
  if (!state.ready) {
    return <div className="flex h-full flex-col" aria-busy="true" />;
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
                onSave={() =>
                  void dispatch({
                    type: "reminder/save",
                    config: reminderDraft,
                  })
                }
              />
            )}
            {tab === "profile" && (
              <Profile
                name={state.profile.name}
                goalMl={state.goalMl}
                entries={state.entries}
                streakDays={streak}
                profile={state.profile}
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
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
