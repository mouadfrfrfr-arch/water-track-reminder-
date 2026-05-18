"use client";

/**
 * Two-screen onboarding: name → daily goal.
 * Persists via dispatch({ type: "onboarding/complete", ... }) so the
 * Profile tab can edit either value later.
 */

import { motion } from "framer-motion";
import { useState } from "react";
import { dispatch } from "@/lib/appEvents";
import { DropletIcon } from "./icons";

const GOAL_PRESETS_ML = [1800, 2200, 2500, 3000];

export function Onboarding({ initialGoalMl }: { initialGoalMl: number }) {
  const [step, setStep] = useState<0 | 1>(0);
  const [name, setName] = useState("");
  const [goalMl, setGoalMl] = useState(initialGoalMl);

  const trimmedName = name.trim();

  return (
    <div className="flex h-full flex-col items-center justify-between gap-8 px-6 pb-10 pt-14">
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--teal)] text-white shadow-[0_12px_24px_-10px_rgba(37,99,235,0.5)]">
          <DropletIcon size={28} />
        </span>
        <h1 className="text-display text-[26px] text-[var(--primary-2)]">
          HydraBlue
        </h1>
        <p className="text-center text-[13.5px] text-[var(--ink-muted)]">
          A two-step setup. Your data stays on this device.
        </p>
      </div>

      {step === 0 ? (
        <motion.section
          key="step-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <label className="card flex flex-col gap-2 p-5">
            <span className="eyebrow text-[var(--primary-2)]">Your name</span>
            <input
              autoFocus
              aria-label="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sarah"
              className="text-display w-full bg-transparent text-[22px] text-[var(--ink)] outline-none placeholder:text-[var(--ink-soft)]"
            />
          </label>
          <button
            type="button"
            disabled={!trimmedName}
            aria-pressed={!!trimmedName}
            onClick={() => setStep(1)}
            className="gradient-cta pressable inline-flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,28,46,0.45)] disabled:opacity-50"
          >
            Continue
          </button>
        </motion.section>
      ) : (
        <motion.section
          key="step-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <div className="card flex flex-col gap-4 p-5">
            <span className="eyebrow text-[var(--primary-2)]">
              Daily water goal
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-display text-[36px] text-[var(--primary-2)]">
                {goalMl.toLocaleString()}
              </span>
              <span className="text-[14px] font-semibold text-[var(--ink-muted)]">
                mL
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {GOAL_PRESETS_ML.map((ml) => {
                const active = goalMl === ml;
                return (
                  <button
                    key={ml}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGoalMl(ml)}
                    className={
                      "rounded-xl py-2 text-[13px] font-semibold transition " +
                      (active
                        ? "bg-[var(--primary-2)] text-white"
                        : "bg-[var(--app-bg-2)] text-[var(--ink-soft)]")
                    }
                  >
                    {(ml / 1000).toFixed(1)}L
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(0)}
              aria-label="Go back to name step"
              className="card pressable inline-flex h-12 flex-1 items-center justify-center rounded-2xl text-[14px] font-semibold text-[var(--ink-soft)]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                void dispatch({
                  type: "onboarding/complete",
                  name: trimmedName,
                  goalMl,
                })
              }
              className="gradient-cta pressable inline-flex h-12 flex-[2] items-center justify-center rounded-2xl text-[15px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(15,28,46,0.45)]"
            >
              Start tracking
            </button>
          </div>
        </motion.section>
      )}

      <p className="text-center text-[12px] text-[var(--ink-soft)]">
        You can change this anytime in Profile.
      </p>
    </div>
  );
}
