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
  getSelectedItemTitle,
} from './helpers';

// ─── Test 1: Typing filters results ──────────────────────────────────────────

test('Typing filters results', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  // Wait for smart suggestions to load
  await new Promise(r => setTimeout(r, 1000));
  const initialCount = await getResultCount(page);

  // Type a query that should match some actions
  await typeInCommandBar(page, 'tab');
  const filteredCount = await getResultCount(page);

  // The result count should differ from initial suggestions (either more specific or different set)
  expect(filteredCount).toBeGreaterThan(0);
  // Typing a query changes from smart-suggestions mode to search mode
  expect(filteredCount).not.toBe(initialCount);

  await context.close();
});

// ─── Test 2: Arrow down moves selection ──────────────────────────────────────

test('Arrow down moves selection', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  const initialTitle = await getSelectedItemTitle(page);
  expect(initialTitle.length).toBeGreaterThan(0);

  await page.keyboard.press('ArrowDown');
  await new Promise(r => setTimeout(r, 300));

  const afterDownTitle = await getSelectedItemTitle(page);
  // Selection should have moved to a different item
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

  // Press ArrowDown twice
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

// ─── Test 4: Enter executes and closes ───────────────────────────────────────

test('Enter executes', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  expect(await isOverlayOpen(page)).toBe(true);

  await page.keyboard.press('Enter');
  await new Promise(r => setTimeout(r, 800));

  // Overlay should close after executing
  expect(await isOverlayOpen(page)).toBe(false);

  await context.close();
});

// ─── Test 5: Action prefix mode ──────────────────────────────────────────────

test('Action prefix mode', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  // Type ">tab" — action prefix mode that matches action items with "tab" in title
  await typeInCommandBar(page, '>tab');
  await new Promise(r => setTimeout(r, 800));

  const headers = await getGroupHeaders(page);
  const count = await getResultCount(page);

  // Should have results and only actions group should be present
  expect(count).toBeGreaterThan(0);
  expect(headers.length).toBeGreaterThan(0);

  // All visible group headers should be the Actions group only
  const nonActionHeaders = headers.filter(
    h => h.toLowerCase() !== 'actions'
  );
  expect(nonActionHeaders.length).toBe(0);

  await context.close();
});

// ─── Test 6: Clearing search returns to suggestions ──────────────────────────

test('Clearing search returns to suggestions', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context);

  await openCommandBar(page);
  await new Promise(r => setTimeout(r, 1000));

  // Type a query that likely returns no or few results
  await typeInCommandBar(page, 'xyzabc123noresults');
  await new Promise(r => setTimeout(r, 600));

  const countAfterQuery = await getResultCount(page);
  // May be 0 or very few — either way we proceed

  // Clear the input
  await typeInCommandBar(page, '');
  await new Promise(r => setTimeout(r, 800));

  const countAfterClear = await getResultCount(page);
  // After clearing, smart suggestions should reappear
  expect(countAfterClear).toBeGreaterThan(0);
  expect(countAfterClear).toBeGreaterThan(countAfterQuery);

  await context.close();
});
