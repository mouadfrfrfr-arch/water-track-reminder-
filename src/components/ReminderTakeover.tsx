"use client";

/**
 * Full-screen reminder takeover.
 *
 * Shown when `useHydraStore` has a non-null `reminderQueue.current`. Renders
 * above the tab content, replacing the dashboard for the user's attention.
 *
 * Layout (per the locked plan, §2):
 *   - Big time (HH:MM) — proves the reminder is "the one the user set"
 *   - Label ("Before lunch") — contextual to time of day
 *   - The WaterCircle reused from the Dashboard (no new component)
 *   - "Add Water 250ml" CTA — logs a glass + dismisses
 *   - X dismiss button with "{N} more" badge when queue has pending slots
 *
 * No real notifications fire here; the SW handles OS notifications when
 * the page is closed. The takeover is the on-page render of the same event.
 */

import { motion } from "framer-motion";
import { useMemo } from "react";
import { dispatch, type ReminderQueue, type ReminderSlot } from "@/lib/appEvents";
import { WaterCircle } from "./WaterCircle";
import { CloseIcon, DropletIcon } from "./icons";

const ADD_ML = 250;
const ADD_LABEL = "250ml";

function fmtTime(atIso: string): string {
  try {
    return new Date(atIso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "--:--";
  }
}

export function ReminderTakeover({
  queue,
  intakeMl,
  goalMl,
}: {
  queue: ReminderQueue;
  intakeMl: number;
  goalMl: number;
}) {
  const slot: ReminderSlot | null = queue.current;
  const pendingCount = queue.pending.length;

  const time = useMemo(() => (slot ? fmtTime(slot.atIso) : "--:--"), [slot]);

  if (!slot) return null;

  const handleDismiss = () => {
    void dispatch({ type: "reminder/skip", slotId: slot.id });
  };
  const handleAdd = () => {
    void dispatch({ type: "intake/add", ml: ADD_ML, label: ADD_LABEL });
    void dispatch({ type: "reminder/dismiss", slotId: slot.id });
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Hydration reminder"
      data-testid="reminder-takeover"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-40 flex flex-col bg-[var(--app-bg)]"
    >
      {/* Top bar — X with pending badge */}
      <div className="flex items-center justify-end px-5 pt-4">
        <button
          type="button"
          aria-label={
            pendingCount
              ? `Dismiss reminder, ${pendingCount} more queued`
              : "Dismiss reminder"
          }
          onClick={handleDismiss}
          className="pressable inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-3 text-[var(--ink-muted)] shadow-[0_4px_12px_rgba(15,28,46,0.08)]"
        >
          <CloseIcon size={18} />
          {pendingCount > 0 && (
            <span className="text-[13px] font-semibold text-[var(--ink)]">
              {pendingCount} more
            </span>
          )}
        </button>
      </div>

      {/* Hero: time + label */}
      <div className="flex flex-col items-center px-5 pt-4 text-center">
        <p className="eyebrow text-[var(--primary-2)]">Time to hydrate</p>
        <h1
          className="text-display mt-2 text-[64px] leading-none text-[var(--ink)]"
          data-testid="takeover-time"
        >
          {time}
        </h1>
        <p
          className="mt-2 text-[16px] text-[var(--ink-muted)]"
          data-testid="takeover-label"
        >
          {slot.label}
        </p>
      </div>

      {/* Water circle — reused from Dashboard for design parity */}
      <div className="flex flex-1 items-center justify-center px-5">
        <div className="relative">
          <WaterCircle
            intakeMl={intakeMl}
            goalMl={goalMl}
            sloshKey={0}
            size={260}
          />
          <span className="absolute right-1 top-3 grid h-9 w-9 place-items-center rounded-xl bg-white text-[var(--teal)] shadow-[0_4px_12px_rgba(15,28,46,0.08)]">
            <DropletIcon size={18} />
          </span>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-display text-[36px] leading-none text-[var(--primary-2)]">
              {(intakeMl / 1000).toFixed(1)}L
            </div>
            <div className="mt-1 text-[13px] text-[var(--ink-muted)]">
              OF {(goalMl / 1000).toFixed(1)}L
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="px-5 pb-8">
        <button
          type="button"
          onClick={handleAdd}
          data-testid="takeover-add"
          className="gradient-cta pressable inline-flex h-14 w-full items-center justify-center rounded-2xl text-[17px] font-semibold text-white shadow-[0_12px_28px_-14px_rgba(15,28,46,0.45)]"
        >
          Add Water (250ml)
        </button>
        <p className="mt-3 text-center text-[12.5px] text-[var(--ink-soft)]">
          Tap the X above to skip this reminder.
        </p>
      </div>
    </motion.div>
  );
}
