import { chromium, type BrowserContext, type Page } from '@playwright/test';
import path from 'path';
import { isInjectableUrl } from '../src/lib/url-safety';
import { DEFAULT_SETTINGS } from '../src/lib/messaging';

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
  // Wait until the extension's MV3 service worker is registered instead of
  // sleeping a fixed amount — its message listeners attach synchronously.
  // The catch covers the race where the worker registers between the length
  // check and waitForEvent; the recheck below turns a genuine failure into
  // an immediate, accurate error instead of downstream timeouts.
  if (context.serviceWorkers().length === 0) {
    await context.waitForEvent('serviceworker', { timeout: 10000 }).catch(() => {});
  }
  if (context.serviceWorkers().length === 0) {
    throw new Error('Extension service worker did not register — is .output/chrome-mv3 built?');
  }
  return context;
}

export async function openPage(context: BrowserContext, url = 'https://example.com'): Promise<Page> {
  const page = await context.newPage();
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  // The content script appends #slashmebaby-root and attaches its keydown
  // listener in the same synchronous block at document_idle, so the host's
  // presence means the palette is ready. Extension/chrome pages never get
  // the content script — skip the wait there.
  if (isInjectableUrl(url)) {
    // Let a timeout propagate: a missing host means the content script did
    // not inject, and every palette interaction after this would fail with
    // misleading errors.
    await page.waitForFunction(
      () => !!document.getElementById('slashmebaby-root'),
      undefined,
      { timeout: 10000 },
    );
  }
  return page;
}

export const OPEN_SHORTCUT = process.platform === 'darwin'
  ? 'Meta+Shift+Space'
  : 'Control+Shift+Space';

export async function openCommandBar(page: Page): Promise<void> {
  await page.keyboard.press(OPEN_SHORTCUT);
  // Poll until the overlay backdrop exists instead of a fixed 800ms sleep.
  // A timeout propagates: it means the palette never opened (or the shortcut
  // toggled an already-open palette closed), which the caller should see as
  // the root cause rather than a later assertion mismatch.
  await page.waitForFunction(
    () => {
      const host = document.getElementById('slashmebaby-root');
      return !!host?.shadowRoot?.querySelector('.smb-backdrop');
    },
    undefined,
    { timeout: 5000 },
  );
}

export async function isOverlayOpen(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return !!host?.shadowRoot?.querySelector('.smb-backdrop');
  });
}

export async function getSelectedItemTitle(page: Page): Promise<string> {
  return page.evaluate(() => {
    // Palette root: the overlay's shadow root, or the popup's document.
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    const selected =
      root.querySelector('.smb-tree-item--selected') ||
      root.querySelector('.smb-result-item--selected');
    return selected?.querySelector('.smb-title')?.textContent || '';
  });
}

/** Input state of the palette on either surface (overlay shadow or popup document). */
export async function getPaletteInputState(
  page: Page
): Promise<{ readOnly: boolean; placeholder: string; value: string }> {
  return page.evaluate(() => {
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    const input = root.querySelector('.smb-input') as HTMLInputElement | null;
    return {
      readOnly: input?.readOnly ?? false,
      placeholder: input?.placeholder ?? '',
      value: input?.value ?? '',
    };
  });
}

/**
 * The section header text the selected tree item renders under, or ''.
 * Headers and tree items are siblings under .smb-results (TreeView renders
 * them via Fragments), so walking previous siblings finds the nearest one.
 */
export async function getSelectedItemSection(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    let el: Element | null | undefined =
      host?.shadowRoot?.querySelector('.smb-tree-item--selected');
    while (el) {
      el = el.previousElementSibling;
      if (el?.classList.contains('smb-group-header')) return el.textContent ?? '';
    }
    return '';
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
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    // Check for action dividers (new UI) or group headers (old UI)
    const headers = root.querySelectorAll('.smb-group-header, .smb-action-divider');
    return Array.from(headers).map(h => h.textContent || '');
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
  // Let React commit and the browser paint the filtered results: two animation
  // frames flush the update scheduled by the input event, plus a short settle.
  // Bounded by a race because rAF never fires on hidden/occluded pages, which
  // would otherwise hang this evaluate until the overall test timeout.
  await Promise.race([
    page.evaluate(
      () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
    ),
    new Promise(r => setTimeout(r, 250)),
  ]);
  await new Promise(r => setTimeout(r, 100));
}

