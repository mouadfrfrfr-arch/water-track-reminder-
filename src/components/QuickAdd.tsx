"use client";

import { motion } from "framer-motion";
import { CupSmallIcon, BottleIcon, LargeBottleIcon } from "./icons";

export type QuickAddOption = {
  label: string;
  ml: number;
};

const ICONS = {
  cup: CupSmallIcon,
  bottle: BottleIcon,
  large: LargeBottleIcon,
} as const;

const PRESETS: Array<{
  key: keyof typeof ICONS;
  label: string;
  ml: number;
}> = [
  { key: "cup", label: "Glass", ml: 250 },
  { key: "bottle", label: "Bottle", ml: 500 },
  { key: "large", label: "Large", ml: 750 },
];

export function QuickAdd({
  onAdd,
}: {
  onAdd: (option: QuickAddOption) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 px-5">
      {PRESETS.map((p) => {
        const Icon = ICONS[p.key];
        return (
          <motion.button
            key={p.key}
            type="button"
            onClick={() => onAdd({ label: p.label, ml: p.ml })}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 400, damping: 18 }}
            className="clay flex flex-col items-center gap-1 px-3 py-4 text-[var(--primary-deep)] hover:translate-y-[-1px]"
          >
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#7dd3fc] to-[#0284c7] text-white shadow-[0_8px_18px_-6px_rgba(2,132,199,0.6)]">
              <Icon size={24} />
            </span>
            <span className="text-display text-base leading-tight">
              {p.ml}ml
            </span>
            <span className="text-[11px] text-[var(--ink-muted)]">
              {p.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
