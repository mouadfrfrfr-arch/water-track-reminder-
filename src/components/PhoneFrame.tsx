import { ReactNode } from "react";

/**
 * Clean iPhone-shaped frame on desktop. Mobile expands to fullscreen.
 * The inner area handles its own scroll (no scrollbar shown) and reserves
 * room at the bottom for the tab bar (the app sets pb-28 itself).
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center bg-[var(--app-bg-2)] py-0 sm:py-10">
      <div
        className="relative w-full max-w-[420px] sm:rounded-[44px] sm:bg-[#0b1220] sm:p-[10px] sm:shadow-[0_30px_70px_-20px_rgba(15,28,46,0.55)]"
      >
        <div
          className="relative h-dvh w-full overflow-hidden bg-[var(--app-bg)] sm:h-[860px] sm:rounded-[36px]"
        >
          {/* iOS-style notch */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 hidden h-6 w-32 -translate-x-1/2 rounded-full bg-[#0b1220] sm:block" />
          {children}
        </div>
      </div>
    </div>
  );
}
