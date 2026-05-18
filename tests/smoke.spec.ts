/**
 * Playwright smoke test — plan.md §5c (revised).
 *
 * Contract: every visible button on every tab must EITHER
 *   (a) dispatch an AppEvent (captured via window.__hydraTestHook), OR
 *   (b) change one of its own aria-* attributes (current/pressed/expanded).
 *
 * We skip buttons that are already in the selected state of a radio group
 * (aria-pressed="true") or are the active tab (aria-current="page") — clicking
 * those is correctly a no-op (they're already selected). That's not a dead
 * button; it's a confirmed-state click.
 *
 * This contract catches the exact regression we shipped last time
 * (onSave={() => {}}) without false-positive-ing toggles/tabs.
 */

import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __hydraEvents?: unknown[];
    __hydraTestHook?: (e: unknown) => void;
  }
}

async function installHook(page: Page) {
  await page.addInitScript(() => {
    (window as Window).__hydraEvents = [];
    (window as Window).__hydraTestHook = (e: unknown) => {
      (window as Window).__hydraEvents!.push(e);
    };
  });
}

async function completeOnboarding(page: Page) {
  // Wait for the app to hydrate — either Onboarding or <main> must appear.
  await page.waitForFunction(
    () => !!document.querySelector("main") || !!document.querySelector("input[aria-label='Your name']"),
    null,
    { timeout: 10000 },
  );
  const nameInput = page.getByLabel("Your name");
  if (await nameInput.isVisible().catch(() => false)) {
    await nameInput.fill("Tester");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await page
      .getByRole("button", { name: /start tracking/i })
      .click();
    await page.waitForSelector("main", { timeout: 10000 });
  }
}

async function goToTab(page: Page, tab: string) {
  if (tab === "dashboard") return;
  // Bottom nav buttons render the label as text inside a <button>.
  // Match by exact visible text (case-insensitive) to avoid catching content
  // buttons that happen to contain the word.
  const navBtn = page.getByRole("button", { name: new RegExp(`^${tab}$`, "i") });
  await navBtn.first().click({ timeout: 5000 });
  await page.waitForTimeout(250);
}

const TABS = ["dashboard", "history", "reminders", "profile"] as const;

