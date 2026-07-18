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

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, 'example.net');

  await expect
    .poll(async () => {
      const sections = await getSectionedResults(page);
      const history = sections.find(s => s.header === 'History');
      return history?.items.length ?? 0;
    }, { timeout: 10000 })
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

  await openCommandBar(page);
  await page.keyboard.press('/');
  // Not domain-like ('example' has no dot) → no Navigate row.
  await typeInCommandBar(page, 'example');

  await expect
    .poll(async () => {
      const sections = (await getSectionedResults(page)).filter(s => s.items.length > 0);
      return sections.map(s => `${s.header}:${s.items.length}`);
    }, { timeout: 10000 })
    .toEqual(['Open Tabs:2', 'Bookmarks:2', 'History:2']);

  await context.close();
});
