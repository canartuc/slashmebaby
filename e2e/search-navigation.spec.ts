import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension,
  openPage,
  openCommandBar,
  isOverlayOpen,
  typeInCommandBar,
  getInputValue,
  getResultCount,
  getSelectedItemTitle,
} from './helpers';

// Helper: switch from jump mode to search mode by pressing /
async function enterSearchMode(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press('/');
  await new Promise(r => setTimeout(r, 500));
}

// ─── Test 1: Typing filters results ──────────────────────────────────────────

test('Typing filters results', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  // Switch to search mode (command bar opens in jump mode by default)
  await enterSearchMode(page);
  // Wait for tree data to load
  await new Promise(r => setTimeout(r, 1000));
  const initialCount = await getResultCount(page);

  // Type a query — tree view filters items by title/url match
  await typeInCommandBar(page, 'example');
  const filteredCount = await getResultCount(page);

  // Should have some results matching
  expect(filteredCount).toBeGreaterThan(0);
  // Filtered count should differ from full tree
  expect(filteredCount).not.toBe(initialCount);

  await context.close();
});

// ─── Test 2: Arrow down moves selection ──────────────────────────────────────

test('Arrow down moves selection', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  // Expand the first group so we get child items to navigate
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 500));

  // Now there should be multiple items (group + expanded children)
  const initialTitle = await getSelectedItemTitle(page);
  expect(initialTitle.length).toBeGreaterThan(0);

  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 300));

  const afterDownTitle = await getSelectedItemTitle(page);
  // Selection should have moved to a different item (a child tab)
  expect(afterDownTitle.length).toBeGreaterThan(0);
  expect(afterDownTitle).not.toBe(initialTitle);

  await context.close();
});

// ─── Test 3: Arrow up moves selection ────────────────────────────────────────

test('Arrow up moves selection', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  // Expand the first group so we get child items to navigate
  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 500));

  // Press ArrowDown twice to move past the group header
  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 200));
  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 200));

  const afterTwoDownTitle = await getSelectedItemTitle(page);

  // Press ArrowUp once — should move back one item
  await page.keyboard.press('ArrowUp');
  await new Promise(r => setTimeout(r, 300));

  const afterUpTitle = await getSelectedItemTitle(page);
  expect(afterUpTitle.length).toBeGreaterThan(0);
  expect(afterUpTitle).not.toBe(afterTwoDownTitle);

  await context.close();
});

// ─── Test 4: Enter on folder toggles expand ─────────────────────────────────

test('Enter toggles folder expand', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  // The first item is typically a folder/group — press Enter to toggle
  const countBefore = await getResultCount(page);

  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 500));

  // If it was a folder, the count should change (expand/collapse)
  // Overlay should remain open (folders don't dismiss)
  expect(await isOverlayOpen(page)).toBe(true);

  const countAfter = await getResultCount(page);
  // Count should have changed (items expanded or collapsed)
  expect(countAfter).not.toBe(countBefore);

  await context.close();
});

// ─── Test 5: Search mode shows filtered results ─────────────────────────────

test('Search mode shows filtered results', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  // Switch to search mode
  await enterSearchMode(page);
  await new Promise(r => setTimeout(r, 1000));

  // Type a query that won't match anything
  await typeInCommandBar(page, 'xyzabc123noresults');
  await new Promise(r => setTimeout(r, 600));

  const countAfterQuery = await getResultCount(page);
  // May be 0 or very few

  // Clear the input — tree items should reappear
  await typeInCommandBar(page, '');
  await new Promise(r => setTimeout(r, 800));

  const countAfterClear = await getResultCount(page);
  // After clearing, full tree should reappear
  expect(countAfterClear).toBeGreaterThan(0);
  expect(countAfterClear).toBeGreaterThan(countAfterQuery);

  await context.close();
});

// ─── Test 6: Search input value updates correctly ───────────────────────────

test('Search input value updates', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  // Switch to search mode
  await enterSearchMode(page);
  await new Promise(r => setTimeout(r, 500));

  await typeInCommandBar(page, 'test');
  const value = await getInputValue(page);
  expect(value).toBe('test');

  await context.close();
});
