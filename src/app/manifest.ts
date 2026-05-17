import type { MetadataRoute } from "next";

/**
 * PWA manifest for HydraBlue.
 *
 * Next 16 serves this from `app/manifest.ts` automatically — no need to
 * place anything in /public. See AGENTS.md note about the new metadata
 * route conventions.
 *
 * `dynamic = "force-static"` is required when the surrounding app is
 * configured with `output: "export"` (see next.config.ts).
 */
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HydraBlue — Smart Water Tracker",
    short_name: "HydraBlue",
    description:
      "Track your water with smart, full-screen reminders. Works offline, no account needed.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F8FF",
    theme_color: "#2563EB",
    orientation: "portrait",
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
