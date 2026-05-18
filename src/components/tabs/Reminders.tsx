"use client";

import { motion } from "framer-motion";
import { useState, useSyncExternalStore } from "react";
import type { ReminderConfig } from "@/lib/appEvents";
import { isIosLike } from "@/lib/sw";
import {
  BellIcon,
  CheckIcon,
  ClockIcon,
  DropletIcon,
  MoonIcon,
  PlayIcon,
  SunIcon,
  WavesIcon,
  BarsIcon,
} from "../icons";

const NOOP_SUBSCRIBE = () => () => {};
const SSR_NOT_IOS = () => false;

const FREQ_PRESETS = [30, 45, 60, 90, 120, 180];

const SOUNDS = [
  {
    id: "pure_drop",
    name: "Pure Drop",
    subtitle: "Minimalist water splash",
    Icon: DropletIcon,
    tint: "blue" as const,
  },
  {
    id: "soft_chime",
    name: "Soft Chime",
    subtitle: "Zen bell melody",
    Icon: BarsIcon,
    tint: "gray" as const,
  },
  {
    id: "ocean_mist",
    name: "Ocean Mist",
    subtitle: "Calming shore waves",
    Icon: WavesIcon,
    tint: "gray" as const,
  },
];

export function Reminders({
  config,
  onChange,
  onSave,
  onTestReminder,
}: {
  config: ReminderConfig;
  onChange: (next: ReminderConfig) => void;
  onSave: () => void;
  onTestReminder: () => void;
}) {
  // UA banner is shown only on iOS / iPadOS-like Safari since Notification
  // Triggers aren't available there. `useSyncExternalStore` is the React
  // 19 idiomatic way to read a non-React value without tripping the
  // "setState in effect" lint rule — third arg is the SSR snapshot.
  const showIosBanner = useSyncExternalStore(
    NOOP_SUBSCRIBE,
    isIosLike,
    SSR_NOT_IOS,
  );
  const freqIndex = Math.max(
    0,
    FREQ_PRESETS.findIndex((f) => f >= config.frequencyMin),
  );
  const [savedFlash, setSavedFlash] = useState(false);

  return (
    <div className="flex flex-col gap-5 px-5 pb-28">
      <header className="pt-2">
        <h1 className="text-display text-[28px] leading-tight text-[var(--ink)]">
          Smart Reminders
        </h1>
        <p className="mt-1 text-[14px] text-[var(--ink-muted)]">
          Tailor your hydration journey with personalized alerts.
        </p>
      </header>

      {/* Enable toggle */}
      <section className="card flex items-center gap-4 p-5">
        <span className="chip-icon">
          <BellIcon size={20} />
        </span>
        <div className="flex-1">
          <p className="text-display text-[17px]">Enable Reminders</p>
          <p className="text-[13px] text-[var(--ink-muted)]">
            Stay consistent throughout the day
          </p>
        </div>
        <Toggle
          on={config.enabled}
          onChange={(v) => onChange({ ...config, enabled: v })}
        />
      </section>

      {/* Wake / Sleep times */}
      <section className="grid grid-cols-2 gap-3">
        <TimeCard
          label="Wake Up Time"
          value={config.wakeTime}
          Icon={SunIcon}
          onChange={(t) => onChange({ ...config, wakeTime: t })}
        />
        <TimeCard
          label="Sleep Time"
          value={config.sleepTime}
          Icon={MoonIcon}
          onChange={(t) => onChange({ ...config, sleepTime: t })}
        />
      </section>

      {/* Frequency */}
      <section className="card flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-display text-[20px] text-[var(--ink)]">
            Reminder Frequency
          </h3>
          <span className="chip-pill whitespace-nowrap">
            Every {formatFreq(config.frequencyMin)}
          </span>
        </div>
        <input
          type="range"
          className="hydra-range mt-1"
          min={0}
          max={FREQ_PRESETS.length - 1}
          step={1}
          value={freqIndex < 0 ? 0 : freqIndex}
          onChange={(e) =>
            onChange({
              ...config,
              frequencyMin: FREQ_PRESETS[Number(e.target.value)],
            })
          }
          aria-label="Reminder frequency"
        />
        <div className="-mt-1 flex justify-between text-[12px] text-[var(--ink-muted)]">
          <span>30 mins</span>
          <span>1.5 hrs</span>
          <span>3 hours</span>
        </div>
      </section>

      {/* Sounds */}
      <section className="flex flex-col gap-3">
        <h3 className="text-display text-[20px] text-[var(--ink)]">
          Reminder Sounds
        </h3>
        <div className="flex flex-col gap-3">
          {SOUNDS.map((s) => {
            const selected = config.sound === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ ...config, sound: s.id })}
                className={
                  "card pressable flex items-center gap-3 p-4 text-left transition " +
                  (selected
                    ? "ring-2 ring-[var(--primary-2)] ring-offset-0"
                    : "")
                }
              >
                <span
                  className={
                    "chip-icon " +
                    (s.tint === "gray" ? "tint-gray" : "")
                  }
                >
                  <s.Icon size={20} />
                </span>
                <div className="flex-1">
                  <p className="text-display text-[15px]">{s.name}</p>
                  <p className="text-[12.5px] text-[var(--ink-muted)]">
                    {s.subtitle}
                  </p>
                </div>
                {selected ? (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--primary-2)] text-white">
                    <CheckIcon size={16} />
                  </span>
                ) : (
                  <span className="grid h-7 w-7 place-items-center text-[var(--ink-soft)]">
                    <PlayIcon size={14} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* iOS reality banner — honest disclosure of the platform limit */}
      {showIosBanner && (
        <section
          role="note"
          className="rounded-2xl border border-[#F0C36E] bg-[#FFF8E6] p-4 text-[13.5px] text-[#7A4A0A]"
        >
          <p className="font-semibold">Heads-up for iPhone users</p>
          <p className="mt-1">
            iOS Safari can’t fire scheduled reminders when the app is closed.
            Open HydraBlue once a day and reminders inside the app will work
            reliably. For guaranteed background alerts, install the upcoming
            native build.
          </p>
        </section>
      )}

      {/* Save + Test Reminder buttons */}
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => {
            onSave();
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1400);
          }}
          className="gradient-cta pressable inline-flex h-13 items-center justify-center rounded-2xl py-3.5 text-[16px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(15,28,46,0.45)]"
        >
          {savedFlash ? "Saved!" : "Save Settings"}
        </button>
        <button
          type="button"
          onClick={onTestReminder}
          className="pressable inline-flex h-12 items-center justify-center rounded-2xl border border-[var(--line)] bg-white py-3 text-[15px] font-semibold text-[var(--primary-2)]"
        >
          Send Test Reminder
        </button>
      </div>
    </div>
  );
}

