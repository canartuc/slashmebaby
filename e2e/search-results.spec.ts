import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  typeInCommandBar,
  getSectionedResults,
  getSelectedItemTitle,
  getServiceWorker,
  getTabs,
  isOverlayOpen,
  seedDiacriticBookmark,
} from './helpers';

// Search-mode behaviors: Enter navigation, Shift+Enter new tab, the
// go-to-URL row, '>' action mode, and diacritics folding. Seed titles use
// unique tokens that cannot fuzzy-collide with the open tabs.

async function seedNamedBookmarks(
  context: Awaited<ReturnType<typeof launchWithExtension>>,
  entries: Array<{ title: string; url: string }>
) {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async (list: Array<{ title: string; url: string }>) => {
    for (const entry of list) {
      await new Promise(r => chrome.bookmarks.create({ parentId: '1', ...entry }, r));
    }
  }, entries);
  await new Promise(r => setTimeout(r, 300));
}

test('Enter on a bookmark result navigates the current tab', async () => {
  const context = await launchWithExtension();
  await seedNamedBookmarks(context, [
    { title: 'Zebra Notes', url: 'https://example.org/zebra' },
  ]);
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, 'zebra');
  // Fuzzy matching may surface a weak tab match above the bookmark — jump
  // to the Bookmarks section with Tab if the selection isn't there yet.
  await expect
    .poll(async () => {
      if (!(await getSelectedItemTitle(page)).includes('Zebra Notes')) {
        await page.keyboard.press('Tab');
      }
      return getSelectedItemTitle(page);
    }, { timeout: 5000 })
    .toContain('Zebra Notes');

  await page.keyboard.press('Enter');
  await expect.poll(() => page.url(), { timeout: 10000 }).toBe('https://example.org/zebra');

  await context.close();
});

test('Shift+Enter opens the result in a new tab and keeps the current page', async () => {
  const context = await launchWithExtension();
  await seedNamedBookmarks(context, [
    { title: 'Quokka Notes', url: 'https://example.net/quokka' },
  ]);
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, 'quokka');
  await expect
    .poll(async () => {
      if (!(await getSelectedItemTitle(page)).includes('Quokka Notes')) {
        await page.keyboard.press('Tab');
      }
      return getSelectedItemTitle(page);
    }, { timeout: 5000 })
    .toContain('Quokka Notes');

  await page.keyboard.press('Shift+Enter');

  await expect
    .poll(async () => (await getTabs(context)).some(t => t.url.includes('example.net/quokka')), {
      timeout: 10000,
    })
    .toBe(true);
  expect(page.url()).toBe('https://example.com/');
  await expect.poll(() => isOverlayOpen(page), { timeout: 5000 }).toBe(false);

  await context.close();
});

test("go-to-URL row navigates for a path-bearing query", async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, 'example.org/some/path');

  // The synthetic Navigate row is the LAST result — ArrowUp wraps to it.
  await expect
    .poll(async () => (await getSectionedResults(page)).map(s => s.header), { timeout: 5000 })
    .toContain('Navigate');
  await page.keyboard.press('ArrowUp');
  await expect
    .poll(() => getSelectedItemTitle(page), { timeout: 5000 })
    .toContain('Go to https://example.org/some/path');

  await page.keyboard.press('Enter');
  // A 404 body is fine — the URL is the contract.
  await expect
    .poll(() => page.url(), { timeout: 10000 })
    .toBe('https://example.org/some/path');

  await context.close();
});

test("'>' shows only actions and '>clo' filters them", async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, '>');

  await expect
    .poll(async () => {
      const sections = await getSectionedResults(page);
      return sections.map(s => s.header);
    }, { timeout: 5000 })
    .toEqual(['Actions']);
  const allActions = (await getSectionedResults(page))[0].items.length;
  expect(allActions).toBeGreaterThan(5);

  await typeInCommandBar(page, '>clo');
  // Fuzzy matching can keep weak non-'clo' hits — the contract is that the
  // list SHRINKS and the best match is a Close action.
  await expect
    .poll(async () => {
      const sections = await getSectionedResults(page);
      const items = sections[0]?.items ?? [];
      return items.length > 0 && items.length < allActions && /clo/i.test(items[0].title);
    }, { timeout: 5000 })
    .toBe(true);

  await context.close();
});

test("diacritics folding: 'sozcu' matches 'Sözcü'", async () => {
  const context = await launchWithExtension();
  await seedDiacriticBookmark(context);
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, 'sozcu');

  await expect
    .poll(async () => {
      const sections = await getSectionedResults(page);
      const bookmarks = sections.find(s => s.header === 'Bookmarks');
      return bookmarks?.items.some(i => i.title.includes('Sözcü')) ?? false;
    }, { timeout: 5000 })
    .toBe(true);

  await context.close();
});
