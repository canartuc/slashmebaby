import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  seedManyBookmarks,
  seedNestedBookmarks,
  pinTab,
  getActiveTabUrlViaSw,
  getSelectedItemTitle,
  getResultCount,
  getFirstTwoCharTreeLabel,
  getTabGridLabelForTitle,
} from './helpers';

// EasyJump labels, pinned-tab number shortcuts, and tree arrow navigation.
// Labels are always read from the DOM — fresh-profile tab noise makes any
// index arithmetic wrong.

async function awaitTreeReady(page: import('@playwright/test').Page): Promise<void> {
  // The tree loads asynchronously after the overlay opens — pressing keys
  // earlier hits an empty list.
  await expect
    .poll(() => getSelectedItemTitle(page), { timeout: 5000 })
    .toMatch(/[Bb]ookmarks/);
}

async function getTreeLabelForTitle(
  page: import('@playwright/test').Page,
  title: string
): Promise<string> {
  return page.evaluate((t: string) => {
    const host = document.getElementById('slashmebaby-root');
    const rows = host?.shadowRoot?.querySelectorAll('.smb-tree-item') ?? [];
    for (const row of Array.from(rows)) {
      if ((row.querySelector('.smb-title')?.textContent ?? '').includes(t)) {
        return row.querySelector('.smb-label-badge')?.textContent ?? '';
      }
    }
    return '';
  }, title);
}

test('single-char label activates a bookmark and navigates the current tab', async () => {
  const context = await launchWithExtension();
  await seedManyBookmarks(context, 3);
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await awaitTreeReady(page);
  // Expand the bookmarks root so leaf rows (with labels) are visible.
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => getTreeLabelForTitle(page, 'Seed 01'), { timeout: 5000 })
    .not.toBe('');

  const label = await getTreeLabelForTitle(page, 'Seed 01');
  expect(label).toHaveLength(1);
  await page.keyboard.press(label);

  await expect
    .poll(() => page.url(), { timeout: 10000 })
    .toBe('https://example.com/seed-01');

  await context.close();
});

test('two-char labels appear beyond the label pool and jump correctly', async () => {
  const context = await launchWithExtension();
  await seedManyBookmarks(context, 16); // 16 leaves + roots + tabs > 14-char pool
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await awaitTreeReady(page);
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => getFirstTwoCharTreeLabel(page), { timeout: 5000 })
    .not.toBeNull();

  const combo = (await getFirstTwoCharTreeLabel(page))!;
  const match = combo.title.match(/Seed (\d\d)/);
  expect(match).not.toBeNull();

  // Two-char jump: first char arms the prefix, second activates. The
  // prefix is a ref (same-frame safe) — back-to-back presses must work.
  await page.keyboard.press(combo.label[0]);
  await page.keyboard.press(combo.label[1]);

  await expect
    .poll(() => page.url(), { timeout: 10000 })
    .toBe(`https://example.com/seed-${match![1]}`);

  await context.close();
});

test('tab-grid label switches to that tab', async () => {
  const context = await launchWithExtension();
  const pageOrg = await openPage(context, 'https://example.org');
  // Every IANA example.* page shares the title "Example Domain" — give the
  // target tab a distinct one so the grid row is identifiable.
  await pageOrg.evaluate(() => { document.title = 'Zebra Target Tab'; });
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await expect
    .poll(() => getTabGridLabelForTitle(page, 'Zebra Target Tab'), { timeout: 5000 })
    .not.toBe('');

  const label = await getTabGridLabelForTitle(page, 'Zebra Target Tab');
  for (const ch of label) {
    await page.keyboard.press(ch);
  }

  await expect
    .poll(() => getActiveTabUrlViaSw(context), { timeout: 10000 })
    .toContain('example.org');

  await context.close();
});

test('pressing 1 switches to the first pinned tab', async () => {
  const context = await launchWithExtension();
  await openPage(context, 'https://example.com');
  await pinTab(context, 'example.com');
  const page = await openPage(context, 'https://example.org');

  await openCommandBar(page);
  // The pinned grid renders numbered squares.
  await page.waitForFunction(
    () => {
      const host = document.getElementById('slashmebaby-root');
      return (host?.shadowRoot?.querySelectorAll('.smb-pinned-number').length ?? 0) > 0;
    },
    undefined,
    { timeout: 5000 }
  );

  await page.keyboard.press('1');
  await expect
    .poll(() => getActiveTabUrlViaSw(context), { timeout: 10000 })
    .toContain('example.com');

  await context.close();
});

test('ArrowRight expands, ArrowLeft jumps to parent then collapses', async () => {
  const context = await launchWithExtension();
  await seedNestedBookmarks(context);
  const page = await openPage(context, 'https://example.com');

  await openCommandBar(page);
  await awaitTreeReady(page);
  const initialCount = await getResultCount(page);

  // Expand the bookmarks root.
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => getResultCount(page), { timeout: 5000 })
    .toBeGreaterThan(initialCount);

  // Walk down to 'E2E Seeds' and expand it, then into 'Inner'.
  await page.keyboard.press('ArrowDown'); // E2E Seeds
  await expect.poll(() => getSelectedItemTitle(page), { timeout: 5000 }).toContain('E2E Seeds');
  await page.keyboard.press('ArrowRight'); // expand E2E Seeds
  await page.keyboard.press('ArrowDown'); // Inner
  await expect.poll(() => getSelectedItemTitle(page), { timeout: 5000 }).toContain('Inner');
  await page.keyboard.press('ArrowRight'); // expand Inner
  await page.keyboard.press('ArrowDown'); // Deep One
  await expect.poll(() => getSelectedItemTitle(page), { timeout: 5000 }).toContain('Deep One');

  // ArrowLeft from a leaf jumps to its parent folder.
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => getSelectedItemTitle(page), { timeout: 5000 }).toContain('Inner');

  // ArrowLeft on the expanded folder collapses it.
  const beforeCollapse = await getResultCount(page);
  await page.keyboard.press('ArrowLeft');
  await expect
    .poll(() => getResultCount(page), { timeout: 5000 })
    .toBeLessThan(beforeCollapse);

  await context.close();
});