export async function getInputValue(page: Page): Promise<string> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const input = host?.shadowRoot?.querySelector('.smb-input') as HTMLInputElement;
    return input?.value || '';
  });
}

export async function getExtensionId(context: BrowserContext): Promise<string> {
  const sw = await getServiceWorker(context).catch(() => null);
  const match = sw?.url().match(/chrome-extension:\/\/([^/]+)/);
  return match?.[1] ?? '';
}

/**
 * Seed a handful of bookmarks into the fresh profile via the extension's
 * service worker. Tests that exercise tree-view / search need real data,
 * and launchPersistentContext('') starts from an empty profile.
 */
export async function seedBookmarks(context: BrowserContext): Promise<void> {
  // Historic silent-return semantics: seeding is best-effort.
  const sw = await getServiceWorker(context).catch(() => null);
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

// ─── Shared service-worker access ────────────────────────────────────────────

export async function getServiceWorker(context: BrowserContext) {
  const deadline = Date.now() + 5000;
  let sw = context.serviceWorkers()[0];
  while (!sw && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 200));
    sw = context.serviceWorkers()[0];
  }
  if (!sw) throw new Error('extension service worker not available');
  return sw;
}

// ─── Settings ────────────────────────────────────────────────────────────────

/**
 * Read-merge-write of the persisted settings object. Merging matters: the
 * content script re-reads `settings.shortcut` from every onChanged event,
 * so a partial write that drops it would break the activation shortcut.
 */
export async function setSetting(
  context: BrowserContext,
  partial: Record<string, unknown>
): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(
    async (args: { p: Record<string, unknown>; defaultSources: Record<string, unknown> }) => {
      const { p, defaultSources } = args;
      const current = await new Promise<Record<string, unknown>>((resolve) =>
        chrome.storage.sync.get('settings', (r) => resolve((r.settings as Record<string, unknown>) ?? {}))
      );
      const next: Record<string, unknown> = { ...current, ...p };
      if (current.searchSources || p.searchSources) {
        // Anchor on the production default shape: on a fresh profile the
        // stored settings object is empty, and a partial searchSources
        // write would otherwise drop the missing sources entirely.
        next.searchSources = {
          ...defaultSources,
          ...(current.searchSources as Record<string, unknown>),
          ...(p.searchSources as Record<string, unknown>),
        };
      }
      await new Promise<void>((resolve) =>
        chrome.storage.sync.set({ settings: next }, () => resolve())
      );
    },
    { p: partial, defaultSources: { ...DEFAULT_SETTINGS.searchSources } }
  );
}

// ─── Seeding ─────────────────────────────────────────────────────────────────

export async function seedManyBookmarks(context: BrowserContext, count: number): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async (n: number) => {
    type CreateArg = { parentId?: string; title?: string; url?: string };
    const create = (node: CreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> =>
      new Promise(r => chrome.bookmarks.create(node, r));
    for (let i = 1; i <= n; i++) {
      const nn = String(i).padStart(2, '0');
      await create({ parentId: '1', title: `Seed ${nn}`, url: `https://example.com/seed-${nn}` });
    }
  }, count);
  await new Promise(r => setTimeout(r, 300));
}

export async function seedNestedBookmarks(context: BrowserContext): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async () => {
    type CreateArg = { parentId?: string; title?: string; url?: string };
    const create = (node: CreateArg): Promise<chrome.bookmarks.BookmarkTreeNode> =>
      new Promise(r => chrome.bookmarks.create(node, r));
    const outer = await create({ parentId: '1', title: 'E2E Seeds' });
    const inner = await create({ parentId: outer.id, title: 'Inner' });
    await create({ parentId: inner.id, title: 'Deep One', url: 'https://example.com/deep-1' });
    await create({ parentId: inner.id, title: 'Deep Two', url: 'https://example.com/deep-2' });
    await create({ parentId: outer.id, title: 'Shallow Leaf', url: 'https://example.com/shallow' });
  });
  await new Promise(r => setTimeout(r, 300));
}

