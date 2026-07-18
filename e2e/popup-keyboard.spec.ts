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
// Playwright cannot click the toolbar icon). The popup opens in JUMP MODE
// identical to the overlay (surface parity): labels pressable on entry,
// '/' enters typed search.

test("opens in jump mode; '/' enters typed search which filters immediately", async () => {
  const context = await launchWithExtension();
  await seedBookmarks(context);
  await openPage(context, 'https://example.com');
  const popup = await openPopupPage(context);

  // Jump-first entry: read-only input, labels visible.
  await expect
    .poll(async () =>
      popup.evaluate(
        () => (document.querySelector('.smb-input') as HTMLInputElement)?.readOnly ?? false
      ), { timeout: 5000 })
    .toBe(true);
  await expect
    .poll(
      () => popup.evaluate(() => document.querySelectorAll('.smb-tab-col-label').length),
      { timeout: 5000 }
    )
    .toBeGreaterThan(0);

  // Enter search mode with a pipeline-proof retry: pressing before the
  // key listeners attach would leave jump mode live, where 'm' is the
  // mute action.
  await expect
    .poll(async () => {
      const ro = await popup.evaluate(
        () => (document.querySelector('.smb-input') as HTMLInputElement)?.readOnly ?? true
      );
      if (ro) await popup.keyboard.press('/');
      return ro;
    }, { timeout: 5000 })
    .toBe(false);
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

test("opens with jump labels; '/' toggles typed search and back", async () => {
  const context = await launchWithExtension();
  await openPage(context, 'https://example.com');
  const popup = await openPopupPage(context);

  const isReadOnly = () =>
    popup.evaluate(
      () => (document.querySelector('.smb-input') as HTMLInputElement)?.readOnly ?? false
    );

  // Jump-first: read-only with labels on entry.
  await expect.poll(isReadOnly, { timeout: 5000 }).toBe(true);
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

  await popup.keyboard.press('/');
  await expect.poll(isReadOnly, { timeout: 5000 }).toBe(true);

  await context.close();
});

test('jump label in the popup switches the active tab', async () => {
  const context = await launchWithExtension();
  const target = await openPage(context, 'https://example.org');
  await target.evaluate(() => { document.title = 'Zebra Popup Target'; });
  await openPage(context, 'https://example.com');
  const popup = await openPopupPage(context);

  // Already in jump mode on entry — no '/' needed.
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

  // Prove the keyboard pipeline (usePopupKeySource → CommandBar) is live:
  // '/' flips readOnly only once the effect listeners attached. Toggle
  // into search and back so the press below runs in jump mode.
  const readOnly = () =>
    popup.evaluate(
      () => (document.querySelector('.smb-input') as HTMLInputElement)?.readOnly ?? false
    );
  await expect
    .poll(async () => {
      if (await readOnly()) await popup.keyboard.press('/');
      return readOnly();
    }, { timeout: 5000 })
    .toBe(false);
  await popup.keyboard.press('/');
  await expect.poll(readOnly, { timeout: 5000 }).toBe(true);
  await popup.keyboard.press('t'); // New Tab action

  await expect
    .poll(async () => (await getTabs(context)).length, { timeout: 10000 })
    .toBeGreaterThan(tabCountBefore);

  await context.close();
});

test('Backspace never closes the popup; Escape does', async () => {
  const context = await launchWithExtension();
  await openPage(context, 'https://example.com');

  const popup = await openPopupPage(context);
  const readOnly = () =>
    popup.evaluate(
      () => (document.querySelector('.smb-input') as HTMLInputElement)?.readOnly ?? false
    );

  // Backspace on jump-mode entry: inert (strict overlay parity).
  await expect.poll(readOnly, { timeout: 5000 }).toBe(true);
  await popup.keyboard.press('Backspace');
  // Alive-proof: the keyboard pipeline still responds ('/' flips modes).
  await popup.keyboard.press('/');
  await expect.poll(readOnly, { timeout: 5000 }).toBe(false);
  expect(popup.isClosed()).toBe(false);

  // Mid-query editing preserved.
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

  // Empty the query, press Backspace again — the popup must STAY open.
  await popup.keyboard.press('Backspace');
  await popup.keyboard.press('Backspace');
  await popup.keyboard.press('Backspace');
  await new Promise(r => setTimeout(r, 400));
  expect(popup.isClosed()).toBe(false);

  // Escape still closes; window.close() can land mid-keystroke and make
  // the press throw 'Target page has been closed' — that IS success.
  await popup.keyboard.press('Escape').catch(() => {});
  await expect.poll(() => popup.isClosed(), { timeout: 5000 }).toBe(true);

  await context.close();
});
