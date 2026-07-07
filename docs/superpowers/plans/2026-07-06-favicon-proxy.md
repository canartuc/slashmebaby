# Favicon Proxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make command-palette favicons render reliably across pages by re-fetching failed favicons in the background as `data:` URLs, with an inline-SVG globe as the final fallback so the browser broken-image glyph never appears.

**Architecture:** The single `Favicon` component runs a three-stage fallback on one `<img>`: direct load → background-proxied `data:` URL → inline SVG globe. A new background handler fetches favicon bytes (host permissions bypass referrer/hotlink/CORS), converts them to a `data:` URL, and memoises results in an in-memory LRU cache.

**Tech Stack:** WXT + React 18 + TypeScript (strict) + Vitest (jsdom for components, node for background) + Playwright (E2E). Browser APIs via the `chrome` namespace already used across the codebase.

## Global Constraints

- TypeScript strict mode — no `any`, no non-null assertions on untyped values.
- TDD — write the failing test first, run it red, implement, run it green, commit.
- Conventional commits (`feat:`, `test:`, `fix:`, `chore:`).
- All favicon URLs must pass `isSafeFaviconUrl` (http/https/data only) at both the client entry and the background handler — no new scheme surface.
- Preserve existing `Favicon` `<img>` attributes: `referrerPolicy="no-referrer"`, `loading="lazy"`, `decoding="async"`, `alt=""`, `width`/`height`, default className `smb-favicon`.
- New permission: `host_permissions: ['<all_urls>']` in `wxt.config.ts` — nothing broader.
- No disk/IndexedDB cache; in-memory `Map` LRU only. Cap 256 entries, 256 KB per favicon.

---

### Task 1: Message contract for `GET_FAVICON`

**Files:**
- Modify: `src/lib/messaging.ts`
- Test: `src/__tests__/lib/messaging.test.ts`

