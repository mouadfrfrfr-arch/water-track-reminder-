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
import { useMemo, useRef, useState } from "react";
import type { Entry } from "@/lib/db";
import { dispatch } from "@/lib/appEvents";
import type { Profile as PersistedProfile } from "@/lib/appEvents";
import { isValidPin } from "@/lib/pin";
import { readBackupFile } from "@/lib/backup";
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
  profile,
  pinEnabled,
  onRename,
  onGoalChange,
  onProfileChange,
  onPinSet,
  onPinClear,
  onBackupExport,
  onBackupImport,
  onDataReset,
}: {
  name: string;
  goalMl: number;
  entries: Entry[];
  streakDays: number;
  profile: PersistedProfile;
  pinEnabled: boolean;
  onRename: (next: string) => void;
  onGoalChange: (ml: number) => void;
  onProfileChange: (
    patch: Partial<{ weightKg: number; activity: Activity; climate: Climate }>,
  ) => void;
  onPinSet: (pin: string) => void;
  onPinClear: () => void;
  onBackupExport: () => void;
  onBackupImport: (data: import("@/lib/backup").BackupV2Data) => void;
  onDataReset: () => void;
}) {
  // Seed the form from the persisted profile (set on first mount, then
  // managed locally). Without this, hard-reloading after Calculate & Save
  // showed inputs back at literal defaults (70 / Sedentary / Mild) even
  // though the goal itself persisted correctly.
  const [weight, setWeight] = useState(profile.weightKg);
  const [activity, setActivity] = useState<Activity>(profile.activity);
  const [climate, setClimate] = useState<Climate>(profile.climate);
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

      <SettingsSection
        pinEnabled={pinEnabled}
        onPinSet={onPinSet}
        onPinClear={onPinClear}
        onBackupExport={onBackupExport}
        onBackupImport={onBackupImport}
        onDataReset={onDataReset}
      />
    </div>
  );
}

