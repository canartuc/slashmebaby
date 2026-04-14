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

export const OPEN_SHORTCUT = process.platform === 'darwin'
  ? 'Meta+Shift+Space'
  : 'Control+Shift+Space';

export async function openCommandBar(page: Page): Promise<void> {
  await page.keyboard.press(OPEN_SHORTCUT);
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
    // Try new tree view selector first, fall back to old result item selector
    const selected = host?.shadowRoot?.querySelector('.smb-tree-item--selected')
      || host?.shadowRoot?.querySelector('.smb-result-item--selected');
    return selected?.querySelector('.smb-title')?.textContent || '';
  });
}

export async function getResultCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const sr = host?.shadowRoot;
    if (!sr) return 0;
    // Sum all user-facing result types: tab grid, bookmark tree, legacy results.
    const tabs = sr.querySelectorAll('.smb-tab-col-item').length;
    const tree = sr.querySelectorAll('.smb-tree-item').length;
    const legacy = sr.querySelectorAll('.smb-result-item').length;
    return tabs + tree + legacy;
  });
}

export async function getGroupHeaders(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    // Check for action dividers (new UI) or group headers (old UI)
    const headers = host?.shadowRoot?.querySelectorAll('.smb-group-header, .smb-action-divider');
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

/**
 * Seed a handful of bookmarks into the fresh profile via the extension's
 * service worker. Tests that exercise tree-view / search need real data,
 * and launchPersistentContext('') starts from an empty profile.
 */
export async function seedBookmarks(context: BrowserContext): Promise<void> {
  // Wait for at least one service worker to be registered.
  const deadline = Date.now() + 5000;
  let sw = context.serviceWorkers()[0];
  while (!sw && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
    sw = context.serviceWorkers()[0];
  }
  if (!sw) return;

  await sw.evaluate(async () => {
    type CreateArg = { parentId?: string; title?: string; url?: string; index?: number };
    const create = (node: CreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> =>
      new Promise(r => chrome.bookmarks.create(node, r));

    const bar = await create({ parentId: '1', title: 'E2E Seeds' });
    await create({ parentId: bar.id, title: 'Example Site', url: 'https://example.com' });
    await create({ parentId: bar.id, title: 'Example Org', url: 'https://example.org' });
    await create({ parentId: bar.id, title: 'Mozilla Developer', url: 'https://developer.mozilla.org' });
  });
  await new Promise(r => setTimeout(r, 300));
}
