import { Capacitor } from "@capacitor/core";

// Single source of truth for "are we running inside a Capacitor native shell?"
// Used to gate Service Worker (web) vs LocalNotifications (native) registration.
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function isAndroid(): boolean {
  return Capacitor.getPlatform() === "android";
}
