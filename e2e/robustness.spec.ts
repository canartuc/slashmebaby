import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  isOverlayOpen,
} from './helpers';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

// Audit-3 gap closures: persistence across restarts, keystroke release
// after close, rapid toggling, and hostile host-page CSS.

test('settings survive a browser restart on the same profile (TS-008)', async () => {
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smb-profile-'));
  const launch = () =>
    chromium.launchPersistentContext(profileDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
        '--disable-default-apps',
      ],
    });

  const first = await launch();
  if (first.serviceWorkers().length === 0) {
    await first.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => {});
  }
  const sw1 = first.serviceWorkers()[0];
  await sw1.evaluate(
    () =>
      new Promise<void>((resolve) =>
        chrome.storage.sync.set(
          { settings: { theme: 'light', maxResultsPerGroup: 8 } },
          () => resolve()
        )
      )
  );
  await first.close();

  const second = await launch();
  if (second.serviceWorkers().length === 0) {
    await second.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => {});
  }
  const sw2 = second.serviceWorkers()[0];
  const stored = await sw2.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve) =>
        chrome.storage.sync.get('settings', (r) => resolve(r.settings as Record<string, unknown>))
      )
  );
  expect(stored).toMatchObject({ theme: 'light', maxResultsPerGroup: 8 });
  await second.close();
  fs.rmSync(profileDir, { recursive: true, force: true });
});

test('closing the palette releases focus and keystrokes to the page (TS-015)', async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  // Give the host page an input to receive released keystrokes.
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.id = 'host-field';
    document.body.appendChild(input);
    input.focus();
  });

  await openCommandBar(page);
  await page.keyboard.press('Escape');
  await expect.poll(() => isOverlayOpen(page), { timeout: 5000 }).toBe(false);

  // After close, typing must reach the page again (no lingering capture).
  await page.click('#host-field');
  await page.keyboard.type('released');
  const value = await page.evaluate(
    () => (document.getElementById('host-field') as HTMLInputElement).value
  );
  expect(value).toBe('released');

  await context.close();
});

test('rapid shortcut toggling never duplicates the overlay (TS-168)', async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  const shortcut =
    process.platform === 'darwin' ? 'Meta+Shift+Space' : 'Control+Shift+Space';
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(shortcut);
  }
  await new Promise(r => setTimeout(r, 800));

  const state = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return {
      hosts: document.querySelectorAll('#slashmebaby-root').length,
      backdrops: host?.shadowRoot?.querySelectorAll('.smb-backdrop').length ?? 0,
    };
  });
  expect(state.hosts).toBe(1);
  expect(state.backdrops).toBeLessThanOrEqual(1);
  expect(errors.filter(e => e.includes('slashmebaby'))).toEqual([]);

  await context.close();
});

test('overlay resists hostile host-page CSS (TS-138/140/141/142)', async () => {
  const context = await launchWithExtension();
  const page = await openPage(context, 'https://example.com');

  // Three hostile payloads in one page: a global reset, framework-style
  // aggressive globals, and CSS-in-JS-style high-specificity injections.
  await page.addStyleTag({
    content: `
      * { margin: 0 !important; padding: 0 !important; box-sizing: content-box !important; }
      body { font-size: 40px !important; color: red !important; font-family: serif !important; line-height: 3 !important; }
      div, span, input { all: revert !important; }
      div[id] span { color: lime !important; letter-spacing: 12px !important; }
    `,
  });

  await openCommandBar(page);
  const readStyle = () =>
    page.evaluate(() => {
      const host = document.getElementById('slashmebaby-root');
      const input = host?.shadowRoot?.querySelector('.smb-input');
      const title = host?.shadowRoot?.querySelector('.smb-group-header');
      if (!input || !title) return null;
      const inputCs = getComputedStyle(input as Element);
      const titleCs = getComputedStyle(title as Element);
      return {
        inputFontSize: inputCs.fontSize,
        inputFontFamily: inputCs.fontFamily,
        titleLetterSpacing: titleCs.letterSpacing,
        titleColorIsLime: titleCs.color === 'rgb(0, 255, 0)',
      };
    });
  // Section headers render only after the async tab fetch — poll for them.
  await expect.poll(readStyle, { timeout: 5000 }).not.toBeNull();
  const style = await readStyle();

  expect(style).not.toBeNull();
  // :host { all: initial } + shadow isolation keep the design tokens:
  expect(style!.inputFontSize).toBe('16px'); // --text-lg, not the host 40px
  expect(style!.inputFontFamily).toContain('system-ui'); // not serif
  expect(style!.titleColorIsLime).toBe(false);
  expect(style!.titleLetterSpacing).not.toBe('12px');

  await context.close();
});
