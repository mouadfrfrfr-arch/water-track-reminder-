"use client";

/**
 * History tab — rewired in PR-A to derive everything from real entries.
 *  - Recent Logs: actual entries (newest first, up to 4)
 *  - Weekly bar chart: real trailingDailyTotals(entries, 7)
 *  - Weekly average: real
 *  - "+12% vs last week": real (compares last 7d to prior 7d)
 */

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Entry } from "@/lib/db";
import { trailingDailyTotals } from "@/lib/streak";
import {
  CheckCircleIcon,
  ClockIcon,
  CupSmallIcon,
  DropletIcon,
  PlusCircleIcon,
  TrendUpIcon,
  WavesIcon,
} from "../icons";

export function History({
  entries,
  goalMl,
  streakDays,
  onLogWater,
}: {
  entries: Entry[];
  goalMl: number;
  streakDays: number;
  onLogWater: () => void;
}) {
  const [range, setRange] = useState<"weekly" | "monthly">("weekly");

  const todayTotal = useMemo(() => {
    const todayKey = new Date().toLocaleDateString("en-CA");
    return entries
      .filter((e) => new Date(e.atIso).toLocaleDateString("en-CA") === todayKey)
      .reduce((s, e) => s + e.ml, 0);
  }, [entries]);

  const last7Days = useMemo(() => trailingDailyTotals(entries, 7), [entries]);
  const prior7Days = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - 7);
    return trailingDailyTotals(entries, 7, now);
  }, [entries]);

  const todayKey = new Date().toLocaleDateString("en-CA");
  const shortDayName = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short" });

  const weekChart = last7Days.map((d) => {
    const isToday = d.key === todayKey;
    return {
      label: isToday ? "Today" : shortDayName(d.date),
      litres: d.ml / 1000,
      active: isToday,
      future: false,
    };
  });

  const filledDays = last7Days.filter((d) => d.ml > 0);
  const weeklyAvgL =
    filledDays.length > 0
      ? filledDays.reduce((s, d) => s + d.ml, 0) / filledDays.length / 1000
      : 0;

  const last7Sum = last7Days.reduce((s, d) => s + d.ml, 0);
  const prior7Sum = prior7Days.reduce((s, d) => s + d.ml, 0);
  const pctDelta =
    prior7Sum > 0
      ? Math.round(((last7Sum - prior7Sum) / prior7Sum) * 100)
      : null;

  const goalPct = goalMl > 0 ? Math.min(100, Math.round((todayTotal / goalMl) * 100)) : 0;

  // Recent Logs — derived from real entries.
  const recentLogs = useMemo(() => entries.slice(0, 4), [entries]);

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
            aria-pressed={range === r}
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
          {pctDelta !== null && (
            <div
              className={
                "mb-1 inline-flex items-center gap-1 text-[12.5px] font-semibold " +
                (pctDelta >= 0 ? "text-[var(--teal)]" : "text-[#dc2626]")
              }
            >
              <TrendUpIcon size={14} />
              {pctDelta >= 0 ? "+" : ""}
              {pctDelta}% vs last week
            </div>
          )}
        </div>

        {/* Bar chart */}
        <div className="mt-2 flex h-32 items-end justify-between gap-2">
          {weekChart.map((d, i) => {
            const heightPct = Math.min(100, (d.litres / 3.5) * 100);
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
                        : "#cbd5e1",
                      minHeight: 4,
                    }}
                  />
                </div>
                <span
                  className={
                    "text-[12px] font-semibold " +
                    (d.active
                      ? "text-[var(--primary-2)]"
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
          <span className="text-[12px] font-medium text-[var(--ink-soft)]">
            {entries.length} total
          </span>
        </div>

        {recentLogs.length === 0 ? (
          <p className="mt-4 text-center text-[14px] text-[var(--ink-muted)]">
            No drinks logged yet — tap Log Water below to get started.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-[var(--line)]">
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3">
                <span className="chip-icon">
                  <CupSmallIcon size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold">{l.label}</p>
                  <p className="text-[12.5px] text-[var(--ink-muted)]">
                    {relativeWhen(l.atIso)}
                  </p>
                </div>
                <span className="text-[15px] font-bold text-[var(--primary-2)]">
                  {l.ml}ml
                </span>
              </li>
            ))}
          </ul>
        )}

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
            <span className="eyebrow">Today&apos;s Progress</span>
            <p className="text-display text-[17px]">{goalPct}% of goal</p>
          </div>
        </div>
        <div className="card-accent accent-blue flex items-center gap-3 p-4">
          <span className="chip-icon">
            <ClockIcon size={20} />
          </span>
          <div>
            <span className="eyebrow">Best Time</span>
            <p className="text-display text-[17px]">{bestTime(entries)}</p>
          </div>
        </div>
        <div className="card-accent accent-deep flex items-center gap-3 p-4">
          <span className="chip-icon tint-gray">
            <WavesIcon size={20} />
          </span>
          <div>
            <span className="eyebrow">Streak</span>
            <p className="text-display text-[17px]">
              {streakDays} {streakDays === 1 ? "day" : "days"}
              <span className="ml-2 inline-flex items-center text-[12px] font-medium text-[var(--ink-muted)]">
                <DropletIcon size={12} />
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function relativeWhen(atIso: string): string {
  const at = new Date(atIso);
  const now = new Date();
  const today = now.toLocaleDateString("en-CA");
  const atKey = at.toLocaleDateString("en-CA");
  const time = at.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  if (atKey === today) return `Today, ${time}`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (atKey === y.toLocaleDateString("en-CA")) return `Yesterday, ${time}`;
  return `${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

function bestTime(entries: Entry[]): string {
  if (entries.length === 0) return "—";
  const buckets: Record<string, number> = {
    Morning: 0,
    Afternoon: 0,
    Evening: 0,
    Night: 0,
  };
  for (const e of entries) {
    const h = new Date(e.atIso).getHours();
    if (h < 12) buckets.Morning += e.ml;
    else if (h < 17) buckets.Afternoon += e.ml;
    else if (h < 21) buckets.Evening += e.ml;
    else buckets.Night += e.ml;
  }
  let best = "Morning";
  let max = 0;
  for (const [k, v] of Object.entries(buckets)) {
    if (v > max) {
      max = v;
      best = k;
    }
  }
  return best;
}