export async function seedDiacriticBookmark(context: BrowserContext): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async () => {
    await new Promise(r =>
      chrome.bookmarks.create(
        { parentId: '1', title: 'Sözcü Gazetesi', url: 'https://www.sozcu.com.tr/' },
        r
      )
    );
  });
  await new Promise(r => setTimeout(r, 300));
}

/**
 * Puts titled pages into browser history by really visiting them.
 * chrome.history.addUrl can't set a title and untitled entries are dropped
 * by the cache; real visits emit onVisited, which the history cache
 * subscribes to (debounced ~500ms). Only 200 responses count — Chrome
 * does not record 404 navigations in history at all.
 */
export async function seedHistory(context: BrowserContext, urls: string[]): Promise<void> {
  for (const url of urls) {
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded');
    await page.close();
  }
  // Let the debounced cache refresh run.
  await new Promise(r => setTimeout(r, 1000));
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

export async function getTabs(
  context: BrowserContext
): Promise<Array<{ url: string; pinned: boolean; active: boolean; windowId: number }>> {
  const sw = await getServiceWorker(context);
  return sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.map(t => ({
      url: t.url ?? '',
      pinned: t.pinned,
      active: t.active,
      windowId: t.windowId,
      discarded: t.discarded,
      status: t.status ?? '',
    }));
  });
}

export async function getActiveTabUrlViaSw(context: BrowserContext): Promise<string> {
  const sw = await getServiceWorker(context);
  return sw.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab?.url ?? '';
  });
}

/**
 * Discards (hibernates) the tab matching the URL substring. Chrome may
 * REPLACE the tab with a new id and detaches any Playwright Page — always
 * re-find by URL afterwards, never cache ids across a discard. Chrome
 * refuses to discard the active or an audible tab (hence the driver-page
 * pattern in callers).
 */
export async function discardTab(context: BrowserContext, urlSubstring: string): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async (part: string) => {
    const tabs = await chrome.tabs.query({});
    const target = tabs.find(t => (t.url ?? '').includes(part));
    if (target?.id === undefined) throw new Error(`no tab matching ${part} to discard`);
    await chrome.tabs.discard(target.id);
    const deadline = Date.now() + 5000;
    for (;;) {
      const fresh = await chrome.tabs.query({});
      const found = fresh.find(t => (t.url ?? '').includes(part));
      if (found?.discarded === true) return;
      if (Date.now() > deadline) {
        throw new Error(
          `tab matching ${part} did not discard (active or audible tabs refuse discard)`
        );
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }, urlSubstring);
}

/** Titles of palette rows (grid or tree) carrying the sleep badge. */
export async function getSleepBadgedTitles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    const titles: string[] = [];
    for (const row of Array.from(root.querySelectorAll('.smb-tab-col-item'))) {
      if (row.querySelector('.smb-sleep-badge')) {
        titles.push(row.querySelector('.smb-tab-col-title')?.textContent ?? '');
      }
    }
    for (const row of Array.from(root.querySelectorAll('.smb-tree-item'))) {
      if (row.querySelector('.smb-sleep-badge')) {
        titles.push(row.querySelector('.smb-title')?.textContent ?? '');
      }
    }
    return titles;
  });
}

export async function pinTab(context: BrowserContext, urlSubstring: string): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async (part: string) => {
    const tabs = await chrome.tabs.query({});
    const target = tabs.find(t => (t.url ?? '').includes(part));
    if (target?.id === undefined) throw new Error(`no tab matching ${part}`);
    await chrome.tabs.update(target.id, { pinned: true });
  }, urlSubstring);
  await new Promise(r => setTimeout(r, 300));
}

