"use client";

import { motion } from "framer-motion";
import { BarsIcon, BellIcon, DropletIcon, UserIcon } from "./icons";

export type TabKey = "dashboard" | "history" | "reminders" | "profile";

type Item = {
  key: TabKey;
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.JSX.Element;
};

const ITEMS: Item[] = [
  { key: "dashboard", label: "Dashboard", Icon: DropletIcon },
  { key: "history", label: "History", Icon: BarsIcon },
  { key: "reminders", label: "Reminders", Icon: BellIcon },
  { key: "profile", label: "Profile", Icon: UserIcon },
];

export function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <nav
      aria-label="Primary"
      className="tabbar absolute inset-x-0 bottom-0 z-30 grid grid-cols-4 px-1 pt-2 pb-3"
    >
      {ITEMS.map(({ key, label, Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={isActive ? "page" : undefined}
            className="relative flex flex-col items-center justify-center gap-1 py-1.5"
          >
            <Icon
              size={22}
              className={
                isActive
                  ? "text-[var(--primary-2)]"
                  : "text-[var(--ink-soft)]"
              }
            />
            <span
              className={
                isActive
                  ? "text-[11px] font-bold text-[var(--primary-2)]"
                  : "text-[11px] font-medium text-[var(--ink-soft)]"
              }
            >
              {label}
            </span>
            {isActive && (
              <motion.span
                layoutId="tab-dot"
                className="absolute bottom-0 h-1 w-1 rounded-full bg-[var(--primary-2)]"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
