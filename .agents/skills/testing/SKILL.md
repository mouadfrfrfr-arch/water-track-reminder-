---
name: testing-aqua-water-tracker
description: How to develop and test the Aqua water tracker app end-to-end. Use whenever working on UI changes, the WaterCup animation, the plus button, the quick-add presets, the reminder toggle, or the intake log.
---

# Testing & local development — Aqua water tracker

Fully client-side Next.js 16 + React 19 + Tailwind v4 + framer-motion app. Static export, no backend.

## Commands (verified)

- `npm install` — install dependencies (also in blueprint `maintenance`).
- `npm run dev` — local dev server at `http://localhost:3000`.
- `npm run build` — static export to `./out` (config: `next.config.ts` sets `output: "export"`).
- `npm run lint` — ESLint via `eslint-config-next`.

## Deploy

The app is fully client-side and configured for static export. The `./out` directory can be served by any static host. The maintainer's working preview is at https://out-nrbpybtz.devinapps.com (deployed via `deploy` tool, `command=frontend`, `dir=./out`). Redeploy after every change so the preview matches the latest commit.

## Primary end-to-end test flow

The core feature is: tapping the plus button triggers a sloshing water animation while the cup fills. Always verify the slosh visually — a unit test cannot prove animation works.

1. Load the preview URL. Verify ring=0%, goal=0/2500ml, cup empty.
2. Tap the big blue plus button below the cup. Verify water rises to ~10%, `+250ml` chip floats up, surface oscillates side-to-side (not a flat jump), cup squishes.
3. Tap each quick-add preset (250/500/750 ml). Verify total updates correctly and the cup re-sloshes on each.
4. Tap the minus icon on the topmost log entry. Verify it animates out and the water level decrements.
5. Tap the reminder toggle. Verify the label literally changes to the string `Reminders off` and the knob slides left.

## Key files

- `src/components/WaterCup.tsx` — SVG glass with sinusoidal wave surfaces and slosh animation. Wave path math in `buildWavePath`. Slosh is triggered by `sloshKey` prop changes via `animate(slosh, [0,18,-14,9,-5,0], ...)`.
- `src/components/AquaApp.tsx` — state + composition. `addWater` bumps `sloshKey` and adds a log entry.
- `src/components/PhoneFrame.tsx` — iOS-style bezel on desktop, full-screen on mobile.
- `src/app/globals.css` — claymorphism utility classes (`clay`, `clay-soft`, `clay-pressable`).

## Notes

- Hero progress ring clamps to 100% but `src/components/Stats.tsx` does not — over-goal intake renders as `110% of 2500ml` in the stats card. Intentional, but worth knowing when reviewing screenshots.
- The phone-frame layout shifts when log entries are added/removed. When clicking the reminder toggle or any element near the log, re-screenshot first to find the current y-coordinate — otherwise clicks may land on the wrong element.
