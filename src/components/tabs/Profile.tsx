"use client";

/**
 * Profile tab — rewired in PR-A.
 *  - No more hardcoded "Sarah Johnson / LVL 12 / 12.4L Logged".
 *  - Name is editable (empty if user hasn't onboarded).
 *  - Streak + total logged are computed from real entries.
 *  - Daily Goal calculator persists weight/activity/climate via onProfileChange
 *    and sets the goal via onGoalChange.
 */

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { Entry } from "@/lib/db";
import {
  BottleIcon,
  CoffeeIcon,
  DropletIcon,
  FlameIcon,
  GlassIcon,
  SnowflakeIcon,
  SparklesIcon,
  SportBottleIcon,
  SunIcon,
} from "../icons";

type Activity = "Sedentary" | "Moderate" | "Active";
type Climate = "Cold" | "Mild" | "Hot";

export function Profile({
  name,
  goalMl,
  entries,
  streakDays,
  onRename,
  onGoalChange,
  onProfileChange,
}: {
  name: string;
  goalMl: number;
  entries: Entry[];
  streakDays: number;
  onRename: (next: string) => void;
  onGoalChange: (ml: number) => void;
  onProfileChange: (
    patch: Partial<{ weightKg: number; activity: Activity; climate: Climate }>,
  ) => void;
}) {
  const [weight, setWeight] = useState(70);
  const [activity, setActivity] = useState<Activity>("Sedentary");
  const [climate, setClimate] = useState<Climate>("Mild");
  const [recommended, setRecommended] = useState<number>(goalMl);
  const [nameDraft, setNameDraft] = useState(name);

  const totalLoggedMl = useMemo(
    () => entries.reduce((s, e) => s + e.ml, 0),
    [entries],
  );

  const calculate = () => {
    const activityMul =
      activity === "Active" ? 1.25 : activity === "Moderate" ? 1.12 : 1;
    const climateMul =
      climate === "Hot" ? 1.15 : climate === "Cold" ? 0.95 : 1;
    const ml = Math.round(((weight * 35) * activityMul * climateMul) / 50) * 50;
    setRecommended(ml);
    onGoalChange(ml);
    onProfileChange({ weightKg: weight, activity, climate });
  };

  const commitName = () => {
    const trimmed = nameDraft.trim();
    if (trimmed && trimmed !== name) onRename(trimmed);
  };

  const formatTotal = (ml: number) =>
    ml >= 1000 ? `${(ml / 1000).toFixed(1)}L` : `${ml}ml`;

  return (
    <div className="flex flex-col gap-5 px-5 pb-28">
      {/* Identity card — editable name + derived stats */}
      <section className="card flex flex-col items-center gap-3 p-6 text-center">
        <input
          aria-label="Your name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Add your name"
          className="text-display w-full bg-transparent text-center text-[22px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
        />
        <div className="mt-1 flex items-center gap-4 text-[13px]">
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--primary-2)]">
            <DropletIcon size={14} /> {streakDays} day streak
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--teal)]">
            <SparklesIcon size={14} /> {formatTotal(totalLoggedMl)} logged
          </span>
        </div>
      </section>

      {/* Calculator card */}
      <section className="flex items-center justify-between">
        <h3 className="text-display text-[22px] text-[var(--ink)]">
          Daily Goal Calculator
        </h3>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--primary-2)]">
          Dynamic Profile
        </span>
      </section>

      <section className="card flex flex-col gap-5 p-5">
        {/* Weight */}
        <div className="flex flex-col gap-2">
          <label className="eyebrow" htmlFor="weight">
            Current Weight
          </label>
          <div className="flex items-end justify-between border-b border-[var(--line)] pb-2">
            <input
              id="weight"
              type="number"
              min={20}
              max={250}
              value={weight}
              onChange={(e) =>
                setWeight(Math.max(20, Math.min(250, Number(e.target.value))))
              }
              className="text-display w-24 bg-transparent text-[26px] text-[var(--ink)] outline-none"
            />
            <span className="text-[14px] font-semibold text-[var(--ink-muted)]">
              kg
            </span>
          </div>
        </div>

        {/* Activity */}
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Activity Level</span>
          <div className="inline-flex w-full rounded-full bg-[var(--app-bg-2)] p-1">
            {(["Sedentary", "Moderate", "Active"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={activity === a}
                onClick={() => setActivity(a)}
                className={
                  "flex-1 rounded-full py-2 text-[13px] font-semibold transition " +
                  (activity === a
                    ? "bg-white text-[var(--primary-2)] shadow-[0_2px_8px_rgba(15,28,46,0.08)]"
                    : "text-[var(--ink-soft)]")
                }
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        {/* Climate */}
        <div className="flex flex-col gap-2">
          <span className="eyebrow">Environment Climate</span>
          <div className="flex items-center justify-between gap-3">
            <ClimateOption
              active={climate === "Cold"}
              accent="cold"
              label="Cold"
              Icon={SnowflakeIcon}
              onClick={() => setClimate("Cold")}
            />
            <Connector active={climate === "Cold" || climate === "Mild"} />
            <ClimateOption
              active={climate === "Mild"}
              accent="mild"
              label="Mild"
              Icon={SunIcon}
              onClick={() => setClimate("Mild")}
            />
            <Connector active={climate === "Hot"} />
            <ClimateOption
              active={climate === "Hot"}
              accent="hot"
              label="Hot"
              Icon={FlameIcon}
              onClick={() => setClimate("Hot")}
            />
          </div>
        </div>

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={calculate}
          className="gradient-cta inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,28,46,0.45)]"
        >
          Calculate &amp; Save
          <span className="opacity-90">✨</span>
        </motion.button>
      </section>

      {/* Recommended intake */}
      <section className="rounded-[22px] border-2 border-[var(--primary-2)] bg-white p-5 shadow-[0_8px_24px_-14px_rgba(37,99,235,0.35)]">
        <p className="eyebrow text-center">Recommended Daily Intake</p>
        <div className="mt-1 flex items-baseline justify-center gap-1">
          <span className="text-display text-[40px] text-[var(--primary-2)]">
            {recommended.toLocaleString()}
          </span>
          <span className="text-[14px] font-semibold text-[var(--primary-2)]">
            mL
          </span>
        </div>
        <p className="mt-2 text-center text-[13px] leading-snug text-[var(--ink-muted)]">
          Based on your activity level and local climate, we&apos;ve adjusted
          your goal for optimal hydration.
        </p>
        <div className="mt-5 flex justify-center">
          <CupsRing cups={Math.round(recommended / 240)} />
        </div>
      </section>

      {/* Drink presets (visual; PR-B turns these into Quick-Add overrides) */}
      <section className="grid grid-cols-2 gap-3">
        <DrinkCard Icon={GlassIcon} label="Glass" amount="250ml" />
        <DrinkCard Icon={BottleIcon} label="Bottle" amount="500ml" />
        <DrinkCard Icon={SportBottleIcon} label="Sport" amount="750ml" />
        <DrinkCard Icon={CoffeeIcon} label="Coffee" amount="330ml" />
      </section>
    </div>
  );
}

function ClimateOption({
  active,
  accent,
  label,
  Icon,
  onClick,
}: {
  active: boolean;
  accent: "cold" | "mild" | "hot";
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.JSX.Element;
  onClick: () => void;
}) {
  const palette =
    accent === "cold"
      ? { bg: "#e0f2fe", color: "#0ea5e9" }
      : accent === "mild"
        ? { bg: "#eaf1fb", color: "#2563eb" }
        : { bg: "#fde6dd", color: "#ea5f2c" };
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
    >
      <span
        className={
          "grid h-12 w-12 place-items-center rounded-2xl transition " +
          (active ? "ring-2 ring-offset-2 ring-[var(--primary-2)]" : "")
        }
        style={{ background: palette.bg, color: palette.color }}
      >
        <Icon size={22} />
      </span>
      <span
        className={
          "text-[12px] font-semibold " +
          (active ? "text-[var(--primary-2)]" : "text-[var(--ink-soft)]")
        }
      >
        {label}
      </span>
    </button>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <span
      className="h-px flex-1"
      style={{
        background: active
          ? "linear-gradient(90deg,#2563eb,#0ea480)"
          : "var(--line)",
      }}
    />
  );
}

function CupsRing({ cups }: { cups: number }) {
  const items = Array.from({ length: Math.max(0, Math.min(12, cups)) });
  return (
    <div className="flex flex-wrap items-end justify-center gap-1.5">
      {items.map((_, i) => (
        <span
          key={i}
          className="grid h-7 w-5 place-items-end rounded-b-[6px] rounded-t-[2px] bg-[var(--app-bg-2)]"
          aria-hidden="true"
        >
          <span className="h-4 w-full rounded-b-[6px] bg-gradient-to-b from-[#22d3ee] to-[#2563eb]" />
        </span>
      ))}
    </div>
  );
}

function DrinkCard({
  Icon,
  label,
  amount,
}: {
  Icon: (p: { size?: number; className?: string }) => React.JSX.Element;
  label: string;
  amount: string;
}) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="chip-icon">
        <Icon size={22} />
      </span>
      <div>
        <p className="text-[14px] font-semibold text-[var(--ink)]">{label}</p>
        <p className="text-[12px] text-[var(--ink-muted)]">{amount}</p>
      </div>
    </div>
  );
}
