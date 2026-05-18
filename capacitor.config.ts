import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor wraps the static `out/` export (next.config.ts: `output: "export"`).
// `appId` is the Android package — change before publishing to a different namespace.
const config: CapacitorConfig = {
  appId: "com.hydrablue.app",
  appName: "HydraBlue",
  webDir: "out",
  android: {
    // Disallow http:// content inside the WebView for parity with production HTTPS.
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#2563EB",
    },
  },
};

export default config;
