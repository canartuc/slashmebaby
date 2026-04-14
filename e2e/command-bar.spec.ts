import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension,
  openPage,
  openCommandBar,
  isOverlayOpen,
  typeInCommandBar,
  getInputValue,
  OPEN_SHORTCUT,
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

  await page.keyboard.press(OPEN_SHORTCUT);
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

// ─── Test 7: Shows tree items on open (jump mode) ───────────────────────────

test('Shows tree items on open', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  // Give background time to respond with tree data
  await new Promise(r => setTimeout(r, 1000));
  const count = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const sr = host?.shadowRoot;
    if (!sr) return 0;
    return (
      sr.querySelectorAll('.smb-tab-col-item').length +
      sr.querySelectorAll('.smb-tree-item').length
    );
  });
  expect(count).toBeGreaterThan(0);

  await context.close();
});

// ─── Test 8: Actions section visible in tree view ───────────────────────────

test('Actions section visible in tree view', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));
  const hasActions = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return !!host?.shadowRoot?.querySelector('.smb-action-divider');
  });
  expect(hasActions).toBe(true);

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

// ─── Test 10: Opens in jump mode (input readonly) ───────────────────────────

test('Opens in jump mode', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  const isReadonly = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement;
    return input?.readOnly === true;
  });
  expect(isReadonly).toBe(true);

  await context.close();
});