**Interfaces:**
- Consumes: existing `isObject` helper in `messaging.ts`.
- Produces:
  - `interface GetFaviconRequest { type: 'GET_FAVICON'; payload: { url: string } }`
  - `interface GetFaviconResponse { dataUrl: string | null }`
  - `function isGetFaviconRequest(value: unknown): value is GetFaviconRequest`
  - `GetFaviconRequest` added to the `Message` union.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/lib/messaging.test.ts`. Add `isGetFaviconRequest` to the existing import from `'../../lib/messaging'`, then add this describe block:

```ts
describe('isGetFaviconRequest', () => {
  it('returns true for a valid http GET_FAVICON request', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'https://a.com/f.ico' } })
    ).toBe(true);
  });

  it('returns true for a data: url', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'data:image/png;base64,AAAA' } })
    ).toBe(true);
  });

  it('returns false for the wrong type', () => {
    expect(isGetFaviconRequest({ type: 'SEARCH', payload: { url: 'https://a.com' } })).toBe(false);
  });

  it('returns false when url is missing', () => {
    expect(isGetFaviconRequest({ type: 'GET_FAVICON', payload: {} })).toBe(false);
  });

  it('returns false for a non-string url', () => {
    expect(isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 123 } })).toBe(false);
  });

  it('returns false for a disallowed scheme', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'javascript:alert(1)' } })
    ).toBe(false);
  });

  it('returns false for an over-length url', () => {
    expect(
      isGetFaviconRequest({ type: 'GET_FAVICON', payload: { url: 'https://a.com/' + 'x'.repeat(5000) } })
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGetFaviconRequest(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/lib/messaging.test.ts`
Expected: FAIL — `isGetFaviconRequest is not a function` (import undefined).

- [ ] **Step 3: Write minimal implementation**

In `src/lib/messaging.ts`, add the interfaces in the "Tree View Messages" area (or a new section near the other request types):

```ts
export interface GetFaviconRequest {
  type: 'GET_FAVICON';
  payload: { url: string };
}

export interface GetFaviconResponse {
  dataUrl: string | null;
}
```

Add `GetFaviconRequest` to the `Message` union:

```ts
export type Message =
  | SearchRequest
  | SmartSuggestionsRequest
  | ExecuteActionRequest
  | GetSettingsRequest
  | SwitchTabRequest
  | OpenNewTabRequest
  | NavigateRequest
  | ToggleOverlayCommand
  | GetAllTabsRequest
  | GetBookmarkTreeRequest
  | GetFaviconRequest;
```

Add the guard next to the other type guards:

```ts
export function isGetFaviconRequest(value: unknown): value is GetFaviconRequest {
  if (!isObject(value) || value['type'] !== 'GET_FAVICON') return false;
  const payload = value['payload'];
  if (!isObject(payload)) return false;
  const url = payload['url'];
  if (typeof url !== 'string' || url.length === 0 || url.length > 4096) return false;
  try {
    const scheme = new URL(url).protocol.toLowerCase();
    return scheme === 'http:' || scheme === 'https:' || scheme === 'data:';
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/lib/messaging.test.ts`
Expected: PASS (all `isGetFaviconRequest` cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/messaging.ts src/__tests__/lib/messaging.test.ts
git commit -m "feat: add GET_FAVICON message contract and type guard"
```

---

### Task 2: Background favicon proxy + LRU cache + manifest permission

**Files:**
- Create: `src/entrypoints/background/favicon.ts`
- Modify: `wxt.config.ts`
- Test: `src/__tests__/background/favicon.test.ts` (new)

**Interfaces:**
- Consumes: `isSafeFaviconUrl` from `src/lib/url-safety.ts`; global `fetch` and `btoa` (both available in the MV3 service worker and the Vitest node env).
- Produces: `async function getFaviconDataUrl(url: string, cache: Map<string, string>): Promise<string | null>`.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/background/favicon.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getFaviconDataUrl } from '../../entrypoints/background/favicon';

function mockFetchOnce(opts: {
  ok?: boolean;
  contentType?: string | null;
  bytes?: Uint8Array;
}) {
  const { ok = true, contentType = 'image/png', bytes = new Uint8Array([1, 2, 3, 4]) } = opts;
  return vi.fn().mockResolvedValueOnce({
    ok,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getFaviconDataUrl', () => {
  it('returns a data: url unchanged without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new Map<string, string>();
    const url = 'data:image/png;base64,AAAA';
    expect(await getFaviconDataUrl(url, cache)).toBe(url);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null for an unsafe scheme without fetching', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getFaviconDataUrl('javascript:alert(1)', new Map())).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetches an http favicon and returns a base64 data: url', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ contentType: 'image/png', bytes: new Uint8Array([0, 255]) }));
    const result = await getFaviconDataUrl('https://a.com/f.png', new Map());
    // btoa(String.fromCharCode(0, 255)) === 'AP8='
    expect(result).toBe('data:image/png;base64,AP8=');
  });

  it('caches the result and does not re-fetch on the second call', async () => {
    const fetchSpy = mockFetchOnce({ contentType: 'image/png', bytes: new Uint8Array([1]) });
    vi.stubGlobal('fetch', fetchSpy);
    const cache = new Map<string, string>();
    const first = await getFaviconDataUrl('https://a.com/f.png', cache);
    const second = await getFaviconDataUrl('https://a.com/f.png', cache);
    expect(second).toBe(first);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ ok: false }));
    expect(await getFaviconDataUrl('https://a.com/f.png', new Map())).toBeNull();
  });

  it('returns null for a non-image content-type', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ contentType: 'text/html' }));
    expect(await getFaviconDataUrl('https://a.com/f.png', new Map())).toBeNull();
  });

  it('returns null for an oversize body', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ bytes: new Uint8Array(256 * 1024 + 1) }));
    expect(await getFaviconDataUrl('https://a.com/f.png', new Map())).toBeNull();
  });

  it('returns null when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')));
    expect(await getFaviconDataUrl('https://a.com/f.png', new Map())).toBeNull();
  });

  it('evicts the oldest entry past the cache cap', async () => {
    const cache = new Map<string, string>();
    // Pre-fill to the cap with dummy entries.
    for (let i = 0; i < 256; i++) cache.set(`https://x.com/${i}.png`, `data:image/png;base64,${i}`);
    vi.stubGlobal('fetch', mockFetchOnce({ bytes: new Uint8Array([1]) }));
    await getFaviconDataUrl('https://new.com/f.png', cache);
    expect(cache.size).toBe(256);
    expect(cache.has('https://x.com/0.png')).toBe(false); // oldest evicted
    expect(cache.has('https://new.com/f.png')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/background/favicon.test.ts`
Expected: FAIL — cannot resolve `../../entrypoints/background/favicon` (module does not exist).

- [ ] **Step 3: Write minimal implementation**

Create `src/entrypoints/background/favicon.ts`:

```ts
import { isSafeFaviconUrl } from '../../lib/url-safety';

const MAX_CACHE_ENTRIES = 256;
const MAX_FAVICON_BYTES = 256 * 1024; // 256 KB

/**
 * Fetches a favicon by URL and returns it as a `data:` URL. Runs in the
 * background service worker, whose host permissions bypass the host page's
 * CSP, `no-referrer` hotlink protection, and cross-origin CORS — none of
 * which a content-script `<img>` can escape.
 *
 * Results are memoised in an LRU-ordered Map (insertion order = recency).
 * Returns null on any failure; the caller falls back to a placeholder glyph.
 */
export async function getFaviconDataUrl(
  url: string,
  cache: Map<string, string>,
): Promise<string | null> {
  if (!isSafeFaviconUrl(url)) return null;

  // Already inline — nothing to fetch.
  if (url.startsWith('data:')) return url;

  const cached = cache.get(url);
  if (cached !== undefined) {
    // Refresh recency: re-insert so it becomes the newest entry.
    cache.delete(url);
    cache.set(url, cached);
    return cached;
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;

    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.startsWith('image/')) return null;

    const buffer = await resp.arrayBuffer();
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_FAVICON_BYTES) return null;

    const dataUrl = `data:${contentType};base64,${bytesToBase64(new Uint8Array(buffer))}`;

    cache.set(url, dataUrl);
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return dataUrl;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/background/favicon.test.ts`
Expected: PASS (all 9 cases green).

- [ ] **Step 5: Add the host permission to the manifest**

In `wxt.config.ts`, add `host_permissions` to the `manifest` object, directly after the `permissions` line:

```ts
    permissions: ['tabs', 'bookmarks', 'history', 'storage', 'activeTab', 'sessions', 'commands'],
    host_permissions: ['<all_urls>'],
```

- [ ] **Step 6: Verify the build still type-checks and packs the permission**

Run: `npx tsc --noEmit && npx wxt build`
Expected: build succeeds; `.output/chrome-mv3/manifest.json` contains `"host_permissions": ["<all_urls>"]`.
Verify: `cat .output/chrome-mv3/manifest.json | grep host_permissions`

- [ ] **Step 7: Commit**

```bash
git add src/entrypoints/background/favicon.ts src/__tests__/background/favicon.test.ts wxt.config.ts
git commit -m "feat: background favicon proxy returning data: URLs with LRU cache"
```

---

### Task 3: Wire the proxy into the message router

**Files:**
- Modify: `src/entrypoints/background/index.ts`
- Test: `src/__tests__/background/index.test.ts`

**Interfaces:**
- Consumes: `isGetFaviconRequest` (Task 1), `getFaviconDataUrl` (Task 2).
- Produces: router branch returning `{ dataUrl: string | null }` for a `GET_FAVICON` message; a per-router `Map<string,string>` favicon cache.

- [ ] **Step 1: Write the failing test**

Append to `src/__tests__/background/index.test.ts`, inside the existing `describe('createMessageRouter', ...)` block (which already stubs `chrome` via `makeChromeMock` in `beforeEach`):

```ts
  describe('GET_FAVICON message', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.stubGlobal('chrome', makeChromeMock()); // restore chrome for other tests
    });

    it('returns a data: url for a fetchable favicon', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => new Uint8Array([0, 255]).buffer,
      }));
      const router = await createMessageRouter();
      const res = await router({ type: 'GET_FAVICON', payload: { url: 'https://a.com/f.png' } });
      expect(res).toEqual({ dataUrl: 'data:image/png;base64,AP8=' });
    });

    it('returns { dataUrl: null } when the fetch fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
      const router = await createMessageRouter();
      const res = await router({ type: 'GET_FAVICON', payload: { url: 'https://a.com/f.png' } });
      expect(res).toEqual({ dataUrl: null });
    });
  });