export async function createTabGroup(
  context: BrowserContext,
  options: { title: string; urlSubstrings: string[] }
): Promise<void> {
  const sw = await getServiceWorker(context);
  await sw.evaluate(async (opts: { title: string; urlSubstrings: string[] }) => {
    const tabs = await chrome.tabs.query({});
    const ids = tabs
      .filter(t => opts.urlSubstrings.some(part => (t.url ?? '').includes(part)))
      .map(t => t.id)
      .filter((id): id is number => id !== undefined);
    if (ids.length === 0) throw new Error('no tabs matched for grouping');
    const groupId = await chrome.tabs.group({ tabIds: ids as [number, ...number[]] });
    await chrome.tabGroups.update(groupId, { title: opts.title });
    // Wait until the group is queryable under its title.
    const deadline = Date.now() + 5000;
    for (;;) {
      const groups = await chrome.tabGroups.query({ title: opts.title });
      if (groups.length > 0) return;
      if (Date.now() > deadline) throw new Error('tab group not queryable');
      await new Promise(r => setTimeout(r, 100));
    }
  }, options);
  await new Promise(r => setTimeout(r, 300));
}

// ─── Overlay readers ─────────────────────────────────────────────────────────

export interface SectionedResults {
  header: string;
  items: Array<{ title: string; selected: boolean; label: string }>;
}

/** DOM-order sections (headers + tree rows) inside the overlay results. */
export async function getSectionedResults(page: Page): Promise<SectionedResults[]> {
  return page.evaluate(() => {
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    const results = root.querySelector('.smb-results');
    if (!results) return [];
    const sections: Array<{ header: string; items: Array<{ title: string; selected: boolean; label: string }> }> = [];
    for (const child of Array.from(results.children)) {
      if (child.classList.contains('smb-group-header')) {
        sections.push({ header: child.textContent ?? '', items: [] });
      } else if (child.classList.contains('smb-tree-item')) {
        const current = sections[sections.length - 1];
        if (!current) continue;
        current.items.push({
          title: child.querySelector('.smb-title')?.textContent ?? '',
          selected: child.classList.contains('smb-tree-item--selected'),
          label: child.querySelector('.smb-label-badge')?.textContent ?? '',
        });
      }
    }
    return sections;
  });
}

export async function getOverlayTheme(page: Page): Promise<{ host: string; container: string }> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    return {
      host: host?.getAttribute('data-theme') ?? '',
      container:
        host?.shadowRoot?.querySelector('.smb-container')?.getAttribute('data-theme') ?? '',
    };
  });
}

export async function getContainerBox(
  page: Page
): Promise<{ top: number; bottom: number; innerHeight: number; className: string } | null> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const el = host?.shadowRoot?.querySelector('.smb-container');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      innerHeight: window.innerHeight,
      className: el.className,
    };
  });
}

export async function getFaviconCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const sr = host?.shadowRoot;
    if (!sr) return 0;
    return sr.querySelectorAll('.smb-favicon, .smb-pinned-icon').length;
  });
}

export async function getTabGridLabelForTitle(page: Page, title: string): Promise<string> {
  return page.evaluate((t: string) => {
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    const items = root.querySelectorAll('.smb-tab-col-item');
    for (const item of Array.from(items)) {
      if ((item.querySelector('.smb-tab-col-title')?.textContent ?? '').includes(t)) {
        return item.querySelector('.smb-tab-col-label')?.textContent ?? '';
      }
    }
    return '';
  }, title);
}

/** First two-character jump label in the tree rows plus its row title. */
export async function getFirstTwoCharTreeLabel(
  page: Page
): Promise<{ label: string; title: string } | null> {
  return page.evaluate(() => {
    const root: ParentNode =
      document.getElementById('slashmebaby-root')?.shadowRoot ?? document;
    const rows = root.querySelectorAll('.smb-tree-item');
    for (const row of Array.from(rows)) {
      const label = row.querySelector('.smb-label-badge')?.textContent ?? '';
      if (label.length === 2) {
        return { label, title: row.querySelector('.smb-title')?.textContent ?? '' };
      }
    }
    return null;
  });
}

// ─── Popup page ──────────────────────────────────────────────────────────────

export async function openPopupPage(context: BrowserContext): Promise<Page> {
  const id = await getExtensionId(context);
  const page = await context.newPage();
  await page.goto(`chrome-extension://${id}/popup.html`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(
    () => !!document.querySelector('.smb-container--popup'),
    undefined,
    { timeout: 10000 }
  );
  return page;
}
