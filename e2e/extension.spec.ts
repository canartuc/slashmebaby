import { test, expect, type BrowserContext } from '@playwright/test';
import { getExtensionId } from './helpers';

// All tests share a persistent browser context with the extension loaded
let extensionId: string;

test.beforeEach(async ({ context }) => {
  extensionId = await getExtensionId(context);
});

// ─── Test 1: Extension loads without errors ───────────────────────────────────

test('extension loads without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('https://example.com');
  await page.waitForTimeout(1000);

  // Filter out known benign errors (e.g., network errors on example.com)
  const extensionErrors = errors.filter((e) => e.includes('slashmebaby') || e.includes(extensionId));
  expect(extensionErrors).toEqual([]);
});

// ─── Test 2: Popup renders ───────────────────────────────────────────────────

test('popup renders with search input', async ({ page }) => {
  await page.goto(`chrome-extension://${extensionId}/popup/index.html`);

  // Verify the search input is present
  const input = page.locator('input[type="text"]');
  await expect(input).toBeVisible();
  await expect(input).toHaveAttribute('placeholder', /search/i);
});

// ─── Test 3: Settings page renders ───────────────────────────────────────────

test('settings page renders all sections', async ({ page }) => {
  await page.goto(`chrome-extension://${extensionId}/settings/index.html`);

  // Verify the page title
  await expect(page.locator('h1')).toContainText('SlashMeBaby Settings');

  // Verify all setting sections are present
  await expect(page.locator('text=Keyboard Shortcut')).toBeVisible();
  await expect(page.locator('text=Command Bar Position')).toBeVisible();
  await expect(page.locator('text=Theme')).toBeVisible();
  await expect(page.locator('text=Search Sources')).toBeVisible();
});

// ─── Test 4: Onboarding page renders ─────────────────────────────────────────

test('onboarding page renders step 1 (shortcut picker)', async ({ page }) => {
  await page.goto(`chrome-extension://${extensionId}/onboarding/index.html`);

  // Verify the title
  await expect(page.locator('h1')).toContainText('SlashMeBaby');

  // Verify step 1 content — shortcut picker
  await expect(page.locator('text=Pick your shortcut')).toBeVisible();

  // Verify shortcut options are rendered
  await expect(page.locator('text=Alt + Space')).toBeVisible();
  await expect(page.locator('text=Ctrl + Shift + L')).toBeVisible();

  // Verify progress dots are present (4 steps)
  const dots = page.locator('.smb-onboarding-dot');
  await expect(dots).toHaveCount(4);
});

// ─── Test 5: Onboarding advances through all steps ──────────────────────────

test('onboarding advances through all 4 steps', async ({ page }) => {
  await page.goto(`chrome-extension://${extensionId}/onboarding/index.html`);

  // Step 1: Shortcut picker
  await expect(page.locator('text=Pick your shortcut')).toBeVisible();

  // Click "Next" to advance to step 2
  const nextButton = page.locator('button:has-text("Next")');
  await nextButton.click();

  // Step 2: Try it out
  await expect(page.locator('text=Try it out')).toBeVisible();

  // Click "Next" to advance to step 3
  await nextButton.click();

  // Step 3: Navigation guide
  await expect(page.locator('text=Navigate like a pro')).toBeVisible();

  // Click "Next" to advance to step 4
  await nextButton.click();

  // Step 4: Completion
  await expect(page.locator('text=You\'re all set')).toBeVisible();

  // Verify the "Start Browsing" button is shown (not "Next")
  await expect(page.locator('button:has-text("Start Browsing")')).toBeVisible();
  await expect(nextButton).not.toBeVisible();
});