```

Note: `afterEach` is already imported in this file if present; if not, add `afterEach` to the top `import { describe, it, expect, beforeEach, vi } from 'vitest';` line so it reads `import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/background/index.test.ts -t "GET_FAVICON"`
Expected: FAIL — router returns `{ error: 'Unknown message type' }` instead of `{ dataUrl }`.

- [ ] **Step 3: Write minimal implementation**

In `src/entrypoints/background/index.ts`:

1. Add to the imports from `'../../lib/messaging'`: `isGetFaviconRequest`.
2. Add a new import near the other cache imports:

```ts
import { getFaviconDataUrl } from './favicon';
```

3. Inside `createMessageRouter`, declare a cache alongside the other caches (after `const actionRegistry = new ActionRegistry();`):

```ts
  const faviconCache = new Map<string, string>();
```

4. Add the router branch (place it near the other request branches, e.g. right after the `isGetBookmarkTreeRequest` block):

```ts
    if (isGetFaviconRequest(message)) {
      const dataUrl = await getFaviconDataUrl(message.payload.url, faviconCache);
      return { dataUrl };
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/background/index.test.ts`
Expected: PASS (new GET_FAVICON cases green; all existing router tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/entrypoints/background/index.ts src/__tests__/background/index.test.ts
git commit -m "feat: route GET_FAVICON to the background favicon proxy"
```

---

### Task 4: `Favicon` progressive-fallback component

**Files:**
- Modify: `src/components/CommandBar/Favicon.tsx`
- Test: `src/__tests__/components/Favicon.test.tsx`

**Interfaces:**
- Consumes: `isSafeFaviconUrl` (unchanged); `chrome.runtime.sendMessage` returning a `Promise<{ dataUrl: string | null } | undefined>`.
- Produces: same `Favicon` public API (`FaviconProps { src?, size?, className? }`); no exported symbol changes.

- [ ] **Step 1: Write the failing test**

Append these cases to `src/__tests__/components/Favicon.test.tsx`. Add the needed imports at the top of the file: change the react-testing import to `import { render, fireEvent, waitFor } from '@testing-library/react';` and add `import { vi, beforeEach } from 'vitest';` (keep the existing `describe, it, expect` import).

```ts
describe('Favicon fallback chain', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a globe svg (not an img) after the proxied load also fails', async () => {
    // Direct load fails → ask background → returns null → globe.
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({ dataUrl: null });
    const { container } = render(<Favicon src="https://a.com/f.ico" />);
    const img = container.querySelector('img')!;
    fireEvent.error(img);
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
      expect(container.querySelector('img')).toBeNull();
    });
  });

  it('swaps to the proxied data: url when the direct load fails', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      dataUrl: 'data:image/png;base64,AP8=',
    });
    const { container } = render(<Favicon src="https://a.com/f.ico" />);
    fireEvent.error(container.querySelector('img')!);
    await waitFor(() => {
      expect(container.querySelector('img')!.getAttribute('src')).toBe(
        'data:image/png;base64,AP8='
      );
    });
  });

  it('shows the globe if the proxied data: url also errors', async () => {
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({
      dataUrl: 'data:image/png;base64,AP8=',
    });
    const { container } = render(<Favicon src="https://a.com/f.ico" />);
    fireEvent.error(container.querySelector('img')!); // stage 0 → 1
    await waitFor(() =>
      expect(container.querySelector('img')!.getAttribute('src')).toContain('data:')
    );
    fireEvent.error(container.querySelector('img')!); // stage 1 → 2
    await waitFor(() => {
      expect(container.querySelector('svg')).toBeTruthy();
      expect(container.querySelector('img')).toBeNull();
    });
  });

  it('does not message the background on a successful direct load', () => {
    const spy = vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({ dataUrl: null });
    render(<Favicon src="https://a.com/f.ico" />);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/components/Favicon.test.tsx`
Expected: FAIL — no `onError` behaviour; `fireEvent.error` leaves the `<img>` in place, no `<svg>` appears.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/CommandBar/Favicon.tsx` with:

```tsx
import React, { useState, useEffect } from 'react';
import { isSafeFaviconUrl } from '../../lib/url-safety';

export interface FaviconProps {
  src?: string;
  size?: number;
  className?: string;
}

/** Inert placeholder glyph. An SVG element (not an <img>), so the host page's
 *  CSP `img-src` cannot block it and it makes no network request. */
const GlobeGlyph: React.FC<{ size: number; className?: string }> = ({ size, className }) => (
  <svg
    className={className ?? 'smb-favicon'}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
    <path
      d="M1.5 8h13M8 1.5c2.2 2 2.2 11 0 13M8 1.5c-2.2 2-2.2 11 0 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      opacity="0.55"
    />
  </svg>
);

/**
 * Safe favicon renderer with a three-stage fallback:
 *   stage 0 — load the icon URL directly (zero background messages);
 *   stage 1 — on error, ask the background to re-fetch it as a `data:` URL
 *             (bypasses host CSP / no-referrer / CORS) and swap it in;
 *   stage 2 — on a second error (or a null response), show an inline globe.
 *
 * Unsafe or absent icons render nothing, unchanged from before — the globe
 * only appears when a *valid* icon fails to load, so icon-less bookmark and
 * history rows stay blank.
 */
export const Favicon: React.FC<FaviconProps> = ({ src, size = 16, className }) => {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [proxied, setProxied] = useState<string | null>(null);

  // Rows are recycled during navigation; reset when the icon changes so a
  // stale failed stage never sticks to a different tab's row.
  useEffect(() => {
    setStage(0);
    setProxied(null);
  }, [src]);

  if (!isSafeFaviconUrl(src)) return null;
  if (stage === 2) return <GlobeGlyph size={size} className={className} />;

  const handleError = () => {
    if (stage === 0) {
      chrome.runtime
        .sendMessage({ type: 'GET_FAVICON', payload: { url: src } })
        .then((res: { dataUrl?: string | null } | undefined) => {
          if (res && typeof res.dataUrl === 'string') {
            setProxied(res.dataUrl);
            setStage(1);
          } else {
            setStage(2);
          }
        })
        .catch(() => setStage(2));
    } else {
      setStage(2);
    }
  };

  const imgSrc = stage === 1 && proxied ? proxied : src;

  return (
    <img
      className={className ?? 'smb-favicon'}
      src={imgSrc}
      alt=""
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/components/Favicon.test.tsx`
Expected: PASS — new fallback cases green, and the pre-existing cases (renders img for https, renders nothing for `javascript:`/`chrome-extension:`/`file:`/undefined, honours size) still green.

- [ ] **Step 5: Run the full unit suite to catch consumer regressions**

Run: `npx vitest run`
Expected: PASS — `ResultItem`/`TreeItem`/CommandBar tests still green (the `Favicon` public API is unchanged).

- [ ] **Step 6: Commit**

```bash
git add src/components/CommandBar/Favicon.tsx src/__tests__/components/Favicon.test.tsx
git commit -m "feat: progressive favicon fallback (direct → proxied data: → globe)"
```

---

### Task 5: E2E — favicons never render as broken images

**Files:**
- Create: `e2e/favicon.spec.ts`

**Interfaces:**
- Consumes: `launchBrowserWithExtension`, `openPage`, `openCommandBar` from `e2e/helpers.ts`; requires a built extension at `.output/chrome-mv3` (produced by `npm run build` / `wxt build`).
- Produces: no exports; a Playwright assertion that the palette contains no broken `<img class="smb-favicon">`.

- [ ] **Step 1: Write the failing test**

Create `e2e/favicon.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { launchBrowserWithExtension, openPage, openCommandBar } from './helpers';

// A favicon <img> is "broken" once it has finished loading (`complete`) but has
// zero intrinsic size. The fallback chain must ensure no such element survives:
// every icon is either a loaded image or replaced by the globe <svg>.
test('palette favicons never render as broken images', async () => {
  const context = await launchBrowserWithExtension();
  // Open a couple of real pages first so the palette has tabs with favicons.
  await openPage(context, 'https://example.com');
  const page = await openPage(context, 'https://www.wikipedia.org');

  await openCommandBar(page);

  // Give the fallback chain time to run (direct error → proxy round-trip).
  await page.waitForTimeout(1500);

  const brokenCount = await page.evaluate(() => {
    const host = document.getElementById('slashmebaby-root');
    const imgs = Array.from(
      host?.shadowRoot?.querySelectorAll('img.smb-favicon') ?? []
    ) as HTMLImageElement[];
    return imgs.filter((img) => img.complete && img.naturalWidth === 0).length;
  });

  expect(brokenCount).toBe(0);

  await context.close();
});
```

- [ ] **Step 2: Build the extension so the E2E has something to load**

Run: `npx wxt build`
Expected: `.output/chrome-mv3/` exists and `manifest.json` includes `host_permissions`.

- [ ] **Step 3: Run test to verify current behaviour**

Run: `npx playwright test e2e/favicon.spec.ts`
Expected: PASS with the fallback in place. (If it is flaky because a real favicon is slow, raise the `waitForTimeout` to 2500ms — the assertion is about the absence of broken images, which the globe fallback guarantees deterministically once the chain has run.)

Note: this test exercises the deterministic guarantee (no broken `<img>`), not exact icon pixels, so it does not depend on any specific site's favicon being reachable in CI.

- [ ] **Step 4: Commit**

```bash
git add e2e/favicon.spec.ts
git commit -m "test: e2e assert palette favicons never render broken"
```

---

## Final verification

- [ ] Run the full unit suite: `npx vitest run` — all green.
- [ ] Run the E2E suite: `npx playwright test` — all green.
- [ ] Type-check: `npx tsc --noEmit` — no errors.
- [ ] Manual smoke (optional, per CLAUDE.md): after approval, `npm run pack` and copy the zip from `.output/` to `$HOME/Downloads/`, load unpacked in Chrome, open the palette on a strict-CSP site (e.g. GitHub) and confirm tab favicons appear (or show the globe), never the broken glyph.

## Notes

- Firefox: the same `data:`-proxy path works (WebExtensions `fetch` in the background honours `host_permissions`). No Chrome-only APIs used.
- This plan document and the spec live under `docs/`, which is gitignored locally — the plan is not committed, but all **code** commits normally (src/e2e are not ignored).
