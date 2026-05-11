"use client";

import { motion } from "framer-motion";
import { DropletIcon, FlameIcon } from "./icons";

export function Stats({
  intakeMl,
  goalMl,
  streak,
}: {
  intakeMl: number;
  goalMl: number;
  streak: number;
}) {
  const pct = Math.round((intakeMl / Math.max(1, goalMl)) * 100);
  return (
    <div className="grid grid-cols-2 gap-3 px-5">
      <Tile
        accent="from-[#bae6fd] to-[#38bdf8]"
        icon={<DropletIcon size={18} />}
        label="Today"
        value={`${intakeMl}ml`}
        sub={`${pct}% of ${goalMl}ml`}
      />
      <Tile
        accent="from-[#fcd9b6] to-[#f59e0b]"
        icon={<FlameIcon size={18} />}
        label="Streak"
        value={`${streak} day${streak === 1 ? "" : "s"}`}
        sub="Keep it up!"
      />
    </div>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="clay-soft flex items-center gap-3 px-4 py-3"
    >
      <span
        className={`grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br ${accent} text-white shadow-[0_6px_12px_-4px_rgba(2,132,199,0.5)]`}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-[var(--ink-muted)]">
          {label}
        </div>
        <div className="text-display text-lg leading-tight text-[var(--primary-deep)]">
          {value}
        </div>
        <div className="truncate text-[11px] text-[var(--ink-muted)]">
          {sub}
        </div>
      </div>
    </motion.div>
  );
}
