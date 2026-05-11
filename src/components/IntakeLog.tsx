"use client";

import { AnimatePresence, motion } from "framer-motion";
import { DropletIcon, MinusIcon } from "./icons";

export type IntakeEntry = {
  id: string;
  ml: number;
  label: string;
  at: number;
};

export function IntakeLog({
  entries,
  onUndo,
}: {
  entries: IntakeEntry[];
  onUndo: (id: string) => void;
}) {
  return (
    <div className="px-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-display text-lg text-[var(--primary-deep)]">
          Today&apos;s log
        </h2>
        <span className="text-[12px] text-[var(--ink-muted)]">
          {entries.length} entr{entries.length === 1 ? "y" : "ies"}
        </span>
      </div>
      <div className="clay-soft p-3">
        {entries.length === 0 ? (
          <div className="px-2 py-6 text-center text-[13px] text-[var(--ink-muted)]">
            No water logged yet. Tap the plus button to start.
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {entries.map((e) => (
                <motion.li
                  key={e.id}
                  layout
                  initial={{ opacity: 0, x: 20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -20, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#7dd3fc] to-[#0284c7] text-white">
                    <DropletIcon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-semibold text-[var(--primary-deep)]">
                      {e.ml}ml · {e.label}
                    </div>
                    <div className="text-[11px] text-[var(--ink-muted)]">
                      {formatTime(e.at)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUndo(e.id)}
                    aria-label={`Remove ${e.ml}ml entry`}
                    className="clay-pressable grid h-8 w-8 place-items-center rounded-full bg-white text-[var(--ink-muted)] shadow-[0_4px_8px_-2px_rgba(11,37,64,0.18)]"
                  >
                    <MinusIcon size={16} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
