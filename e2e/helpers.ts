import { chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';

const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

export async function launchBrowserWithExtension(): Promise<BrowserContext> {
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
    ],
  });
  await new Promise(r => setTimeout(r, 2000));
  return context;
}

export async function openPage(context: BrowserContext, url = 'https://example.com'): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 1000));
  return page;
}

export async function openCommandBar(page: Page): Promise<void> {
  await page.keyboard.press('Meta+Shift+Space');
  await new Promise(r => setTimeout(r, 800));
}

export async function isOverlayOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return !!host?.shadowRoot?.querySelector('.smb-backdrop');
  });
}

export async function getSelectedItemTitle(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const selected = host?.shadowRoot?.querySelector('.smb-result-item--selected');
    return selected?.querySelector('.smb-title')?.textContent || '';
  });
}

export async function getResultCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return host?.shadowRoot?.querySelectorAll('.smb-result-item').length || 0;
  });
}

export async function getGroupHeaders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const headers = host?.shadowRoot?.querySelectorAll('.smb-group-header');
    return Array.from(headers || []).map(h => h.textContent || '');
  });
}

export async function typeInCommandBar(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement;
    if (input) {
      input.value = t;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, text);
  await new Promise(r => setTimeout(r, 500));
}

export async function getInputValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement;
    return input?.value || '';
  });
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const bgPages = context.serviceWorkers();
  if (bgPages.length > 0) {
    const url = bgPages[0].url();
    const match = url.match(/chrome-extension:\/\/([^/]+)/);
    if (match) return match[1];
  }
  // Fallback: wait for service worker
  await new Promise(r => setTimeout(r, 2000));
  const workers = context.serviceWorkers();
  for (const w of workers) {
    const match = w.url().match(/chrome-extension:\/\/([^/]+)/);
    if (match) return match[1];
  }
  return '';
}
