import { test, expect } from '@playwright/test';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openPopupPage,
  seedBookmarks,
  getTabs,
  getActiveTabUrlViaSw,
} from './helpers';

// Keyboard flows on the action-popup page (reached by direct navigation —
// Playwright cannot click the toolbar icon). The popup opens in search
// mode: typing filters immediately; '/' toggles jump labels.

test('type-to-search filters immediately on open', async () => {
  const context = await launchWithExtension();
  await seedBookmarks(context);
  await openPage(context, 'https://example.com');
  const popup = await openPopupPage(context);

  await popup.keyboard.type('mozilla');
  await expect
    .poll(async () =>
      popup.evaluate(() => {
        const rows = document.querySelectorAll('.smb-tree-item .smb-title');
        return Array.from(rows).map(r => r.textContent ?? '');
      }), { timeout: 5000 })
    .toContain('Mozilla Developer');

  const inputValue = await popup.evaluate(
    () => (document.querySelector('.smb-input') as HTMLInputElement)?.value ?? ''
  );
  expect(inputValue).toBe('mozilla');

  await context.close();
});

test("'/' toggles jump labels and back", async () => {
  const context = await launchWithExtension();
  await openPage(context, 'https://example.com');
  const popup = await openPopupPage(context);

  const isReadOnly = () =>
    popup.evaluate(
      () => (document.querySelector('.smb-input') as HTMLInputElement)?.readOnly ?? false
    );

  expect(await isReadOnly()).toBe(false);

  await popup.keyboard.press('/');
  await expect.poll(isReadOnly, { timeout: 5000 }).toBe(true);
  // Jump labels appear in the tab grid.
  await expect
    .poll(
      () =>
        popup.evaluate(
          () => document.querySelectorAll('.smb-tab-col-label').length
        ),
      { timeout: 5000 }
    )
    .toBeGreaterThan(0);

  await popup.keyboard.press('/');
  await expect.poll(isReadOnly, { timeout: 5000 }).toBe(false);

  await context.close();
});

test('jump label in the popup switches the active tab', async () => {
  const context = await launchWithExtension();
  const target = await openPage(context, 'https://example.org');
  await target.evaluate(() => { document.title = 'Zebra Popup Target'; });
  await openPage(context, 'https://example.com');
  const popup = await openPopupPage(context);

  await popup.keyboard.press('/'); // jump mode
  await expect
    .poll(
      () =>
        popup.evaluate(() => {
          const items = document.querySelectorAll('.smb-tab-col-item');
          for (const item of Array.from(items)) {
            if ((item.querySelector('.smb-tab-col-title')?.textContent ?? '').includes('Zebra Popup Target')) {
              return item.querySelector('.smb-tab-col-label')?.textContent ?? '';
            }
          }
          return '';
        }),
      { timeout: 5000 }
    )
    .not.toBe('');

  const label = await popup.evaluate(() => {
    const items = document.querySelectorAll('.smb-tab-col-item');
    for (const item of Array.from(items)) {
      if ((item.querySelector('.smb-tab-col-title')?.textContent ?? '').includes('Zebra Popup Target')) {
        return item.querySelector('.smb-tab-col-label')?.textContent ?? '';
      }
    }
    return '';
  });

  for (const ch of label) {
    await popup.keyboard.press(ch);
  }

  await expect
    .poll(() => getActiveTabUrlViaSw(context), { timeout: 10000 })
    .toContain('example.org');

  await context.close();
});

test("action key 't' in jump mode opens a new tab", async () => {
  const context = await launchWithExtension();
  await openPage(context, 'https://example.com');
  const popup = await openPopupPage(context);

  const tabCountBefore = (await getTabs(context)).length;

  await popup.keyboard.press('/'); // jump mode
  // The action chips render once GET_ACTIONS resolves — pressing earlier
  // is a no-op.
  await popup.waitForFunction(
    () => document.querySelectorAll('.smb-action-chip').length > 0,
    undefined,
    { timeout: 5000 }
  );
  await popup.keyboard.press('t'); // New Tab action

  await expect
    .poll(async () => (await getTabs(context)).length, { timeout: 10000 })
    .toBeGreaterThan(tabCountBefore);

  await context.close();
});

test('Backspace edits mid-query and closes on empty; Escape closes', async () => {
  const context = await launchWithExtension();
  await openPage(context, 'https://example.com');

  // Backspace behavior.
  const popup = await openPopupPage(context);
  await popup.keyboard.type('exa');
  await popup.keyboard.press('Backspace');
  await expect
    .poll(
      () =>
        popup.evaluate(
          () => (document.querySelector('.smb-input') as HTMLInputElement)?.value ?? ''
        ),
      { timeout: 5000 }
    )
    .toBe('ex');
  expect(popup.isClosed()).toBe(false);

  // 'ex' → 'e' → '' — then the press that finds the query empty closes the
  // popup window. window.close() lands mid-keystroke, so the closing press
  // can throw 'Target page has been closed' — that IS the success signal.
  await popup.keyboard.press('Backspace');
  await popup.keyboard.press('Backspace');
  await popup.keyboard.press('Backspace').catch(() => {});
  await expect.poll(() => popup.isClosed(), { timeout: 5000 }).toBe(true);

  // Escape closes a fresh popup.
  const popup2 = await openPopupPage(context);
  await popup2.keyboard.press('Escape').catch(() => {});
  await expect.poll(() => popup2.isClosed(), { timeout: 5000 }).toBe(true);

  await context.close();
});
