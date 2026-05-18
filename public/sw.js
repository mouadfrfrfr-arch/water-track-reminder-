/* global self, Notification, TimestampTrigger, clients */
/**
 * HydraBlue service worker.
 *
 * Responsibilities (intentionally small):
 *  1. Listen for { type: "SCHEDULE", slots, sound } messages from the page.
 *     Schedule a notification for each slot via `showNotification` with a
 *     TimestampTrigger when available (Chromium). On Safari we no-op — the
 *     in-app foreground tick handles reminders while the page is open.
 *  2. On `notificationclick`, focus / open the app and post a
 *     REMINDER_FIRED message so HydraBlueApp can render the takeover with
 *     the matching slot.
 *  3. `activate` / `install` use skipWaiting + clientsClaim so a new SW
 *     applies on next reload without an extra round-trip.
 */

const NOTIF_TAG_PREFIX = "hb-reminder-";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function clearPendingHbNotifications() {
  // Drop any previously-scheduled HydraBlue notifications so we don't
  // double-fire after a reschedule. `includeTriggered: true` is what
  // returns the scheduled-but-not-yet-fired set in Chromium — the default
  // `false` only returns notifications already visible in the tray, which
  // would silently skip the ones we actually want to cancel.
  try {
    const pending = await self.registration.getNotifications({
      includeTriggered: true,
    });
    for (const n of pending) {
      if (n.tag && n.tag.startsWith(NOTIF_TAG_PREFIX)) n.close();
    }
  } catch {
    // Older browsers — silently skip.
  }
}

async function schedule(slots) {
  if (!("showTrigger" in (Notification?.prototype || {})) && typeof TimestampTrigger === "undefined") {
    // No triggers API — Safari path. Leave it to the foreground tick.
    return;
  }
  await clearPendingHbNotifications();
  for (const slot of slots) {
    const at = Date.parse(slot.atIso);
    if (!Number.isFinite(at) || at <= Date.now()) continue;
    try {
      await self.registration.showNotification("Time to hydrate", {
        tag: NOTIF_TAG_PREFIX + slot.id,
        body: slot.label,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { slot },
        showTrigger: new TimestampTrigger(at),
        // Keep the notification visible until the user acts.
        requireInteraction: true,
      });
    } catch {
      return;
    }
  }
}

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "SCHEDULE" && Array.isArray(data.slots)) {
    event.waitUntil(schedule(data.slots));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const slot = event.notification.data?.slot;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Prefer an existing tab.
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          c.postMessage({ type: "REMINDER_FIRED", slot });
          return;
        }
      }
      // No tab open — open the root and let the page pick up the slot from
      // the persisted queue on hydrate.
      if (self.clients.openWindow) {
        await self.clients.openWindow("/");
      }
    })(),
  );
});
