import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  createTabGroup,
  getServiceWorker,
  getActiveTabUrlViaSw,
} from './helpers';

// Real chrome.tabs.group / chrome.tabGroups round-trip — the background's
// hasTabGroups branch was previously exercised only with mocks. The overlay
// currently flattens groups into the tab grid (no group titles rendered);
// TODO: assert the visible group title once group rendering lands.

async function gridTitles(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const titles = host?.shadowRoot?.querySelectorAll('.smb-tab-col-title') ?? [];
    return Array.from(titles).map(t => t.textContent ?? '');
  });
}

test('tabs inside a titled Chrome tab group stay in the palette and activate', async () => {
  const context = await launchWithExtension();
  const grouped = await openPage(context, 'https://example.org');
  await grouped.evaluate(() => { document.title = 'Zebra Grouped Tab'; });
  const page = await openPage(context, 'https://example.com');

  await createTabGroup(context, { title: 'Work', urlSubstrings: ['example.org'] });

  await openCommandBar(page);
  await expect
    .poll(() => gridTitles(page), { timeout: 5000 })
    .toContain('Zebra Grouped Tab');

  // Activate the grouped tab via its jump label.
  const label = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const items = host?.shadowRoot?.querySelectorAll('.smb-tab-col-item') ?? [];
    for (const item of Array.from(items)) {
      if ((item.querySelector('.smb-tab-col-title')?.textContent ?? '').includes('Zebra Grouped Tab')) {
        return item.querySelector('.smb-tab-col-label')?.textContent ?? '';
      }
    }
    return '';
  });
  expect(label).not.toBe('');
  for (const ch of label) {
    await page.keyboard.press(ch);
  }

  await expect
    .poll(() => getActiveTabUrlViaSw(context), { timeout: 10000 })
    .toContain('example.org');

  await context.close();
});

test("tabs from a second window appear in the palette", async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  const sw = await getServiceWorker(context);
  await sw.evaluate(async () => {
    await chrome.windows.create({ url: 'https://example.net/' });
  });
  // Wait for the new window's tab to finish loading.
  await sw.evaluate(async () => {
    const deadline = Date.now() + 10000;
    for (;;) {
      const tabs = await chrome.tabs.query({ url: 'https://example.net/*' });
      if (tabs.some(t => t.status === 'complete')) return;
      if (Date.now() > deadline) throw new Error('second-window tab never completed');
      await new Promise(r => setTimeout(r, 200));
    }
  });

  // Retitle it so the grid row is uniquely identifiable.
  const otherPage = context.pages().find(p => p.url().startsWith('https://example.net'));
  await otherPage?.evaluate(() => { document.title = 'Quokka Second Window'; });

  // Focus back on window 1 and open the palette there.
  await page.bringToFront();
  await openCommandBar(page);
  await expect
    .poll(() => gridTitles(page), { timeout: 5000 })
    .toContain('Quokka Second Window');

  await context.close();
});
