import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension,
  openPage,
  openCommandBar,
  isOverlayOpen,
} from './helpers';
import type { Page } from '@playwright/test';

// ─── Shadow DOM helper queries ──────────────────────────────────────────────

async function hasTreeItems(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const sr = host?.shadowRoot;
    if (!sr) return false;
    // "Tree items" covers tab columns, bookmark tree, and legacy result rows.
    return (
      sr.querySelectorAll('.smb-tab-col-item').length +
      sr.querySelectorAll('.smb-tree-item').length +
      sr.querySelectorAll('.smb-result-item').length
    ) > 0;
  });
}

async function hasLabelBadges(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return (host?.shadowRoot?.querySelectorAll('.smb-label-badge')?.length || 0) > 0;
  });
}

async function isJumpMode(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement;
    return input?.readOnly === true;
  });
}

async function hasActionDivider(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return !!host?.shadowRoot?.querySelector('.smb-action-divider');
  });
}

// ─── Test 1: Tree view shows on open ────────────────────────────────────────

test('Tree view shows on open', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  expect(await isOverlayOpen(page)).toBe(true);

  // Wait for tree data to load
  await new Promise(r => setTimeout(r, 1000));
  expect(await hasTreeItems(page)).toBe(true);

  await context.close();
});

// ─── Test 2: Labels visible in jump mode ────────────────────────────────────

test('Labels visible in jump mode', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  expect(await hasLabelBadges(page)).toBe(true);

  await context.close();
});

// ─── Test 3: Jump mode is default ───────────────────────────────────────────

test('Jump mode is default', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 500));

  expect(await isJumpMode(page)).toBe(true);

  await context.close();
});

// ─── Test 4: Actions section visible ────────────────────────────────────────

test('Actions section visible', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  expect(await hasActionDivider(page)).toBe(true);

  await context.close();
});

// ─── Test 5: Search mode toggle ─────────────────────────────────────────────

test('Search mode toggle with / key', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 500));

  // Should start in jump mode (readonly)
  expect(await isJumpMode(page)).toBe(true);

  // Press / to toggle to search mode
  await page.keyboard.press('/');
  await new Promise(r => setTimeout(r, 500));

  // Should now be in search mode (not readonly)
  expect(await isJumpMode(page)).toBe(false);

  await context.close();
});

// ─── Test 6: Escape closes in jump mode ─────────────────────────────────────

test('Escape closes in jump mode', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  expect(await isOverlayOpen(page)).toBe(true);

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  expect(await isOverlayOpen(page)).toBe(false);

  await context.close();
});

// ─── Test 7: Escape closes in search mode ───────────────────────────────────

test('Escape closes in search mode', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 500));

  // Toggle to search mode
  await page.keyboard.press('/');
  await new Promise(r => setTimeout(r, 500));
  expect(await isJumpMode(page)).toBe(false);

  // Press Escape to close
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));

  expect(await isOverlayOpen(page)).toBe(false);

  await context.close();
});
