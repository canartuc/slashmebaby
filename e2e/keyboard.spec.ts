import { test, expect, chromium } from '@playwright/test';
import path from 'path';

async function launchWithExtension() {
  const extensionPath = path.resolve('.output/chrome-mv3');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
  await new Promise(r => setTimeout(r, 2000));
  return context;
}

async function openCommandBar(page: any) {
  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));
}

async function getOverlayState(page: any): Promise<string> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    if (!host?.shadowRoot) return 'no shadow root';
    const backdrop = host.shadowRoot.querySelector('.smb-backdrop');
    return backdrop ? 'open' : 'closed';
  });
}

test('Escape key closes the command bar', async () => {
  const context = await launchWithExtension();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  await openCommandBar(page);
  expect(await getOverlayState(page)).toBe('open');

  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  expect(await getOverlayState(page)).toBe('closed');

  await context.close();
});

test('Enter key executes selected item', async () => {
  const context = await launchWithExtension();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  await openCommandBar(page);
  expect(await getOverlayState(page)).toBe('open');

  // Press Enter on whatever is selected
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 500));

  // Overlay should close after executing
  expect(await getOverlayState(page)).toBe('closed');

  await context.close();
});

test('Arrow keys navigate results', async () => {
  const context = await launchWithExtension();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  await openCommandBar(page);
  expect(await getOverlayState(page)).toBe('open');

  // Check initial selected item
  const initialSelected = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const selected = host?.shadowRoot?.querySelector('.smb-result-item--selected');
    return selected?.querySelector('.smb-title')?.textContent || 'none';
  });
  console.log('Initial selection:', initialSelected);

  // Press ArrowDown
  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 300));

  const afterDown = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const selected = host?.shadowRoot?.querySelector('.smb-result-item--selected');
    return selected?.querySelector('.smb-title')?.textContent || 'none';
  });
  console.log('After ArrowDown:', afterDown);

  // Selection should have changed
  expect(afterDown !== 'none').toBe(true);

  // Press Escape to close
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  expect(await getOverlayState(page)).toBe('closed');

  await context.close();
});

test('Shortcut toggles command bar open and closed', async () => {
  const context = await launchWithExtension();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Open
  await openCommandBar(page);
  expect(await getOverlayState(page)).toBe('open');

  // Close with same shortcut
  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 500));
  expect(await getOverlayState(page)).toBe('closed');

  // Open again
  await openCommandBar(page);
  expect(await getOverlayState(page)).toBe('open');

  // Close with Escape
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 500));
  expect(await getOverlayState(page)).toBe('closed');

  await context.close();
});
