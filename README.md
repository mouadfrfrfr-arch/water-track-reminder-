# Aqua — Water Track Reminder

A premium mobile-first water tracker reminder built with **Next.js 16** +
**framer-motion**. Tap the big plus button to add water — watch the cup squish,
the surface slosh side-to-side, the waves breathe, and bubbles drift upward.

The design system was generated with the
[ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
("Water & Hydration Reminder" → Claymorphism + refreshing blue palette).

## Features

- **Animated water cup** — two layered sine-wave surfaces, drifting bubbles,
  glass refraction highlight, sloshing burst + cup squish on every add (SVG +
  framer-motion `useMotionValue` / `useTransform`).
- **Claymorphism + water-blue palette** — `#0284C7 / #06B6D4 / #0891B2` with
  soft multi-layer shadows, Nunito display + DM Sans body.
- **Mobile-first phone frame** — iOS-style bezel + notch on desktop, full-screen
  on real mobile.
- **Daily goal ring** + animated percent, today/streak stats, quick-add presets
  (250 / 500 / 750 ml), reminder toggle, animated intake log with undo.

## Stack

- Next.js 16 (App Router, static export)
- React 19
- Tailwind CSS v4
- framer-motion 12

## Develop

```bash
npm install
npm run dev   # http://localhost:3000
npm run build # static export to ./out
npm run lint
```

## Deploy

The app is fully client-side and configured for static export
(`output: "export"` in `next.config.ts`), so the contents of `./out` can be
served from any static host.
