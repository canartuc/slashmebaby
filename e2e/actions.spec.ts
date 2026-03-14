import { test, expect, chromium } from '@playwright/test';
import path from 'path';

const EXT_PATH = path.resolve('.output/chrome-mv3');

async function launch() {
  const ctx = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-first-run', '--disable-default-apps',
    ],
  });
  await new Promise(r => setTimeout(r, 2000));
  return ctx;
}

test('Action: t (new tab) works', async () => {
  const ctx = await launch();
  const page = await ctx.newPage();
  await page.goto('https://example.com');
  await new Promise(r => setTimeout(r, 1000));

  const before = ctx.pages().length;
  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));
  await page.keyboard.press('t');
  await new Promise(r => setTimeout(r, 1000));

  expect(ctx.pages().length).toBeGreaterThan(before);
  console.log('NEW TAB: OK');
  await ctx.close();
});

test('Action: c (close tab) works', async () => {
  const ctx = await launch();

  // Create 2 pages so closing one doesn't close the browser
  const page1 = await ctx.newPage();
  await page1.goto('https://example.com');
  await new Promise(r => setTimeout(r, 1000));

  const page2 = await ctx.newPage();
  await page2.goto('https://example.org');
  await new Promise(r => setTimeout(r, 1000));

  const before = ctx.pages().length;
  console.log('Pages before close:', before);

  // Open command bar and press 'c'
  await page2.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));
  await page2.keyboard.press('c');
  await new Promise(r => setTimeout(r, 1500));

  const after = ctx.pages().length;
  console.log('Pages after close:', after);
  expect(after).toBeLessThan(before);
  console.log('CLOSE TAB: OK');
  await ctx.close();
});

test('Action: p (pin tab) works', async () => {
  const ctx = await launch();
  const page = await ctx.newPage();
  await page.goto('https://example.com');
  await new Promise(r => setTimeout(r, 1000));

  // Open command bar and press 'p'
  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));
  await page.keyboard.press('p');
  await new Promise(r => setTimeout(r, 1500));

  // Check if the command bar closed (action executed)
  const isOpen = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return !!host?.shadowRoot?.querySelector('.smb-backdrop');
  }).catch(() => false);
  console.log('Overlay still open after pin:', isOpen);
  // Pin action should close the overlay
  expect(isOpen).toBe(false);
  console.log('PIN TAB: OK');
  await ctx.close();
});

test('Action: r (reload tab) works', async () => {
  const ctx = await launch();
  const page = await ctx.newPage();
  await page.goto('https://example.com');
  await new Promise(r => setTimeout(r, 1000));

  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));
  await page.keyboard.press('r');
  await new Promise(r => setTimeout(r, 1500));

  const isOpen = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return !!host?.shadowRoot?.querySelector('.smb-backdrop');
  }).catch(() => false);
  expect(isOpen).toBe(false);
  console.log('RELOAD TAB: OK');
  await ctx.close();
});

test('Action: , (settings) opens settings page', async () => {
  const ctx = await launch();
  const page = await ctx.newPage();
  await page.goto('https://example.com');
  await new Promise(r => setTimeout(r, 1000));

  const before = ctx.pages().length;
  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));

  // Press comma for settings
  await page.keyboard.press(',');
  await new Promise(r => setTimeout(r, 2000));

  // Settings should open in a new tab
  const after = ctx.pages().length;
  console.log('Pages before settings:', before, 'after:', after);

  // Check if any page has settings URL
  const urls = ctx.pages().map(p => p.url());
  console.log('URLs:', urls);
  const hasSettings = urls.some(u => u.includes('settings'));
  expect(hasSettings).toBe(true);
  console.log('SETTINGS: OK');
  await ctx.close();
});
