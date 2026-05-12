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
