import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  openPopupPage,
  seedBookmarks,
  seedManyBookmarks,
  setSetting,
  pinTab,
  getSectionedResults,
  getPaletteInputState,
  getGroupHeaders,
  getFirstTwoCharTreeLabel,
  getActiveTabUrlViaSw,
  getTabs,
} from './helpers';

// DOM-level surface parity: the real popup page and the real overlay must
// render identical palettes for identical data.
//
// Identical-tab-set protocol: the popup page is itself a tab, and
// GET_ALL_TABS includes it. Open the popup tab FIRST and keep it, then
// bring the content page to front and open the overlay — both surfaces
// then observe the same tab set at their mount times.

async function collectGridLabels(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    return Array.from(root.querySelectorAll('.smb-tab-col-label')).map(
      (el) => el.textContent ?? ''
    );
  });
}

async function collectTreeBadges(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    return Array.from(root.querySelectorAll('.smb-tree-item .smb-label-badge')).map(
      (el) => el.textContent ?? ''
    );
  });
}

test('popup and overlay render identical jump-first surfaces for the same data', async () => {
  const context = await launchWithExtension();
  await seedBookmarks(context);
  await setSetting(context, { theme: 'dark' });
  const page = await openPage(context, 'https://example.com');

  // Popup tab first, kept open.
  const popup = await openPopupPage(context);
  await expect
    .poll(() => collectGridLabels(popup), { timeout: 5000 })
    .not.toEqual([]);
  const popupState = {
    input: await getPaletteInputState(popup),
    headers: await getGroupHeaders(popup),
    gridLabels: await collectGridLabels(popup),
    treeBadges: await collectTreeBadges(popup),
    sections: (await getSectionedResults(popup)).map((s) => ({
      header: s.header,
      titles: s.items.map((i) => i.title),
    })),
  };

  // Same tab set now observed by the overlay.
  await page.bringToFront();
  await openCommandBar(page);
  await expect
    .poll(() => collectGridLabels(page), { timeout: 5000 })
    .not.toEqual([]);
  const overlayState = {
    input: await getPaletteInputState(page),
    headers: await getGroupHeaders(page),
    gridLabels: await collectGridLabels(page),
    treeBadges: await collectTreeBadges(page),
    sections: (await getSectionedResults(page)).map((s) => ({
      header: s.header,
      titles: s.items.map((i) => i.title),
    })),
  };

  expect(popupState).toEqual(overlayState);
  expect(popupState.input.readOnly).toBe(true);
  expect(popupState.gridLabels.length).toBeGreaterThan(0);

  await context.close();
});

test('a digit key switches to the pinned tab from the popup', async () => {
  const context = await launchWithExtension();
  await openPage(context, 'https://example.org');
  await pinTab(context, 'example.org');
  await openPage(context, 'https://example.com');

  const popup = await openPopupPage(context);
  await popup.waitForFunction(
    () => document.querySelectorAll('.smb-pinned-number').length > 0,
    undefined,
    { timeout: 5000 }
  );

  await popup.keyboard.press('1').catch(() => {});
  await expect
    .poll(() => getActiveTabUrlViaSw(context), { timeout: 10000 })
    .toContain('example.org');

  await context.close();
});

test('a two-char label combo activates from the popup', async () => {
  const context = await launchWithExtension();
  await seedManyBookmarks(context, 16);
  await openPage(context, 'https://example.com');

  const popup = await openPopupPage(context);
  // Expand the selected bookmarks root so labeled leaves are visible.
  await expect
    .poll(() => getPaletteInputState(popup).then((s) => s.readOnly), { timeout: 5000 })
    .toBe(true);
  await popup.keyboard.press('ArrowRight');
  await expect
    .poll(() => getFirstTwoCharTreeLabel(popup), { timeout: 5000 })
    .not.toBeNull();

  const combo = (await getFirstTwoCharTreeLabel(popup))!;
  const match = combo.title.match(/Seed (\d\d)/);
  expect(match).not.toBeNull();

  // Shift on the second key opens the target in a NEW tab (OPEN_NEW_TAB).
  // Plain activation would NAVIGATE the popup's own tab in this harness
  // (the popup page is a tab here) and race its window.close() — in a real
  // popup window there is no sender tab and the page behind navigates.
  await popup.keyboard.press(combo.label[0]);
  await popup.keyboard.press(`Shift+${combo.label[1].toUpperCase()}`).catch(() => {});

  await expect
    .poll(async () =>
      (await getTabs(context)).some(t => t.url === `https://example.com/seed-${match![1]}`),
      { timeout: 10000 }
    )
    .toBe(true);

  await context.close();
});
