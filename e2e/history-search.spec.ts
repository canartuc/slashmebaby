import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  typeInCommandBar,
  seedHistory,
  setSetting,
  getSectionedResults,
  getServiceWorker,
} from './helpers';

// History coverage. Real visits create titled history entries; the history
// cache refreshes on chrome.history.onVisited (debounced).

test('visited pages appear under History in overlay search', async () => {
  const context = await launchWithExtension();
  await seedHistory(context, ['https://example.net/']);
  const page = await openPage(context, 'https://example.com');

  // The overlay fetches history once at mount — if the debounced cache
  // refresh lands after the palette opened, reopen it for a fresh fetch.
  await expect
    .poll(async () => {
      await openCommandBar(page);
      await page.keyboard.press('/');
      await typeInCommandBar(page, 'example.net');
      const sections = await getSectionedResults(page);
      const history = sections.find(s => s.header === 'History');
      const count = history?.items.length ?? 0;
      if (count === 0) {
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));
      }
      return count;
    }, { timeout: 15000, intervals: [500, 1000, 1000, 2000] })
    .toBeGreaterThan(0);

  await context.close();
});

test('results render Tabs → Bookmarks → History with per-group caps', async () => {
  const context = await launchWithExtension();

  // Three bookmarks that match 'example'.
  const sw = await getServiceWorker(context);
  await sw.evaluate(async () => {
    for (const [title, url] of [
      ['Example Seed A', 'https://example.com/a'],
      ['Example Seed B', 'https://example.com/b'],
      ['Example Seed C', 'https://example.com/c'],
    ] as const) {
      await new Promise(r => chrome.bookmarks.create({ parentId: '1', title, url }, r));
    }
  });

  // History entries must be 200 responses (Chrome skips 404s): two seeded
  // roots plus the visits from opening the tabs below make >= 2 'example'
  // matches, which the cap then trims to exactly 2.
  await seedHistory(context, ['https://example.net/', 'https://example.edu/']);

  await setSetting(context, { maxResultsPerGroup: 2 });

  // Three open tabs matching 'example'.
  await openPage(context, 'https://example.org');
  await openPage(context, 'https://example.com/x');
  const page = await openPage(context, 'https://example.com');

  // Reopen-on-miss for the same one-shot-history-fetch reason as above.
  await expect
    .poll(async () => {
      await openCommandBar(page);
      await page.keyboard.press('/');
      // Not domain-like ('example' has no dot) → no Navigate row.
      await typeInCommandBar(page, 'example');
      const sections = (await getSectionedResults(page)).filter(s => s.items.length > 0);
      const shape = sections.map(s => `${s.header}:${s.items.length}`);
      if (shape.join(',') !== 'Open Tabs:2,Bookmarks:2,History:2') {
        await page.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));
      }
      return shape;
    }, { timeout: 15000, intervals: [500, 1000, 1000, 2000] })
    .toEqual(['Open Tabs:2', 'Bookmarks:2', 'History:2']);

  await context.close();
});
