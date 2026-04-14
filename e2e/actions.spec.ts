import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { OPEN_SHORTCUT, launchBrowserWithExtension as launch } from './helpers';

async function openPageAndBar(ctx: BrowserContext, url = 'https://example.com'): Promise<Page> {
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));
  await page.keyboard.press(OPEN_SHORTCUT);
  await new Promise(r => setTimeout(r, 800));
  return page;
}

async function isOverlayClosed(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const host = document.getElementById('slashmebaby-root');
      return !host?.shadowRoot?.querySelector('.smb-backdrop');
    });
  } catch {
    return true; // page closed = overlay closed
  }
}

// ─── t: New Tab ─────────────────────────────────────────────────────────────

test('Action t: New Tab', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);
  const before = ctx.pages().length;

  await page.keyboard.press('t');
  await new Promise(r => setTimeout(r, 1000));

  expect(ctx.pages().length).toBeGreaterThan(before);
  await ctx.close();
});

// ─── c: Close Tab ───────────────────────────────────────────────────────────

test('Action c: Close Tab', async () => {
  const ctx = await launch();
  const p1 = await ctx.newPage();
  await p1.goto('https://example.com');
  await new Promise(r => setTimeout(r, 500));
  const p2 = await ctx.newPage();
  await p2.goto('https://example.org');
  await new Promise(r => setTimeout(r, 1000));

  const before = ctx.pages().length;
  await p2.keyboard.press(OPEN_SHORTCUT);
  await new Promise(r => setTimeout(r, 800));
  await p2.keyboard.press('c');
  await new Promise(r => setTimeout(r, 1500));

  expect(ctx.pages().length).toBeLessThan(before);
  await ctx.close();
});

// ─── x: Close Other Tabs ────────────────────────────────────────────────────

test('Action x: Close Other Tabs', async () => {
  const ctx = await launch();
  const p1 = await ctx.newPage();
  await p1.goto('https://example.com');
  await new Promise(r => setTimeout(r, 500));
  const p2 = await ctx.newPage();
  await p2.goto('https://example.org');
  await new Promise(r => setTimeout(r, 500));
  const p3 = await ctx.newPage();
  await p3.goto('https://example.net');
  await new Promise(r => setTimeout(r, 1000));

  await p3.keyboard.press(OPEN_SHORTCUT);
  await new Promise(r => setTimeout(r, 800));
  await p3.keyboard.press('x');
  await new Promise(r => setTimeout(r, 1500));

  // p3 survives, others closed. about:blank default may survive too.
  expect(ctx.pages().length).toBeLessThanOrEqual(2);
  await ctx.close();
});

// ─── p: Pin Tab ─────────────────────────────────────────────────────────────

test('Action p: Pin Tab', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);

  await page.keyboard.press('p');
  await new Promise(r => setTimeout(r, 1000));

  expect(await isOverlayClosed(page)).toBe(true);
  await ctx.close();
});

// ─── m: Mute Tab ────────────────────────────────────────────────────────────

test('Action m: Mute Tab', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);

  await page.keyboard.press('m');
  await new Promise(r => setTimeout(r, 1000));

  expect(await isOverlayClosed(page)).toBe(true);
  await ctx.close();
});

// ─── d: Duplicate Tab ───────────────────────────────────────────────────────

test('Action d: Duplicate Tab', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);
  const before = ctx.pages().length;

  await page.keyboard.press('d');
  await new Promise(r => setTimeout(r, 1500));

  expect(ctx.pages().length).toBeGreaterThan(before);
  const urls = ctx.pages().map(p => p.url());
  const exampleCount = urls.filter(u => u.includes('example.com')).length;
  expect(exampleCount).toBeGreaterThanOrEqual(2);
  await ctx.close();
});

// ─── w: Move to New Window ──────────────────────────────────────────────────

test('Action w: Move to New Window', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);

  await page.keyboard.press('w');
  await new Promise(r => setTimeout(r, 1500));

  expect(await isOverlayClosed(page)).toBe(true);
  await ctx.close();
});

// ─── r: Reload Tab ──────────────────────────────────────────────────────────

test('Action r: Reload Tab', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);

  await page.keyboard.press('r');
  await new Promise(r => setTimeout(r, 1500));

  expect(await isOverlayClosed(page)).toBe(true);
  expect(page.url()).toContain('example.com');
  await ctx.close();
});

// ─── u: Copy Clean Link ─────────────────────────────────────────────────────

test('Action u: Copy Clean Link strips tracking params and dismisses', async ({ browserName }) => {
  const ctx = await launch();
  // Clipboard access in a headless-ish persistent context needs an explicit
  // grant; Firefox builds don't support this Playwright call.
  if (browserName === 'chromium') {
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  }

  const dirtyUrl = 'https://example.com/?id=42&utm_source=x&gclid=abc';
  const page = await openPageAndBar(ctx, dirtyUrl);

  await page.keyboard.press('u');
  await new Promise(r => setTimeout(r, 1000));

  expect(await isOverlayClosed(page)).toBe(true);

  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toBe('https://example.com/?id=42');

  await ctx.close();
});

// ─── z: Recently Closed ─────────────────────────────────────────────────────

test('Action z: Recently Closed', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);

  await page.keyboard.press('z');
  await new Promise(r => setTimeout(r, 1000));

  expect(await isOverlayClosed(page)).toBe(true);
  await ctx.close();
});

// ─── q: Close All Duplicates ─────────────────────────────────────────────────

test('Action q: Close All Duplicates', async () => {
  const ctx = await launch();
  const p1 = await ctx.newPage();
  await p1.goto('https://example.com');
  await new Promise(r => setTimeout(r, 500));
  const p2 = await ctx.newPage();
  await p2.goto('https://example.com'); // duplicate
  await new Promise(r => setTimeout(r, 1000));

  const before = ctx.pages().length;
  await p2.keyboard.press(OPEN_SHORTCUT);
  await new Promise(r => setTimeout(r, 800));
  await p2.keyboard.press('q');
  await new Promise(r => setTimeout(r, 1500));

  expect(ctx.pages().length).toBeLessThan(before);
  await ctx.close();
});

// ─── s: Sort by Domain ──────────────────────────────────────────────────────

test('Action s: Sort by Domain', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);

  await page.keyboard.press('s');
  await new Promise(r => setTimeout(r, 1000));

  expect(await isOverlayClosed(page)).toBe(true);
  await ctx.close();
});

// ─── ,: Settings ────────────────────────────────────────────────────────────

test('Action comma: Settings', async () => {
  const ctx = await launch();
  const page = await openPageAndBar(ctx);

  await page.keyboard.press(',');
  await new Promise(r => setTimeout(r, 2000));

  const urls = ctx.pages().map(p => p.url());
  expect(urls.some(u => u.includes('settings'))).toBe(true);
  await ctx.close();
});
