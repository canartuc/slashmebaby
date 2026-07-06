import { test, expect } from '@playwright/test';
import { launchBrowserWithExtension, openPage, openCommandBar } from './helpers';

// Reproduces the reported bug: while typing into the palette search box, real
// keystrokes leaked to the host page. Many sites focus their own search field
// on keypress (type-to-focus), stealing focus mid-search and breaking input.
//
// This test installs exactly such a page handler, then types real keys (via
// page.keyboard, NOT the value-injection helper) and asserts the palette keeps
// focus and receives the full query — the page field must stay empty/unfocused.
test('palette search keystrokes do not leak to the host page', async () => {
  const context = await launchBrowserWithExtension();
  const page = await openPage(context, 'https://example.com');

  // Simulate a page that focuses its own input on any keypress.
  await page.evaluate(() => {
    const field = document.createElement('input');
    field.id = 'page-field';
    document.body.appendChild(field);
    document.addEventListener('keydown', () => field.focus());
  });

  await openCommandBar(page);
  await page.keyboard.press('/'); // enter search mode
  await page.keyboard.type('data', { delay: 40 });

  // Wait for React to commit the query.
  await page.waitForTimeout(300);

  const state = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement | null;
    const pageField = document.getElementById('page-field') as HTMLInputElement | null;
    return {
      query: input?.value ?? '',
      pageFieldValue: pageField?.value ?? '',
      pageFieldFocused: document.activeElement === pageField,
    };
  });

  expect(state.pageFieldFocused).toBe(false);
  expect(state.pageFieldValue).toBe('');
  expect(state.query).toBe('data');

  await context.close();
});
