"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "./AppHeader";
import { TabBar, type TabKey } from "./TabBar";
import { Dashboard, type QuickAddPreset } from "./tabs/Dashboard";
import { History } from "./tabs/History";
import { Profile } from "./tabs/Profile";
import { Reminders, type ReminderConfig } from "./tabs/Reminders";

type IntakeEntry = {
  id: string;
  ml: number;
  label: string;
  at: number;
};

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const DEFAULT_GOAL_ML = 2500;
const SEED_INTAKE_ML = 1200; // matches the design's "1.2L of 2.5L" hero
const SEED_LAST_DRINK_MS = 45 * 60 * 1000; // 45m ago

export function HydraBlueApp() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [goalMl, setGoalMl] = useState(DEFAULT_GOAL_ML);
  const [entries, setEntries] = useState<IntakeEntry[]>(() => [
    {
      id: "seed",
      ml: SEED_INTAKE_ML,
      label: "Starter",
      at: Date.now() - SEED_LAST_DRINK_MS,
    },
  ]);
  const [sloshKey, setSloshKey] = useState(0);
  const [splash, setSplash] = useState<{ id: number; ml: number } | null>(null);
  const splashIdRef = useRef(0);
  const [reminders, setReminders] = useState<ReminderConfig>({
    enabled: true,
    wakeTime: "07:00",
    sleepTime: "22:30",
    frequencyMin: 45,
    sound: "pure_drop",
  });

  const intakeMl = entries.reduce((s, e) => s + e.ml, 0);
  const lastDrinkAt = entries.length
    ? entries.reduce((max, e) => (e.at > max ? e.at : max), 0)
    : null;

  const addWater = useCallback((preset: QuickAddPreset) => {
    setEntries((prev) => [
      { id: genId(), ml: preset.ml, label: preset.label, at: Date.now() },
      ...prev,
    ]);
    setSloshKey((k) => k + 1);
    splashIdRef.current += 1;
    setSplash({ id: splashIdRef.current, ml: preset.ml });
  }, []);

  // Auto-hide splash chip
  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => setSplash(null), 1200);
    return () => clearTimeout(t);
  }, [splash]);

  // From the History tab "Log Water" CTA — adds 250ml and switches to dashboard
  // so the user can see the slosh.
  const logFromHistory = useCallback(() => {
    addWater({ ml: 250, label: "Glass", Icon: () => <span /> });
    setTab("dashboard");
  }, [addWater]);

  return (
    <div className="flex h-full flex-col">
      <AppHeader />

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
                goalMl={goalMl}
                sloshKey={sloshKey}
                splash={splash}
                lastDrinkAt={lastDrinkAt}
                streakDays={5}
                onAdd={addWater}
              />
            )}
            {tab === "history" && (
              <History
                entries={entries}
                goalMl={goalMl}
                streakDays={5}
                onLogWater={logFromHistory}
              />
            )}
            {tab === "reminders" && (
              <Reminders
                config={reminders}
                onChange={setReminders}
                onSave={() => {}}
              />
            )}
            {tab === "profile" && (
              <Profile goalMl={goalMl} setGoalMl={setGoalMl} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
