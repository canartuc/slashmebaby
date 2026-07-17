import { test, expect } from '@playwright/test';
import { launchBrowserWithExtension as launchWithExtension, openPage } from './helpers';

// Playwright cannot click the real toolbar icon or fire registered command
// shortcuts, so these tests assert the observable contract of the per-tab
// popup routing instead: the popup string the background maintains for each
// tab, read through the service worker.

async function getPopupForUrl(
  context: Awaited<ReturnType<typeof launchWithExtension>>,
  urlPattern: string
): Promise<string | null> {
  const sw = context.serviceWorkers()[0];
  return sw.evaluate(async (pattern: string) => {
    const [tab] = await chrome.tabs.query({ url: pattern });
    if (tab?.id === undefined) return null;
    return await chrome.action.getPopup({ tabId: tab.id });
  }, urlPattern);
}

// ─── Test 1: injectable pages get a cleared per-tab popup ────────────────────

test('clears the per-tab popup on injectable pages', async () => {
  const context = await launchWithExtension();

  await openPage(context, 'https://example.com');

  // '' means icon clicks fire action.onClicked → in-page overlay.
  await expect
    .poll(() => getPopupForUrl(context, 'https://example.com/*'), { timeout: 10000 })
    .toBe('');

  await context.close();
});

// ─── Test 2: chrome:// pages keep the default popup ──────────────────────────

test('keeps the default popup on chrome:// pages', async () => {
  const context = await launchWithExtension();

  const page = await context.newPage();
  await page.goto('chrome://version/');
  await page.waitForLoadState('domcontentloaded');

  await expect
    .poll(() => getPopupForUrl(context, 'chrome://version/*'), { timeout: 10000 })
    .toContain('popup.html');

  await context.close();
});

// ─── Test 3: navigating injectable → restricted restores the default ─────────

test('restores the default popup after navigating from https to chrome://', async () => {
  const context = await launchWithExtension();

  const page = await openPage(context, 'https://example.com');
  await expect
    .poll(() => getPopupForUrl(context, 'https://example.com/*'), { timeout: 10000 })
    .toBe('');

  await page.goto('chrome://version/');
  await page.waitForLoadState('domcontentloaded');

  await expect
    .poll(() => getPopupForUrl(context, 'chrome://version/*'), { timeout: 10000 })
    .toContain('popup.html');

  await context.close();
});
