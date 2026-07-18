import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  typeInCommandBar,
  seedManyBookmarks,
  seedBookmarks,
  setSetting,
  getSectionedResults,
  getOverlayTheme,
  getContainerBox,
} from './helpers';

// Settings must not just persist — the open overlay has a
// storage.onChanged listener and applies them live.

async function countTreeRows(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return host?.shadowRoot?.querySelectorAll('.smb-tree-item').length ?? 0;
  });
}

test('maxResultsPerGroup caps results and applies live while open', async () => {
  const context = await launchWithExtension();
  await seedManyBookmarks(context, 8);
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, 'seed');

  // Default cap is 5.
  await expect.poll(() => countTreeRows(page), { timeout: 5000 }).toBe(5);

  await setSetting(context, { maxResultsPerGroup: 2 });
  await expect.poll(() => countTreeRows(page), { timeout: 5000 }).toBe(2);

  await context.close();
});

// NOTE: showFavicons has no honest e2e — a fresh Playwright profile visits
// pages without cached favicons (example.com serves none), so zero favicon
// imgs render regardless of the setting. The prop pass-through is pinned by
// TreeView/CommandBar unit tests instead.

test('disabling the bookmarks source removes the Bookmarks section live', async () => {
  const context = await launchWithExtension();
  await seedBookmarks(context);
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await page.keyboard.press('/');
  await typeInCommandBar(page, 'example');

  await expect
    .poll(async () => (await getSectionedResults(page)).map(s => s.header), { timeout: 5000 })
    .toContain('Bookmarks');

  await setSetting(context, { searchSources: { bookmarks: false } });
  await expect
    .poll(async () => (await getSectionedResults(page)).map(s => s.header), { timeout: 5000 })
    .not.toContain('Bookmarks');
  // Tabs stay searchable.
  expect((await getSectionedResults(page)).map(s => s.header)).toContain('Open Tabs');

  // TS-115: re-enabling the source brings its results back live.
  await setSetting(context, { searchSources: { bookmarks: true } });
  await expect
    .poll(async () => (await getSectionedResults(page)).map(s => s.header), { timeout: 5000 })
    .toContain('Bookmarks');

  await context.close();
});

test('shortcut change applies live without a reload', async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  const isOpen = () =>
    page.evaluate(() => {
      const host = document.getElementById('slashmebaby-root');
      return !!host?.shadowRoot?.querySelector('.smb-backdrop');
    });

  // The new combo does nothing before the setting changes.
  await page.keyboard.press('Control+Period');
  await new Promise(r => setTimeout(r, 300));
  expect(await isOpen()).toBe(false);

  await setSetting(context, { shortcut: 'Ctrl+.' });

  // Positively confirm propagation FIRST: poll until the new combo opens
  // (retrying the press), so the negative assertion below can't race the
  // storage.onChanged delivery.
  await expect
    .poll(async () => {
      if (!(await isOpen())) await page.keyboard.press('Control+Period');
      return isOpen();
    }, { timeout: 5000 })
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(isOpen, { timeout: 5000 }).toBe(false);

  // Propagation proven — the old default must now be dead.
  await page.keyboard.press(
    process.platform === 'darwin' ? 'Meta+Shift+Space' : 'Control+Shift+Space'
  );
  await new Promise(r => setTimeout(r, 300));
  expect(await isOpen()).toBe(false);

  await context.close();
});

test('seeded theme lands data-theme on the live overlay and switches live', async () => {
  const context = await launchWithExtension();
  await setSetting(context, { theme: 'dark' });
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await expect
    .poll(async () => (await getOverlayTheme(page)).container, { timeout: 5000 })
    .toBe('dark');
  expect((await getOverlayTheme(page)).host).toBe('dark');

  await setSetting(context, { theme: 'light' });
  await expect
    .poll(async () => (await getOverlayTheme(page)).container, { timeout: 5000 })
    .toBe('light');
  await expect
    .poll(async () => (await getOverlayTheme(page)).host, { timeout: 5000 })
    .toBe('light');

  await context.close();
});

test('position setting controls overlay placement (top/center/bottom)', async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  // The mounted overlay fetches settings asynchronously — poll the class,
  // then measure the box.
  const openAndAwaitPosition = async (position: string) => {
    await setSetting(context, { position });
    await openCommandBar(page);
    await expect
      .poll(async () => (await getContainerBox(page))?.className ?? '', { timeout: 5000 })
      .toContain(`smb-container--${position}`);
    return (await getContainerBox(page))!;
  };

  // top: 32px margin (tolerance for the backdrop's flex context).
  let box = await openAndAwaitPosition('top');
  expect(box.top).toBeLessThanOrEqual(80);
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));

  // center: 20vh margin.
  box = await openAndAwaitPosition('center');
  expect(box.top).toBeGreaterThanOrEqual(box.innerHeight * 0.15);
  expect(box.top).toBeLessThanOrEqual(box.innerHeight * 0.3);
  await page.keyboard.press('Escape');
  await new Promise(r => setTimeout(r, 300));

  // bottom: fixed 32px from the bottom edge.
  box = await openAndAwaitPosition('bottom');
  expect(box.innerHeight - box.bottom).toBeLessThanOrEqual(80);

  await context.close();
});
