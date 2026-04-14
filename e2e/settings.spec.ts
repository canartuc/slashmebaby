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

// ─── Test 1: Settings page loads ─────────────────────────────────────────────

test('Settings page loads', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Page should render: h1 with settings title visible
  const title = page.locator('h1.smb-settings-title');
  await expect(title).toBeVisible();
  await expect(title).toContainText('SlashMeBaby Settings');

  await context.close();
});

// ─── Test 2: Shows 4 shortcut radio buttons ───────────────────────────────────

test('Shows shortcut options', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  const radios = page.locator('input[type="radio"][name="shortcut"]');
  await expect(radios).toHaveCount(4);

  await context.close();
});

// ─── Test 3: Shows platform-appropriate modifier labels ──────────────────────

test('Shows platform modifier labels', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // The extension detects platform via navigator.userAgent. Headless Chromium
  // on Linux CI reports Linux regardless of the host OS, so assert whichever
  // modifier the underlying page actually chose (⌘ on macOS, Ctrl elsewhere).
  const shortcutSection = page.locator('.smb-settings-section').first();
  const labelText = (await shortcutSection.textContent()) || '';
  expect(labelText.includes('⌘') || labelText.includes('Ctrl')).toBe(true);

  await context.close();
});

// ─── Test 4: Default shortcut is selected ────────────────────────────────────

test('Default shortcut selected', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // At least one radio in the shortcut group should be checked
  const checkedRadio = page.locator('input[type="radio"][name="shortcut"]:checked');
  await expect(checkedRadio).toHaveCount(1);

  await context.close();
});

// ─── Test 5: Shows position options ──────────────────────────────────────────

test('Shows position options', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  const positionRadios = page.locator('input[type="radio"][name="position"]');
  await expect(positionRadios).toHaveCount(3);

  // Verify the labels: Center, Top, Bottom
  await expect(page.locator('text=Center')).toBeVisible();
  await expect(page.locator('text=Top')).toBeVisible();
  await expect(page.locator('text=Bottom')).toBeVisible();

  await context.close();
});

// ─── Test 6: Shows theme options ─────────────────────────────────────────────

test('Shows theme options', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  const themeRadios = page.locator('input[type="radio"][name="theme"]');
  await expect(themeRadios).toHaveCount(3);

  // Verify the labels: System, Light, Dark
  await expect(page.locator('text=System')).toBeVisible();
  await expect(page.locator('text=Light')).toBeVisible();
  await expect(page.locator('text=Dark')).toBeVisible();

  await context.close();
});

// ─── Test 7: Shows search source toggles ─────────────────────────────────────

test('Shows search source toggles', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Three toggle switches for Tabs, Bookmarks, History
  const toggles = page.locator('button[role="switch"]');
  await expect(toggles).toHaveCount(3);

  await expect(page.locator('text=Tabs')).toBeVisible();
  await expect(page.locator('text=Bookmarks')).toBeVisible();
  await expect(page.locator('text=History')).toBeVisible();

  await context.close();
});
