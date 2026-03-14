import { test, expect } from '@playwright/test';
import { chromium } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

async function launchWithExtension() {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
  await new Promise(r => setTimeout(r, 2000));
  return context;
}

async function getExtensionId(context: Awaited<ReturnType<typeof launchWithExtension>>): Promise<string> {
  let attempts = 0;
  while (attempts < 10) {
    const workers = context.serviceWorkers();
    for (const w of workers) {
      const match = w.url().match(/chrome-extension:\/\/([^/]+)/);
      if (match) return match[1];
    }
    await new Promise(r => setTimeout(r, 500));
    attempts++;
  }
  throw new Error('Could not find extension ID');
}

// ─── Test 1: Popup page loads ─────────────────────────────────────────────────

test('Popup page loads', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // The popup container should render
  const popup = page.locator('.smb-popup');
  await expect(popup).toBeVisible();

  await context.close();
});

// ─── Test 2: Shows search input with placeholder ──────────────────────────────

test('Shows search input', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  const input = page.locator('input.smb-input');
  await expect(input).toBeVisible();

  // Verify placeholder text exists
  const placeholder = await input.getAttribute('placeholder');
  expect(placeholder).toBeTruthy();
  expect(placeholder!.length).toBeGreaterThan(0);

  await context.close();
});

// ─── Test 3: Has no backdrop element ─────────────────────────────────────────

test('Has no backdrop', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // The popup is a standalone page — it should NOT have the overlay backdrop
  const backdrop = page.locator('.smb-backdrop');
  await expect(backdrop).toHaveCount(0);

  await context.close();
});