function TimeCard({
  label,
  value,
  Icon,
  onChange,
}: {
  label: string;
  value: string;
  Icon: (p: { size?: number; className?: string }) => React.JSX.Element;
  onChange: (v: string) => void;
}) {
  return (
    <label className="card flex flex-col gap-2 p-4">
      <span className="eyebrow text-[var(--primary-2)]">{label}</span>
      <span className="relative inline-flex items-center gap-2">
        <Icon size={18} className="text-[var(--ink-2)]" />
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="text-display w-full bg-transparent text-[20px] text-[var(--ink)] outline-none"
        />
        <ClockIcon
          size={18}
          className="absolute right-0 text-[var(--ink-soft)]"
        />
      </span>
    </label>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label="Enable reminders"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={
        "relative h-7 w-12 rounded-full transition-colors " +
        (on ? "bg-[var(--primary-2)]" : "bg-[var(--line)]")
      }
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 700, damping: 35 }}
        className="absolute top-0.5 grid h-6 w-6 place-items-center rounded-full bg-white shadow-[0_2px_6px_rgba(15,28,46,0.2)]"
        style={{ left: on ? "calc(100% - 26px)" : "2px" }}
      />
    </button>
  );
}

function formatFreq(min: number): string {
  if (min < 60) return `${min} mins`;
  if (min === 60) return `1 hr`;
  if (min === 90) return `1.5 hrs`;
  if (min === 120) return `2 hrs`;
  if (min === 180) return `3 hrs`;
  return `${(min / 60).toFixed(1)} hrs`;
}

// ReminderConfig is now declared in @/lib/appEvents and re-exported here for compat.
export type { ReminderConfig };

