import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  openPopupPage,
  discardTab,
  getTabs,
  getSleepBadgedTitles,
  getTabGridLabelForTitle,
} from './helpers';

// Tab-state matrix: hibernated (discarded) tabs. Driver-page pattern —
// the target must be inactive to discard; discard happens BEFORE any
// palette opens, and all lookups are by URL (discard can replace the tab
// with a new id and detaches its Playwright Page).
//
// FIXME(environment): chrome.tabs.discard SEGFAULTS the bundled
// Chromium-for-Testing build (macOS arm64, playwright chromium-1228) —
// verified with a minimal probe (sw-created tab, no palette, no extension
// interaction, with and without --disable-back-forward-cache). The specs
// below are complete and gated behind test.fixme until Playwright ships a
// fixed build; the wake logic, badge rendering, discarded-state plumbing,
// and surface parity are all pinned by unit tests
// (src/__tests__/background/index.test.ts 'hibernated tab wake',
// TreeView/TreeItem/CommandBar badge suites, surface-parity.test.tsx).
// Manual verification: enable Memory Saver, let a tab sleep, activate it
// from the palette — it must reload and show content.

test.fixme(
  true,
  'chrome.tabs.discard crashes this Chromium-for-Testing build — see header'
);

async function targetState(context: Awaited<ReturnType<typeof launchWithExtension>>) {
  const tabs = await getTabs(context);
  const target = tabs.find(t => t.url.includes('example.org'));
  return target
    ? { discarded: target.discarded, status: target.status, active: target.active }
    : null;
}

async function pressLabelFor(
  page: import('@playwright/test').Page,
  title: string
): Promise<void> {
  await expect
    .poll(() => getTabGridLabelForTitle(page, title), { timeout: 5000 })
    .not.toBe('');
  const label = await getTabGridLabelForTitle(page, title);
  for (const ch of label) {
    await page.keyboard.press(ch).catch(() => {});
    await new Promise(r => setTimeout(r, 50));
  }
}

test('activating a hibernated tab from the palette reloads and shows the page', async () => {
  const context = await launchWithExtension();
  const target = await openPage(context, 'https://example.org');
  await target.evaluate(() => { document.title = 'Zebra Target Tab'; });
  const driver = await openPage(context, 'https://example.com');

  await discardTab(context, 'example.org');

  await openCommandBar(driver);
  // Discarded tabs keep their title in the palette.
  await pressLabelFor(driver, 'Zebra Target Tab');

  // The switch must WAKE the tab: not discarded, fully loaded, active.
  await expect
    .poll(() => targetState(context), { timeout: 15000 })
    .toEqual({ discarded: false, status: 'complete', active: true });

  // And the page must actually render — re-find it by URL (the original
  // Page handle detached on discard).
  const revived = context.pages().find(p => p.url().includes('example.org'));
  expect(revived).toBeTruthy();
  await revived!.waitForFunction(
    () => (document.body?.innerText ?? '').trim().length > 0,
    undefined,
    { timeout: 10000 }
  );

  await context.close();
});

test('activating a hibernated tab from the popup reloads and shows the page', async () => {
  const context = await launchWithExtension();
  const target = await openPage(context, 'https://example.org');
  await target.evaluate(() => { document.title = 'Zebra Target Tab'; });
  await openPage(context, 'https://example.com');

  await discardTab(context, 'example.org');

  const popup = await openPopupPage(context);
  await pressLabelFor(popup, 'Zebra Target Tab');

  await expect
    .poll(() => targetState(context), { timeout: 15000 })
    .toEqual({ discarded: false, status: 'complete', active: true });

  const revived = context.pages().find(p => p.url().includes('example.org'));
  expect(revived).toBeTruthy();
  await revived!.waitForFunction(
    () => (document.body?.innerText ?? '').trim().length > 0,
    undefined,
    { timeout: 10000 }
  );

  await context.close();
});

test('discarded tabs show the sleep badge on both surfaces', async () => {
  const context = await launchWithExtension();
  const target = await openPage(context, 'https://example.org');
  await target.evaluate(() => { document.title = 'Zebra Target Tab'; });
  const driver = await openPage(context, 'https://example.com');

  await discardTab(context, 'example.org');

  // Popup first (identical-tab-set protocol), kept open.
  const popup = await openPopupPage(context);
  await expect
    .poll(() => getSleepBadgedTitles(popup), { timeout: 5000 })
    .toContain('Zebra Target Tab');
  const popupBadges = await getSleepBadgedTitles(popup);

  await driver.bringToFront();
  await openCommandBar(driver);
  await expect
    .poll(() => getSleepBadgedTitles(driver), { timeout: 5000 })
    .toContain('Zebra Target Tab');
  const overlayBadges = await getSleepBadgedTitles(driver);

  expect(overlayBadges).toEqual(popupBadges);

  await context.close();
});
