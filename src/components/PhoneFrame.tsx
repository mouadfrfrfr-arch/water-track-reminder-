import { ReactNode } from "react";

/**
 * Phone-shaped bezel that frames the app on desktop. On mobile the bezel
 * gracefully expands to full-width so the app feels native.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gradient-sky py-0 sm:py-10">
      <div
        className="relative w-full max-w-[420px] sm:rounded-[44px] sm:p-[10px] sm:bg-[#0b2540] sm:shadow-[0_30px_70px_-20px_rgba(11,37,64,0.55)]"
      >
        <div
          className="relative h-dvh w-full overflow-hidden bg-[var(--app-bg)] sm:h-[860px] sm:rounded-[36px]"
        >
          {/* iOS-style notch */}
          <div className="pointer-events-none absolute left-1/2 top-2 z-30 hidden h-6 w-32 -translate-x-1/2 rounded-full bg-[#0b2540] sm:block" />
          {/* Soft floating blobs (depth/atmosphere) */}
          <div className="pointer-events-none absolute -left-16 top-20 h-56 w-56 rounded-full bg-[#7dd3fc]/50 blur-3xl blob-drift" />
          <div className="pointer-events-none absolute -right-16 top-1/3 h-64 w-64 rounded-full bg-[#38bdf8]/40 blur-3xl blob-drift-2" />
          <div className="pointer-events-none absolute -bottom-10 left-10 h-56 w-56 rounded-full bg-[#0284c7]/30 blur-3xl blob-drift" />

          <div className="no-scrollbar relative z-10 h-full overflow-y-auto pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
