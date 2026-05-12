"use client";

import { motion } from "framer-motion";
import { useState } from "react";
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
  goalMl,
  setGoalMl,
}: {
  goalMl: number;
  setGoalMl: (g: number) => void;
}) {
  const [weight, setWeight] = useState(70);
  const [activity, setActivity] = useState<Activity>("Sedentary");
  const [climate, setClimate] = useState<Climate>("Mild");
  const [recommended, setRecommended] = useState<number>(goalMl);

  const calculate = () => {
    // Simple heuristic: 35ml × kg, modified by activity & climate
    const activityMul =
      activity === "Active" ? 1.25 : activity === "Moderate" ? 1.12 : 1;
    const climateMul =
      climate === "Hot" ? 1.15 : climate === "Cold" ? 0.95 : 1;
    const ml = Math.round(((weight * 35) * activityMul * climateMul) / 50) * 50;
    setRecommended(ml);
    setGoalMl(ml);
  };

  return (
    <div className="flex flex-col gap-5 px-5 pb-28">
      {/* User card */}
      <section className="card flex flex-col items-center gap-3 p-6 text-center">
        <div className="relative">
          <UserAvatar />
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[var(--teal-2)] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-[0_2px_6px_rgba(15,28,46,0.18)]">
            LVL 12
          </span>
        </div>
        <h2 className="text-display mt-2 text-[22px] text-[var(--ink)]">
          Sarah Johnson
        </h2>
        <p className="text-[13.5px] text-[var(--ink-muted)]">
          Hydration Enthusiast • San Francisco, CA
        </p>
        <div className="mt-1 flex items-center gap-4 text-[13px]">
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--primary-2)]">
            <DropletIcon size={14} /> 15 Day Streak
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--teal)]">
            <SparklesIcon size={14} /> 12.4L Logged
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

      {/* Drink presets */}
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
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-full transition"
        style={{
          background: active ? palette.bg : "transparent",
          color: active ? palette.color : "var(--ink-soft)",
          boxShadow: active
            ? `0 0 0 2px ${palette.color} inset, 0 4px 12px -6px ${palette.color}55`
            : "none",
        }}
      >
        <Icon size={20} />
      </span>
      <span
        className="text-[12.5px] font-semibold"
        style={{ color: active ? palette.color : "var(--ink-soft)" }}
      >
        {label}
      </span>
    </button>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <span
      className="h-0.5 flex-1 rounded-full"
      style={{ background: active ? "var(--primary-2)" : "var(--line)" }}
    />
  );
}

function CupsRing({ cups }: { cups: number }) {
  const size = 130;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // 75% filled — purely cosmetic
  const dash = c * 0.78;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e2e8f0" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#cup-grad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
        <defs>
          <linearGradient id="cup-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center text-[var(--primary-2)]">
        <DropletIcon size={28} />
        <span className="text-[13px] font-bold mt-0.5">{cups} Cups</span>
      </div>
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
        <p className="text-display text-[15px]">{label}</p>
        <p className="text-[12.5px] text-[var(--ink-muted)]">{amount}</p>
      </div>
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-white shadow-[0_4px_16px_rgba(15,28,46,0.18)]">
      <svg viewBox="0 0 80 80" width={80} height={80}>
        <defs>
          <linearGradient id="profileGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
        <rect width="80" height="80" fill="url(#profileGrad)" />
        <circle cx="40" cy="32" r="12" fill="#e2e8f0" />
        <path d="M10 80 C 18 56, 62 56, 70 80 Z" fill="#e2e8f0" />
      </svg>
    </div>
  );
}
