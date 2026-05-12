"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  CoffeeIcon,
  CupSmallIcon,
  DropletIcon,
  GlassIcon,
  PlusCircleIcon,
  TrendUpIcon,
  WavesIcon,
} from "../icons";

type IntakeEntry = {
  id: string;
  ml: number;
  label: string;
  at: number;
};

export function History({
  entries,
  goalMl,
  streakDays,
  onLogWater,
}: {
  entries: IntakeEntry[];
  goalMl: number;
  streakDays: number;
  onLogWater: () => void;
}) {
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");

  // Today's total (real, from entries) + a synthetic week of history.
  const todayTotal = entries.reduce((s, e) => s + e.ml, 0);

  // Synthetic but stable week values (in L) — Today uses the real total.
  const weekData = useMemo(() => {
    const labels = ["Mon", "Tue", "Wed", "Today", "Fri", "Sat", "Sun"];
    const base = [2.1, 2.6, 2.4, todayTotal / 1000, 0, 0, 0];
    return base.map((v, i) => ({
      label: labels[i],
      litres: i === 3 ? todayTotal / 1000 : v,
      active: i === 3,
      future: i > 3,
    }));
  }, [todayTotal]);

  const weeklyAvgL = useMemo(() => {
    const filled = weekData.filter((d) => !d.future);
    const sum = filled.reduce((s, d) => s + d.litres, 0);
    return filled.length ? sum / filled.length : 0;
  }, [weekData]);

  const goalPct = Math.min(100, Math.round((todayTotal / goalMl) * 100));

  return (
    <div className="flex flex-col gap-5 px-5 pb-28">
      <header className="pt-2">
        <h1 className="text-display text-[28px] leading-tight text-[var(--primary-2)]">
          Hydration Trends
        </h1>
        <p className="mt-1 text-[14px] text-[var(--ink-muted)]">
          Your body&apos;s vital metrics over time.
        </p>
      </header>

      {/* Range toggle */}
      <div className="inline-flex w-fit rounded-full bg-[var(--app-bg-2)] p-1">
        {(["weekly", "monthly"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={
              "rounded-full px-5 py-1.5 text-[13px] font-semibold transition " +
              (range === r
                ? "bg-white text-[var(--primary-2)] shadow-[0_2px_8px_rgba(15,28,46,0.08)]"
                : "text-[var(--ink-soft)]")
            }
          >
            {r === "weekly" ? "Weekly" : "Monthly"}
          </button>
        ))}
      </div>

      {/* Chart card */}
      <section className="card flex flex-col gap-4 p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Weekly Average</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-display text-[36px] text-[var(--primary-2)]">
                {weeklyAvgL.toFixed(1)}
              </span>
              <span className="text-[18px] font-semibold text-[var(--primary-2)]">
                L
              </span>
              <span className="text-[14px] text-[var(--ink-muted)]">/ day</span>
            </div>
          </div>
          <div className="mb-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--teal)]">
            <TrendUpIcon size={14} />
            +12% vs last week
          </div>
        </div>

        {/* Bar chart */}
        <div className="mt-2 flex h-32 items-end justify-between gap-2">
          {weekData.map((d, i) => {
            const heightPct = d.future ? 0 : Math.min(100, (d.litres / 3.5) * 100);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative flex h-24 w-full items-end justify-center">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{
                      duration: 0.7,
                      delay: i * 0.05,
                      ease: "easeOut",
                    }}
                    className="w-full rounded-t-md"
                    style={{
                      background: d.active
                        ? "linear-gradient(180deg,#22d3ee 0%,#1d4ed8 100%)"
                        : d.future
                          ? "transparent"
                          : "#cbd5e1",
                      minHeight: d.future ? 0 : 4,
                    }}
                  />
                </div>
                <span
                  className={
                    "text-[12px] font-semibold " +
                    (d.active
                      ? "text-[var(--primary-2)]"
                      : d.future
                        ? "text-[var(--ink-soft)]"
                        : "text-[var(--ink-muted)]")
                  }
                >
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Recent Logs */}
      <section className="card flex flex-col p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-display text-[18px] text-[var(--ink)]">
            Recent Logs
          </h2>
          <button
            type="button"
            className="text-[13px] font-semibold text-[var(--primary-2)]"
          >
            View All
          </button>
        </div>

        <ul className="mt-3 flex flex-col divide-y divide-[var(--line)]">
          {RECENT_LOGS.map((l) => (
            <li key={l.id} className="flex items-center gap-3 py-3">
              <span className="chip-icon">
                <l.Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">{l.subtitle}</p>
                <p className="text-[12.5px] text-[var(--ink-muted)]">{l.when}</p>
              </div>
              <span className="text-[15px] font-bold text-[var(--primary-2)]">
                {l.amount}
              </span>
            </li>
          ))}
        </ul>

        {/* Log water CTA */}
        <button
          type="button"
          onClick={onLogWater}
          className="gradient-cta pressable mt-4 inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,28,46,0.4)]"
        >
          <PlusCircleIcon size={22} />
          Log Water
        </button>
      </section>

      {/* Metric cards */}
      <div className="flex flex-col gap-3">
        <div className="card-accent accent-teal flex items-center gap-3 p-4">
          <span className="chip-icon tint-teal">
            <CheckCircleIcon size={20} />
          </span>
          <div>
            <span className="eyebrow">Goal Progress</span>
            <p className="text-display text-[17px]">{goalPct}% Streak</p>
          </div>
        </div>
        <div className="card-accent accent-blue flex items-center gap-3 p-4">
          <span className="chip-icon">
            <ClockIcon size={20} />
          </span>
          <div>
            <span className="eyebrow">Best Time</span>
            <p className="text-display text-[17px]">Morning (10AM)</p>
          </div>
        </div>
        <div className="card-accent accent-deep flex items-center gap-3 p-4">
          <span className="chip-icon tint-gray">
            <WavesIcon size={20} />
          </span>
          <div>
            <span className="eyebrow">Efficiency</span>
            <p className="text-display text-[17px]">
              +15% Focus
              <span className="ml-2 text-[12px] font-medium text-[var(--ink-muted)]">
                ({streakDays}d streak)
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const RECENT_LOGS = [
  {
    id: "l1",
    Icon: GlassIcon,
    subtitle: "Mineral Water",
    when: "Today, 2:30 PM",
    amount: "250ml",
  },
  {
    id: "l2",
    Icon: DropletIcon,
    subtitle: "Tap Water",
    when: "Today, 11:00 AM",
    amount: "500ml",
  },
  {
    id: "l3",
    Icon: CoffeeIcon,
    subtitle: "Herbal Tea",
    when: "Yesterday, 9:15 PM",
    amount: "300ml",
  },
  {
    id: "l4",
    Icon: CupSmallIcon,
    subtitle: "Sparkling Water",
    when: "Yesterday, 5:40 PM",
    amount: "330ml",
  },
];
