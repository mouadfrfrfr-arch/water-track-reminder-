"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WaterCup } from "./WaterCup";
import { Stats } from "./Stats";
import { ReminderStrip } from "./ReminderStrip";
import { QuickAdd, type QuickAddOption } from "./QuickAdd";
import { IntakeLog, type IntakeEntry } from "./IntakeLog";
import { PlusIcon, SettingsIcon } from "./icons";

const GOAL_ML = 2500;
const STREAK = 7;
const DEFAULT_ADD_ML = 250;

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function AquaApp() {
  const [entries, setEntries] = useState<IntakeEntry[]>([]);
  const [sloshKey, setSloshKey] = useState(0);
  const [remindersOn, setRemindersOn] = useState(true);
  const [splash, setSplash] = useState<{ id: number; ml: number } | null>(null);
  const splashIdRef = useRef(0);

  const intakeMl = useMemo(
    () => entries.reduce((sum, e) => sum + e.ml, 0),
    [entries],
  );
  const progress = Math.min(1, intakeMl / GOAL_ML);
  const pct = Math.round(progress * 100);

  const addWater = useCallback((option: QuickAddOption) => {
    setEntries((prev) => [
      { id: genId(), ml: option.ml, label: option.label, at: Date.now() },
      ...prev,
    ]);
    setSloshKey((k) => k + 1);
    splashIdRef.current += 1;
    setSplash({ id: splashIdRef.current, ml: option.ml });
  }, []);

  const undo = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSloshKey((k) => k + 1);
  }, []);

  // Auto-hide the floating "+250ml" splash label.
  useEffect(() => {
    if (!splash) return;
    const t = setTimeout(() => setSplash(null), 1100);
    return () => clearTimeout(t);
  }, [splash]);

  // Compute "next reminder" — round up to the next 90-minute slot from now.
  const nextReminder = useMemo(() => {
    const d = new Date();
    const slotMs = 90 * 60 * 1000;
    return new Date(Math.ceil((d.getTime() + 1) / slotMs) * slotMs);
  }, [entries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="flex h-full flex-col gap-5 pt-12 sm:pt-14">
      {/* HEADER */}
      <header className="flex items-center justify-between px-5">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            {greeting()}
          </p>
          <h1 className="text-display text-[26px] leading-tight text-[var(--primary-deep)]">
            Stay hydrated
          </h1>
        </div>
        <button
          type="button"
          aria-label="Settings"
          className="clay-pressable grid h-11 w-11 place-items-center rounded-2xl bg-white text-[var(--primary-deep)] shadow-[0_8px_18px_-8px_rgba(11,37,64,0.35)]"
        >
          <SettingsIcon size={20} />
        </button>
      </header>

      {/* HERO — Cup */}
      <section className="relative mx-5 flex flex-col items-center">
        <div className="clay relative w-full overflow-hidden pt-2 pb-6">
          {/* progress ring + percent */}
          <div className="flex items-center justify-between px-5 pt-3">
            <div>
              <div className="text-[12px] uppercase tracking-wider text-[var(--ink-muted)]">
                Daily goal
              </div>
              <div className="text-display text-2xl text-[var(--primary-deep)]">
                {intakeMl}
                <span className="text-base font-semibold text-[var(--ink-muted)]">
                  {" "}
                  / {GOAL_ML} ml
                </span>
              </div>
            </div>
            <ProgressRing pct={pct} />
          </div>

          {/* The hero cup */}
          <div className="relative mt-1 flex items-end justify-center">
            <WaterCup intakeMl={intakeMl} goalMl={GOAL_ML} sloshKey={sloshKey} />

            {/* Floating "+250ml" splash label */}
            <AnimatePresence>
              {splash && (
                <motion.div
                  key={splash.id}
                  initial={{ opacity: 0, y: 30, scale: 0.6 }}
                  animate={{ opacity: 1, y: -40, scale: 1 }}
                  exit={{ opacity: 0, y: -80, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 220, damping: 18 }}
                  className="pointer-events-none absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-full bg-white/90 px-3 py-1.5 text-[13px] font-bold text-[var(--primary-deep)] shadow-[0_8px_20px_-8px_rgba(2,132,199,0.6)] backdrop-blur"
                >
                  +{splash.ml}ml
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Big floating plus button */}
          <div className="-mt-6 flex justify-center">
            <PlusButton onClick={() => addWater({ label: "Glass", ml: DEFAULT_ADD_ML })} />
          </div>
        </div>
      </section>

      {/* STATS */}
      <Stats intakeMl={intakeMl} goalMl={GOAL_ML} streak={STREAK} />

      {/* QUICK ADD PRESETS */}
      <div>
        <h2 className="text-display mb-2 px-5 text-lg text-[var(--primary-deep)]">
          Quick add
        </h2>
        <QuickAdd onAdd={addWater} />
      </div>

      {/* REMINDER */}
      <ReminderStrip
        nextAt={nextReminder}
        enabled={remindersOn}
        onToggle={() => setRemindersOn((v) => !v)}
      />

      {/* LOG */}
      <IntakeLog entries={entries} onUndo={undo} />

      <div className="h-6" />
    </main>
  );
}

function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 360, damping: 16 }}
      aria-label="Add 250 ml of water"
      className="relative grid h-20 w-20 place-items-center rounded-full text-white"
      style={{
        background:
          "radial-gradient(circle at 30% 25%, #7dd3fc 0%, #0284c7 55%, #0c4a6e 100%)",
        boxShadow:
          "0 22px 36px -10px rgba(2,132,199,0.7), inset 0 -8px 14px rgba(12,74,110,0.5), inset 0 6px 10px rgba(255,255,255,0.5)",
      }}
    >
      {/* Pulsing halo */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 0 0 rgba(56,189,248,0.55)" }}
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(56,189,248,0.55)",
            "0 0 0 18px rgba(56,189,248,0)",
          ],
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut" }}
      />
      <PlusIcon size={36} />
    </motion.button>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 64;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * circ;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#dbeafe"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          initial={false}
          animate={{ strokeDasharray: `${dash} ${circ - dash}` }}
          transition={{ type: "spring", stiffness: 80, damping: 16 }}
        />
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="text-display absolute text-sm text-[var(--primary-deep)]">
        {clamped}%
      </span>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
