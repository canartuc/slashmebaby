import { test, expect } from '@playwright/test';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import {
  launchBrowserWithExtension as launchWithExtension,
  openPage,
  openCommandBar,
  openPopupPage,
  seedBookmarks,
  setSetting,
  getGroupHeaders,
} from './helpers';

// Pixel-level surface parity of the RESULTS REGION. Geometry is normalized
// because the frames legitimately differ (centered modal vs 720×540
// window):
//  - viewport 1200×800 → overlay container min(768px, 60vw) = 720px, the
//    exact popup width; same context ⇒ same DPR and font engine;
//  - identical CSS injected into both surfaces pins the results height,
//    kills animations/caret, and hides favicons (geometry preserved);
//  - theme forced to dark so prefers-color-scheme can't diverge.
// A dimension mismatch means the normalization broke — not product drift —
// and fails with its own message.

const NORMALIZE_CSS = `
  .smb-results { height: 400px !important; max-height: 400px !important;
                 flex: none !important; overflow: hidden !important;
                 scroll-behavior: auto !important; }
  * { animation: none !important; transition: none !important;
      caret-color: transparent !important; }
  .smb-favicon, .smb-pinned-icon { visibility: hidden !important; }
`;

async function injectNormalization(page: import('@playwright/test').Page) {
  await page.evaluate((css: string) => {
    const host = document.getElementById('slashmebaby-root');
    const root: ParentNode & { appendChild: (n: Node) => unknown } =
      host?.shadowRoot ?? document.head;
    const style = document.createElement('style');
    style.textContent = css;
    root.appendChild(style);
  }, NORMALIZE_CSS);
  // Two frames so the style lands before capture.
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  );
}

test('the results region renders pixel-identical (within tolerance) in popup and overlay', async ({}, testInfo) => {
  const context = await launchWithExtension();
  await seedBookmarks(context);
  await setSetting(context, { theme: 'dark' });

  const page = await openPage(context, 'https://example.com');
  await page.setViewportSize({ width: 1200, height: 800 });

  // Identical-tab-set protocol: popup tab first, kept open.
  const popup = await openPopupPage(context);
  await popup.setViewportSize({ width: 1200, height: 800 });

  // DOM-parity gate before any pixels: same headers on both surfaces.
  await expect
    .poll(() => getGroupHeaders(popup), { timeout: 5000 })
    .toContain('Open Tabs');
  await injectNormalization(popup);
  const popupShot = await popup.locator('.smb-results').screenshot();

  await page.bringToFront();
  await openCommandBar(page);
  await expect
    .poll(async () => {
      const [popupHeaders, overlayHeaders] = [
        await getGroupHeaders(popup),
        await getGroupHeaders(page),
      ];
      return JSON.stringify(overlayHeaders) === JSON.stringify(popupHeaders);
    }, { timeout: 5000 })
    .toBe(true);
  await injectNormalization(page);
  const overlayShot = await page.locator('.smb-results').screenshot();

  const popupPng = PNG.sync.read(popupShot);
  const overlayPng = PNG.sync.read(overlayShot);

  expect(
    { width: popupPng.width, height: popupPng.height },
    'Capture dimensions differ — the normalization CSS broke, this is a test-infra failure, not product drift'
  ).toEqual({ width: overlayPng.width, height: overlayPng.height });

  const diff = new PNG({ width: popupPng.width, height: popupPng.height });
  const diffPixels = pixelmatch(
    popupPng.data,
    overlayPng.data,
    diff.data,
    popupPng.width,
    popupPng.height,
    { threshold: 0.2 }
  );
  const diffRatio = diffPixels / (popupPng.width * popupPng.height);

  if (diffRatio > 0.005) {
    await testInfo.attach('popup.png', { body: popupShot, contentType: 'image/png' });
    await testInfo.attach('overlay.png', { body: overlayShot, contentType: 'image/png' });
    await testInfo.attach('diff.png', {
      body: PNG.sync.write(diff),
      contentType: 'image/png',
    });
  }
  expect(diffRatio).toBeLessThanOrEqual(0.005);

  await context.close();
});
