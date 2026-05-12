"use client";

import { DropletIcon } from "./icons";

export function AppHeader({ subtitle }: { subtitle?: string }) {
  return (
    <header className="flex items-center justify-between px-5 pt-5 pb-2">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--tint)] text-[var(--primary-2)]">
          <DropletIcon size={20} />
        </span>
        <div className="flex items-baseline gap-1.5 leading-none">
          {subtitle && (
            <span className="text-[14px] font-medium text-[var(--ink-soft)]">
              {subtitle}
            </span>
          )}
          <h1 className="text-display text-[22px] tracking-tight">
            <span className="text-[var(--primary-2)]">Hydra</span>
            <span className="text-hydra">Blue</span>
          </h1>
        </div>
      </div>
      <Avatar />
    </header>
  );
}

function Avatar() {
  return (
    <div
      aria-label="User avatar"
      className="h-10 w-10 overflow-hidden rounded-full border-2 border-white shadow-[0_2px_8px_rgba(15,28,46,0.12)]"
    >
      <svg viewBox="0 0 40 40" width={40} height={40}>
        <defs>
          <linearGradient id="avgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#cbd5e1" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" fill="url(#avgrad)" />
        <circle cx="20" cy="16" r="6" fill="#e2e8f0" />
        <path d="M6 38 C 10 28, 30 28, 34 38 Z" fill="#e2e8f0" />
      </svg>
    </div>
  );
}
