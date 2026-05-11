"use client";

import { motion } from "framer-motion";
import { BellIcon, ClockIcon } from "./icons";

export function ReminderStrip({
  nextAt,
  enabled,
  onToggle,
}: {
  nextAt: Date;
  enabled: boolean;
  onToggle: () => void;
}) {
  const time = nextAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="clay-soft mx-5 flex items-center gap-3 px-4 py-3"
    >
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-[#bae6fd] to-[#38bdf8] text-white shadow-[0_6px_12px_-4px_rgba(2,132,199,0.5)]">
        <BellIcon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
          Next reminder
        </div>
        <div className="flex items-center gap-1 text-[15px] font-semibold text-[var(--primary-deep)]">
          <ClockIcon size={14} className="opacity-70" />
          <span>{enabled ? time : "Reminders off"}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label="Toggle reminders"
        className={`relative h-7 w-12 rounded-full transition-colors ${
          enabled ? "bg-[var(--primary)]" : "bg-slate-300"
        }`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md ${
            enabled ? "right-0.5" : "left-0.5"
          }`}
        />
      </button>
    </motion.div>
  );
}
