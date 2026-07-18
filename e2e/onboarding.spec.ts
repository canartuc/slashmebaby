import { test, expect } from '@playwright/test';
import { launchBrowserWithExtension as launchWithExtension, getExtensionId } from './helpers';

// ─── Test 1: Onboarding page loads ───────────────────────────────────────────

test('Onboarding page loads', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Step 1 heading should be visible
  await expect(page.locator('text=Pick your shortcut')).toBeVisible();

  await context.close();
});

// ─── Test 2: Step 1 shows 4 shortcut options ─────────────────────────────────

test('Step 1 shows shortcut options', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // 4 shortcut buttons in the picker grid
  const shortcutButtons = page.locator('.smb-onboarding-shortcut-option');
  await expect(shortcutButtons).toHaveCount(4);

  await context.close();
});

// ─── Test 3: Next advances to step 2 ─────────────────────────────────────────

test('Next advances to step 2', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  // Verify we start on step 1
  await expect(page.locator('text=Pick your shortcut')).toBeVisible();

  // Click Next
  const nextButton = page.locator('button.smb-onboarding-next-btn');
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Step 2 content should be visible
  await expect(page.locator('text=Try it out!')).toBeVisible();

  await context.close();
});

// ─── Test 4: Step 3 shows navigation guide ───────────────────────────────────

test('Step 3 shows navigation guide', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  const nextButton = page.locator('button.smb-onboarding-next-btn');

  // Advance to step 2
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Advance to step 3
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Step 3: keyboard navigation guide
  await expect(page.locator('text=Navigate like a pro')).toBeVisible();

  // Verify key-action rows exist (↑ ↓ Tab Enter Esc)
  const keyRows = page.locator('.smb-onboarding-key-row');
  await expect(keyRows).toHaveCount(5);

  await context.close();
});

// ─── Test 5: Step 4 shows pin-to-toolbar instructions ────────────────────────

test('Step 4 shows pin-to-toolbar instructions', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  const nextButton = page.locator('button.smb-onboarding-next-btn');

  // Advance through steps 1 → 2 → 3 → 4
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Step 4: pin instructions (Chromium build → Chrome copy). The async
  // "Pinned" badge is deliberately NOT asserted — the Playwright harness may
  // or may not report the icon as pinned.
  await expect(page.locator('text=Pin it to your toolbar')).toBeVisible();
  await expect(page.locator('.smb-onboarding-pin-step').first()).toContainText(
    'puzzle-piece Extensions button'
  );

  await context.close();
});

// ─── Test 6: Step 5 shows completion with Start Browsing button ──────────────

test('Step 5 shows completion', async () => {
  const context = await launchWithExtension();
  const id = await getExtensionId(context);

  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/onboarding.html`);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));

  const nextButton = page.locator('button.smb-onboarding-next-btn');

  // Advance through steps 1 → 2 → 3 → 4 → 5
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));
  await nextButton.click();
  await new Promise(r => setTimeout(r, 500));

  // Step 5: completion screen
  await expect(page.locator("text=You're all set!")).toBeVisible();

  // "Start Browsing" button should be present
  await expect(page.locator('button.smb-onboarding-complete-btn')).toBeVisible();
  await expect(page.locator('button.smb-onboarding-complete-btn')).toContainText('Start Browsing');

  // The Next button should no longer be shown (we're on the last step)
  await expect(nextButton).not.toBeVisible();

  await context.close();
});
