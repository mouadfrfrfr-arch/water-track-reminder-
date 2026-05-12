"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BulbIcon,
  ClockIcon,
  CupSmallIcon,
  DropletIcon,
  DropletOutlineIcon,
  GlassIcon,
  SparklesIcon,
} from "../icons";
import { WaterCircle } from "../WaterCircle";

export type QuickAddPreset = {
  ml: number;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.JSX.Element;
};

const PRESETS: QuickAddPreset[] = [
  { ml: 250, label: "250ml", Icon: GlassIcon },
  { ml: 500, label: "500ml", Icon: CupSmallIcon },
  { ml: 750, label: "750ml", Icon: DropletOutlineIcon },
];

export function Dashboard({
  intakeMl,
  goalMl,
  sloshKey,
  splash,
  lastDrinkAt,
  streakDays,
  onAdd,
}: {
  intakeMl: number;
  goalMl: number;
  sloshKey: number;
  splash: { id: number; ml: number } | null;
  lastDrinkAt: number | null;
  streakDays: number;
  onAdd: (preset: QuickAddPreset) => void;
}) {
  const litres = (intakeMl / 1000).toFixed(1);
  const goalL = (goalMl / 1000).toFixed(1);
  const pct = Math.round((intakeMl / goalMl) * 100);

  return (
    <div className="flex flex-col gap-6 px-5 pb-28">
      {/* HERO — water circle */}
      <section className="flex flex-col items-center pt-2">
        <div className="relative">
          <WaterCircle
            intakeMl={intakeMl}
            goalMl={goalMl}
            sloshKey={sloshKey}
            size={280}
          />

          {/* Small green drop badge top-right of circle */}
          <span className="absolute right-1 top-3 grid h-9 w-9 place-items-center rounded-xl bg-white text-[var(--teal)] shadow-[0_4px_12px_rgba(15,28,46,0.08)]">
            <DropletIcon size={18} />
          </span>

          {/* Center text overlay */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-display text-[40px] leading-none text-[var(--primary-2)]">
              {litres}L
            </div>
            <div className="mt-1 text-[13px] text-[var(--ink-muted)]">
              OF {goalL}L
            </div>
          </div>

          {/* Floating +Nml splash chip */}
          <AnimatePresence>
            {splash && (
              <motion.div
                key={splash.id}
                initial={{ opacity: 0, y: 20, scale: 0.7 }}
                animate={{ opacity: 1, y: -28, scale: 1 }}
                exit={{ opacity: 0, y: -70, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 rounded-full bg-white px-3 py-1.5 text-[13px] font-bold text-[var(--primary-2)] shadow-[0_8px_22px_-8px_rgba(37,99,235,0.55)]"
              >
                +{splash.ml}ml
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <h2 className="text-display mt-4 text-center text-[22px] text-[var(--primary-2)]">
          {progressHeadline(intakeMl, goalMl)}
        </h2>
        <p className="mt-1 text-center text-[14px] text-[var(--ink-muted)]">
          {pct >= 100
            ? "Goal smashed — keep sipping!"
            : "Keep drinking to hit your daily goal."}
        </p>
      </section>

      {/* QUICK ADD */}
      <section>
        <h3 className="text-display mb-3 text-[20px] text-[var(--ink)]">
          Quick Add
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {PRESETS.map((p) => (
            <motion.button
              key={p.ml}
              type="button"
              onClick={() => onAdd(p)}
              whileTap={{ scale: 0.94 }}
              className="card pressable flex flex-col items-center gap-2 py-5"
            >
              <p.Icon size={28} className="text-[var(--primary-2)]" />
              <span className="text-[13px] font-semibold text-[var(--primary-2)]">
                {p.label}
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* STATS */}
      <div className="flex flex-col gap-3">
        <div className="card-accent accent-teal flex items-center gap-3 p-4">
          <span className="chip-icon tint-teal">
            <ClockIcon size={20} />
          </span>
          <div className="flex flex-col">
            <span className="eyebrow">Last Drink</span>
            <span className="text-display text-[18px]">
              {lastDrinkAt ? timeAgo(lastDrinkAt) : "—"}
            </span>
          </div>
        </div>

        <div className="card-accent accent-blue flex items-center gap-3 p-4">
          <span className="chip-icon">
            <SparklesIcon size={20} />
          </span>
          <div className="flex flex-col">
            <span className="eyebrow">Daily Streak</span>
            <span className="text-display text-[18px]">{streakDays} days</span>
          </div>
        </div>
      </div>

      {/* HYDRATION INSIGHT */}
      <InsightCard />
    </div>
  );
}

function InsightCard() {
  return (
    <section
      className="relative overflow-hidden rounded-[20px] p-5 text-white"
      style={{
        background:
          "linear-gradient(135deg, #6ec1e4 0%, #88c5e8 45%, #b4dbf0 100%)",
        boxShadow: "0 12px 28px -16px rgba(15,28,46,0.25)",
      }}
    >
      {/* Decorative bubble pattern */}
      <svg
        viewBox="0 0 200 110"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="bub" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g fill="url(#bub)">
          <circle cx="18" cy="22" r="14" />
          <circle cx="60" cy="14" r="10" />
          <circle cx="115" cy="20" r="20" />
          <circle cx="165" cy="34" r="14" />
          <circle cx="40" cy="60" r="18" />
          <circle cx="92" cy="72" r="22" />
          <circle cx="155" cy="78" r="16" />
          <circle cx="180" cy="56" r="10" />
        </g>
      </svg>
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-display text-[18px]">Hydration Insight</h3>
          <p className="mt-1 max-w-[220px] text-[13.5px] leading-snug opacity-95">
            Drinking water boosts your focus by 14%.
          </p>
        </div>
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/30 text-white">
          <BulbIcon size={20} />
        </span>
      </div>
    </section>
  );
}

function progressHeadline(intakeMl: number, goalMl: number): string {
  const pct = (intakeMl / goalMl) * 100;
  if (pct === 0) return "Let's get started";
  if (pct < 25) return "Off to a great start!";
  if (pct < 60) return "Almost halfway there!";
  if (pct < 90) return "Final stretch — you got this";
  if (pct < 100) return "So close — finish strong!";
  return "Daily goal complete!";
}

function timeAgo(ts: number): string {
  const diffMin = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
