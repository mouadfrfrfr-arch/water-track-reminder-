"use client";

/**
 * Full-screen modal lock screen — shown when `state.locked === true`.
 *
 * Layout: branding header, 4-digit indicator row, 3x4 numpad, error
 * message + remaining attempts, "Forgot PIN — reset all data" link.
 *
 * Wiring:
 *  - Parent (HydraBlueApp) renders <PinLock /> over the rest of the
 *    UI; this component itself doesn't manage `aria-hidden` on the
 *    siblings — that's the parent's job because it owns the layout.
 *  - On 4 digits entered, calls `onSubmit(pin)`. The parent dispatches
 *    `pin/unlock`. If the store reports remaining attempts decreased,
 *    we react via the `attemptsLeft` prop and shake the indicators.
 *  - When `attemptsLeft === 0`, the numpad is disabled; the indicator
 *    row shows a 30s lockout countdown derived from `lockoutUntilIso`.
 */

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DropletIcon } from "./icons";

const MAX_DIGITS = 4;

export function PinLock({
  attemptsLeft,
  maxAttempts,
  lockoutUntilIso,
  onSubmit,
  onReset,
}: {
  attemptsLeft: number;
  maxAttempts: number;
  lockoutUntilIso: string | null;
  onSubmit: (pin: string) => void;
  onReset: () => void;
}) {
  const [digits, setDigits] = useState<string>("");
  const [shake, setShake] = useState(0);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second when locked out so the countdown re-renders.
  useEffect(() => {
    if (!lockoutUntilIso) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockoutUntilIso]);

  const lockoutMsLeft = lockoutUntilIso
    ? Math.max(0, Date.parse(lockoutUntilIso) - now)
    : 0;
  const lockedOut = lockoutMsLeft > 0;

  // Detect a drop in `attemptsLeft` to retrigger the shake animation
  // and clear the entered digits. We use the "adjust state during
  // render" pattern from the React docs to avoid a chained effect:
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [trackedAttempts, setTrackedAttempts] = useState(attemptsLeft);
  if (attemptsLeft !== trackedAttempts) {
    if (attemptsLeft < trackedAttempts) {
      setShake((k) => k + 1);
      setDigits("");
    }
    setTrackedAttempts(attemptsLeft);
  }

  const press = (d: string) => {
    if (lockedOut) return;
    if (digits.length >= MAX_DIGITS) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === MAX_DIGITS) {
      // Submit on the next tick so the indicator briefly shows the 4th dot.
      window.setTimeout(() => onSubmit(next), 60);
    }
  };

  const backspace = () => {
    if (lockedOut) return;
    setDigits((d) => d.slice(0, -1));
  };

  const clear = () => {
    if (lockedOut) return;
    setDigits("");
  };

  const showError =
    attemptsLeft < maxAttempts && digits.length === 0 && !lockedOut;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pinlock-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[var(--app-bg)] px-6"
    >
      <div className="flex flex-col items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--primary-2)] text-white shadow-[0_8px_24px_-12px_rgba(37,99,235,0.55)]">
          <DropletIcon size={28} />
        </span>
        <h1
          id="pinlock-title"
          className="text-display text-[22px] text-[var(--ink)]"
        >
          Enter PIN
        </h1>
        <p className="max-w-xs text-center text-[13px] text-[var(--ink-muted)]">
          Your data is encrypted on this device. Enter your 4-digit PIN to
          unlock HydraBlue.
        </p>
      </div>

      <motion.div
        key={shake}
        animate={{ x: shake ? [0, -10, 10, -8, 8, -4, 4, 0] : 0 }}
        transition={{ duration: 0.45 }}
        className="flex items-center gap-4"
        aria-label="PIN entry"
      >
        {Array.from({ length: MAX_DIGITS }).map((_, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={
              "h-4 w-4 rounded-full transition " +
              (i < digits.length
                ? "bg-[var(--primary-2)]"
                : "bg-[var(--line)]")
            }
          />
        ))}
      </motion.div>

      <div className="min-h-[20px] text-center text-[13px]" aria-live="polite">
        {lockedOut ? (
          <span className="font-semibold text-[var(--ink-soft)]">
            Too many attempts. Try again in {Math.ceil(lockoutMsLeft / 1000)}s.
          </span>
        ) : showError ? (
          <span className="font-semibold text-[#dc2626]">
            Wrong PIN. {attemptsLeft} attempt{attemptsLeft === 1 ? "" : "s"} left.
          </span>
        ) : (
          <span className="text-transparent">.</span>
        )}
      </div>

      <div className="grid w-full max-w-[260px] grid-cols-3 gap-3">
        {(["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const).map((d) => (
          <NumpadKey key={d} label={d} onClick={() => press(d)} disabled={lockedOut} />
        ))}
        <NumpadKey label="Clear" tone="text" onClick={clear} disabled={lockedOut} />
        <NumpadKey label="0" onClick={() => press("0")} disabled={lockedOut} />
        <NumpadKey
          label="⌫"
          tone="text"
          ariaLabel="Backspace"
          onClick={backspace}
          disabled={lockedOut}
        />
      </div>

      {!confirmingReset ? (
        <button
          type="button"
          onClick={() => setConfirmingReset(true)}
          className="text-[13px] font-semibold text-[var(--ink-soft)] underline-offset-4 hover:underline"
        >
          Forgot PIN — reset all data
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="max-w-xs text-[13px] text-[#dc2626]">
            This wipes every entry, profile, and reminder on this device. There is no recovery.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingReset(false)}
              className="rounded-full bg-[var(--line)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full bg-[#dc2626] px-4 py-2 text-[13px] font-semibold text-white"
            >
              Yes, wipe everything
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function NumpadKey({
  label,
  ariaLabel,
  onClick,
  disabled,
  tone = "digit",
}: {
  label: string;
  ariaLabel?: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "digit" | "text";
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      disabled={disabled}
      className={
        "h-14 rounded-2xl bg-white text-center font-semibold shadow-[0_2px_8px_rgba(15,28,46,0.06)] transition active:scale-95 disabled:opacity-40 " +
        (tone === "digit"
          ? "text-display text-[22px] text-[var(--ink)]"
          : "text-[14px] text-[var(--ink-soft)]")
      }
    >
      {label}
    </button>
  );
}