for (const tab of TABS) {
  test(`every visible button on ${tab} tab is wired`, async ({ page }) => {
    await installHook(page);
    await page.goto("/");
    await completeOnboarding(page);
    await goToTab(page, tab);

    // Only test buttons within <main> — the bottom nav tabs are exercised
    // separately in the dedicated `tabs switch on click` test below.
    const buttons = page.locator("main button");
    const count = await buttons.count();
    expect(count, `${tab} tab should have at least one button in <main>`).toBeGreaterThan(0);

    const deadButtons: string[] = [];

    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (!(await btn.isVisible().catch(() => false))) continue;
      if (await btn.isDisabled().catch(() => false)) continue;

      const ariaBefore = await btn.evaluate((el) => ({
        current: el.getAttribute("aria-current"),
        pressed: el.getAttribute("aria-pressed"),
        expanded: el.getAttribute("aria-expanded"),
        checked: el.getAttribute("aria-checked"),
      }));

      // Skip buttons that are already in the selected state of a group —
      // clicking them is intentionally a no-op.
      if (ariaBefore.pressed === "true") continue;
      if (ariaBefore.current === "page") continue;

      await page.evaluate(() => {
        (window as Window).__hydraEvents = [];
      });

      const accessibleName = await btn.evaluate(
        (el) =>
          el.getAttribute("aria-label") ||
          el.textContent?.trim().slice(0, 40) ||
          "(unnamed)",
      );

      await btn.click({ trial: false, timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(80); // flush microtasks + IDB write

      const eventsFired = await page.evaluate(
        () => ((window as Window).__hydraEvents ?? []).length,
      );

      const ariaAfter = await btn.evaluate((el) => ({
        current: el.getAttribute("aria-current"),
        pressed: el.getAttribute("aria-pressed"),
        expanded: el.getAttribute("aria-expanded"),
        checked: el.getAttribute("aria-checked"),
      }));

      const ariaChanged =
        ariaBefore.current !== ariaAfter.current ||
        ariaBefore.pressed !== ariaAfter.pressed ||
        ariaBefore.expanded !== ariaAfter.expanded ||
        ariaBefore.checked !== ariaAfter.checked;

      const wired = eventsFired > 0 || ariaChanged;
      if (!wired) {
        deadButtons.push(`"${accessibleName}"`);
      }

    }

    expect(
      deadButtons,
      `Dead button(s) on ${tab}: ${deadButtons.join(", ")}`,
    ).toEqual([]);
  });
}

test("Send Test Reminder opens takeover; Add Water dismisses and logs intake", async ({
  page,
}) => {
  await installHook(page);
  await page.goto("/");
  await completeOnboarding(page);

  // Reminders tab → Send Test Reminder
  await goToTab(page, "reminders");
  await page
    .getByRole("button", { name: /send test reminder/i })
    .click();

  // Takeover should be visible with its time + label
  const takeover = page.getByTestId("reminder-takeover");
  await expect(takeover).toBeVisible();
  await expect(page.getByTestId("takeover-time")).toBeVisible();
  await expect(page.getByTestId("takeover-label")).toBeVisible();

  // Tap "Add Water (250ml)" — both logs intake and dismisses
  await page.getByTestId("takeover-add").click();
  await expect(takeover).toHaveCount(0);

  // Dashboard should now show 0.3L (250ml → (0.25).toFixed(1) rounds to 0.3)
  await page
    .locator("nav")
    .getByRole("button", { name: /^dashboard$/i })
    .click();
  await expect(page.getByText(/0\.3L/i).first()).toBeVisible();
});

test("PIN: set 1234 \u2192 reload \u2192 lock screen \u2192 wrong PIN errors \u2192 correct PIN unlocks", async ({
  page,
}) => {
  await installHook(page);
  await page.goto("/");
  await completeOnboarding(page);
  await goToTab(page, "profile");

  // Enable PIN
  await page.getByRole("button", { name: /set 4-digit pin/i }).click();
  await page.getByLabel(/choose a 4-digit pin/i).fill("1234");
  await page.getByRole("button", { name: /^enable pin$/i }).click();

  // pin/set runs PBKDF2 (100k iter) + re-encrypts every IDB row, so the
  // toggle flipping to "Disable" is our signal that the write completed.
  // Without this wait the reload races the IDB transaction.
  await expect(page.getByRole("button", { name: /^disable$/i })).toBeVisible({
    timeout: 10000,
  });

  // Hard reload — lock screen should appear.
  await page.reload();
  await expect(page.getByRole("dialog", { name: /enter pin/i })).toBeVisible({
    timeout: 8000,
  });

  // Wrong PIN: 9999 \u2192 error message, attempts decremented.
  for (const d of "9999") {
    await page.getByRole("button", { name: new RegExp(`^${d}$`) }).click();
  }
  await expect(page.getByText(/wrong pin/i)).toBeVisible({ timeout: 4000 });

  // Correct PIN: 1234 \u2192 unlock, dashboard chrome appears.
  for (const d of "1234") {
    await page.getByRole("button", { name: new RegExp(`^${d}$`) }).click();
  }
  await expect(page.getByRole("dialog", { name: /enter pin/i })).toHaveCount(0, {
    timeout: 8000,
  });
  await page.waitForSelector("main", { timeout: 5000 });
});

test("Backup roundtrip: export \u2192 reset \u2192 import restores entries + profile", async ({
  page,
}) => {
  await installHook(page);
  await page.goto("/");
  await completeOnboarding(page);

  // Log a 500ml entry so the backup has something distinctive.
  await page
    .locator("main")
    .getByRole("button", { name: /^500ml$/i })
    .first()
    .click();
  await page.waitForTimeout(100);

  // Export to file: capture the download payload as JSON text.
  await goToTab(page, "profile");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /export to file/i }).click(),
  ]);
  const downloadPath = await download.path();
  const fs = await import("fs/promises");
  const json = await fs.readFile(downloadPath, "utf-8");
  const parsed = JSON.parse(json) as {
    version: number;
    data: { entries: Array<{ ml: number }> };
  };
  expect(parsed.version).toBe(2);
  expect(parsed.data.entries.length).toBeGreaterThan(0);

  // Reset all data \u2192 onboarding should reappear after the auto-reload.
  await page.getByRole("button", { name: /^reset$/i }).click();
  await page.getByRole("button", { name: /yes, wipe everything/i }).click();
  await page.waitForSelector("input[aria-label='Your name']", { timeout: 8000 });

  // Re-onboard with a different name so import-vs-onboarding is visible.
  await completeOnboarding(page);

  // Import the captured backup. The hidden file input is non-visible; we
  // set its files programmatically and dispatch a change event.
  await goToTab(page, "profile");
  const fileInput = page.locator("input[type='file']");
  await fileInput.setInputFiles({
    name: "hydrablue-backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(json),
  });

  // Status message confirms the import worked.
  await expect(page.getByText(/imported/i)).toBeVisible({ timeout: 5000 });

  // Dashboard should show the restored intake (\u2265 500ml \u2192 0.5L+).
  await page
    .locator("nav")
    .getByRole("button", { name: /^dashboard$/i })
    .click();
  await expect(page.getByText(/0\.[5-9]L|[1-9]\.[0-9]+L/).first()).toBeVisible();
});

test("bottom-nav tabs switch the active page", async ({ page }) => {
  await installHook(page);
  await page.goto("/");
  await completeOnboarding(page);

  for (const tab of TABS) {
    const navBtn = page
      .locator("nav")
      .getByRole("button", { name: new RegExp(`^${tab}$`, "i") });
    await navBtn.click();
    await page.waitForTimeout(150);
    const current = await navBtn.getAttribute("aria-current");
    expect(current, `${tab} should be aria-current=\"page\" after click`).toBe(
      "page",
    );
  }
});