function SettingsSection({
  pinEnabled,
  onPinSet,
  onPinClear,
  onBackupExport,
  onBackupImport,
  onDataReset,
}: {
  pinEnabled: boolean;
  onPinSet: (pin: string) => void;
  onPinClear: () => void;
  onBackupExport: () => void;
  onBackupImport: (data: import("@/lib/backup").BackupV2Data) => void;
  onDataReset: () => void;
}) {
  type Stage =
    | "idle"
    | "setting-pin"
    | "confirm-clear-pin"
    | "confirm-reset"
    | "importing";
  const [stage, setStage] = useState<Stage>("idle");
  const [pinDraft, setPinDraft] = useState("");
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const submitPin = () => {
    if (!isValidPin(pinDraft)) return;
    onPinSet(pinDraft);
    setPinDraft("");
    setStage("idle");
  };

  const openFile = () => {
    setImportMsg(null);
    fileRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setStage("importing");
    const result = await readBackupFile(file);
    if (!result.ok) {
      setImportMsg(result.error);
      setStage("idle");
      return;
    }
    onBackupImport(result.backup.data);
    setImportMsg(
      `Imported \u2022 ${result.backup.data.entries.length} entries restored from backup v${result.backup.version}.`,
    );
    setStage("idle");
  };

  return (
    <section
      aria-labelledby="settings-heading"
      className="card flex flex-col gap-4 p-5"
    >
      <header className="flex items-center justify-between">
        <h3
          id="settings-heading"
          className="text-display text-[22px] text-[var(--ink)]"
        >
          Settings
        </h3>
        <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-[var(--primary-2)]">
          Security &amp; Backup
        </span>
      </header>

      {/* PIN row */}
      <SettingsRow
        label="App PIN"
        sub={
          pinEnabled
            ? "On — data on this device is encrypted with your PIN."
            : "Off — turn on to encrypt this device's data with a 4-digit PIN."
        }
      >
        {pinEnabled ? (
          <button
            type="button"
            aria-expanded={stage === "confirm-clear-pin"}
            onClick={() => {
              setStage("confirm-clear-pin");
              void dispatch({ type: "ui/ack", intent: "open-clear-pin" });
            }}
            className="rounded-full bg-[var(--line)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)]"
          >
            Disable
          </button>
        ) : (
          <button
            type="button"
            aria-expanded={stage === "setting-pin"}
            onClick={() => {
              setStage("setting-pin");
              void dispatch({ type: "ui/ack", intent: "open-set-pin" });
            }}
            className="rounded-full bg-[var(--primary-2)] px-4 py-2 text-[13px] font-semibold text-white"
          >
            Set 4-digit PIN
          </button>
        )}
      </SettingsRow>

      {stage === "setting-pin" && (
        <div className="flex flex-col gap-2 rounded-2xl bg-[var(--app-bg-2)] p-3">
          <label
            htmlFor="pin-draft"
            className="text-[12px] font-semibold text-[var(--ink-muted)]"
          >
            Choose a 4-digit PIN
          </label>
          <input
            id="pin-draft"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={pinDraft}
            onChange={(e) =>
              setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="\u2022\u2022\u2022\u2022"
            className="text-display rounded-xl bg-white px-4 py-3 text-center text-[24px] tracking-[0.5em] text-[var(--ink)] outline-none"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setPinDraft("");
                setStage("idle");
                void dispatch({ type: "ui/ack", intent: "cancel-set-pin" });
              }}
              className="rounded-full bg-[var(--line)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isValidPin(pinDraft)}
              onClick={submitPin}
              className="rounded-full bg-[var(--primary-2)] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
            >
              Enable PIN
            </button>
          </div>
        </div>
      )}

      {stage === "confirm-clear-pin" && (
        <ConfirmBlock
          tone="warn"
          message="Disable PIN? Data on this device will be decrypted back to plain storage."
          confirmLabel="Disable PIN"
          onCancel={() => setStage("idle")}
          onConfirm={() => {
            onPinClear();
            setStage("idle");
          }}
        />
      )}

      {/* Backup row */}
      <SettingsRow
        label="Backup"
        sub="Export everything as a JSON file you can keep safe, or restore from a previous backup."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onBackupExport}
            className="rounded-full bg-[var(--primary-2)] px-4 py-2 text-[13px] font-semibold text-white"
          >
            Export to file
          </button>
          <button
            type="button"
            onClick={() => {
              openFile();
              void dispatch({ type: "ui/ack", intent: "open-file-picker" });
            }}
            className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[var(--primary-2)] shadow-[0_2px_8px_rgba(15,28,46,0.06)]"
          >
            Import from file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            hidden
            onChange={onFileChange}
            aria-hidden="true"
          />
        </div>
      </SettingsRow>

      {importMsg && (
        <p
          role="status"
          className="rounded-xl bg-[var(--app-bg-2)] px-3 py-2 text-[12px] text-[var(--ink-muted)]"
        >
          {importMsg}
        </p>
      )}

      {/* Reset row */}
      <SettingsRow
        label="Reset all data"
        sub="Wipe every entry, profile, and reminder from this device."
      >
        <button
          type="button"
          aria-expanded={stage === "confirm-reset"}
          onClick={() => {
            setStage("confirm-reset");
            void dispatch({ type: "ui/ack", intent: "open-reset" });
          }}
          className="rounded-full bg-[#dc2626] px-4 py-2 text-[13px] font-semibold text-white"
        >
          Reset
        </button>
      </SettingsRow>

      {stage === "confirm-reset" && (
        <ConfirmBlock
          tone="danger"
          message="Wipe every entry, profile, reminder, and PIN on this device? There is no recovery."
          confirmLabel="Yes, wipe everything"
          onCancel={() => setStage("idle")}
          onConfirm={() => {
            onDataReset();
            // App reloads from data/reset; no need to clear stage.
          }}
        />
      )}
    </section>
  );
}

function SettingsRow({
  label,
  sub,
  children,
}: {
  label: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold text-[var(--ink)]">
          {label}
        </span>
        <span className="text-[12px] leading-snug text-[var(--ink-muted)]">
          {sub}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

function ConfirmBlock({
  tone,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  tone: "warn" | "danger";
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmBg = tone === "danger" ? "bg-[#dc2626]" : "bg-[var(--primary-2)]";
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[var(--app-bg-2)] p-3">
      <p className="text-[13px] text-[var(--ink)]">{message}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            onCancel();
            void dispatch({ type: "ui/ack", intent: "cancel-confirm" });
          }}
          className="rounded-full bg-[var(--line)] px-4 py-2 text-[13px] font-semibold text-[var(--ink)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`rounded-full ${confirmBg} px-4 py-2 text-[13px] font-semibold text-white`}
        >
          {confirmLabel}
        </button>
      </div>
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
