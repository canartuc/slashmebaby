import { test, expect } from '@playwright/test';
import { launchBrowserWithExtension as launchWithExtension, getExtensionId } from './helpers';

// ─── Test 1: Extension loads without errors ───────────────────────────────────

test('extension loads without console errors', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('https://example.com');
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Filter to only extension-specific errors
  const extensionErrors = errors.filter((e) => e.includes('slashmebaby') || e.includes(id));
  expect(extensionErrors).toEqual([]);

  await context.close();
});

// ─── Test 2: Popup renders ───────────────────────────────────────────────────

test('popup renders with search input', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Verify the search input is present
  const input = page.locator('input.smb-input');
  await expect(input).toBeVisible();

  const placeholder = await input.getAttribute('placeholder');
  expect(placeholder).toBeTruthy();

  await context.close();
});

// ─── Test 3: Settings page renders ───────────────────────────────────────────

test('settings page renders all sections', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/settings.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Verify the page title
  await expect(page.locator('h1.smb-settings-title')).toContainText('SlashMeBaby Settings');

  // Verify all setting sections are present
  await expect(page.locator('text=Keyboard Shortcut')).toBeVisible();
  await expect(page.locator('text=Command Bar Position')).toBeVisible();
  await expect(page.locator('text=Theme')).toBeVisible();
  await expect(page.locator('text=Search Sources')).toBeVisible();

  await context.close();
});

// ─── Test 4: Onboarding page renders ─────────────────────────────────────────

test('onboarding page renders step 1 (shortcut picker)', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Verify the title
  await expect(page.locator('h1.smb-onboarding-title')).toContainText('SlashMeBaby');

  // Verify step 1 content — shortcut picker
  await expect(page.locator('text=Pick your shortcut')).toBeVisible();

  // Verify shortcut options are rendered (4 buttons)
  const shortcutButtons = page.locator('.smb-onboarding-shortcut-option');
  await expect(shortcutButtons).toHaveCount(4);

  // Verify progress dots are present (4 steps)
  const dots = page.locator('.smb-onboarding-dot');
  await expect(dots).toHaveCount(4);

  await context.close();
});

// ─── Test 5: Onboarding advances through all steps ──────────────────────────

test('onboarding advances through all 4 steps', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Step 1: Shortcut picker
  await expect(page.locator('text=Pick your shortcut')).toBeVisible();

  const nextButton = page.locator('button.smb-onboarding-next-btn');

  // Click "Next" to advance to step 2
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Step 2: Try it out
  await expect(page.locator('text=Try it out!')).toBeVisible();

  // Click "Next" to advance to step 3
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Step 3: Navigation guide
  await expect(page.locator('text=Navigate like a pro')).toBeVisible();

  // Click "Next" to advance to step 4
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Step 4: Completion
  await expect(page.locator("text=You're all set!")).toBeVisible();

  // Verify the "Start Browsing" button is shown (not "Next")
  await expect(page.locator('button.smb-onboarding-complete-btn')).toContainText('Start Browsing');
  await expect(nextButton).not.toBeVisible();

  await context.close();
});
