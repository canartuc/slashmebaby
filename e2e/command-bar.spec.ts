import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension,
  openPage,
  openCommandBar,
  isOverlayOpen,
  typeInCommandBar,
  getInputValue,
  getResultCount,
  getGroupHeaders,
} from './helpers';

// ─── Test 1: Opens with shortcut ─────────────────────────────────────────────

test('Opens with shortcut', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  expect(await isOverlayOpen(page)).toBe(true);

  await context.close();
});

// ─── Test 2: Shortcut toggles close ──────────────────────────────────────────

test('Shortcut toggles close', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  expect(await isOverlayOpen(page)).toBe(true);

  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 500));
  expect(await isOverlayOpen(page)).toBe(false);

  await context.close();
});

// ─── Test 3: Escape closes ────────────────────────────────────────────────────

test('Escape closes', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  expect(await isOverlayOpen(page)).toBe(true);

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  expect(await isOverlayOpen(page)).toBe(false);

  await context.close();
});

// ─── Test 4: Backdrop click closes ───────────────────────────────────────────

test('Backdrop click closes', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  expect(await isOverlayOpen(page)).toBe(true);

  await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const backdrop = host?.shadowRoot?.querySelector('.smb-backdrop') as HTMLElement;
    backdrop?.click();
  });
  await new Promise(r => setTimeout(r, 500));
  expect(await isOverlayOpen(page)).toBe(false);

  await context.close();
});

// ─── Test 5: Backspace on empty does NOT close ────────────────────────────────

test('Backspace on empty does NOT close', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  expect(await isOverlayOpen(page)).toBe(true);

  await page.keyboard.press('Backspace');
  await new Promise(r => setTimeout(r, 300));
  expect(await isOverlayOpen(page)).toBe(true);

  await context.close();
});

// ─── Test 6: Clean state on reopen ───────────────────────────────────────────

test('Clean state on reopen', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await typeInCommandBar(page, 'test');
  expect(await getInputValue(page)).toBe('test');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  expect(await isOverlayOpen(page)).toBe(false);

  await openCommandBar(page);
  const value = await getInputValue(page);
  expect(value).toBe('');

  await context.close();
});

// ─── Test 7: Shows smart suggestions on open ─────────────────────────────────

test('Shows smart suggestions on open', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  // Give background time to respond with suggestions
  await new Promise(r => setTimeout(r, 1000));
  const count = await getResultCount(page);
  expect(count).toBeGreaterThan(0);

  await context.close();
});

// ─── Test 8: Results are grouped ─────────────────────────────────────────────

test('Results are grouped', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));
  const headers = await getGroupHeaders(page);
  expect(headers.length).toBeGreaterThan(0);

  await context.close();
});

// ─── Test 9: Input has placeholder ───────────────────────────────────────────

test('Input has placeholder', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  const placeholder = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement;
    return input?.placeholder || '';
  });
  expect(placeholder.length).toBeGreaterThan(0);

  await context.close();
});

// ─── Test 10: Input is focused ───────────────────────────────────────────────

test('Input is focused', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  const isFocused = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const shadow = host?.shadowRoot;
    const input = shadow?.querySelector('.smb-input');
    return shadow?.activeElement === input;
  });
  expect(isFocused).toBe(true);

  await context.close();
});
