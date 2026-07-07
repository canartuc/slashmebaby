# Favicon Proxy — Design Spec

**Date:** 2026-07-06
**Status:** Approved (design), pending implementation plan
**Topic:** Reliable favicon rendering in the command palette

## Problem

When the command palette is opened, favicons **sometimes** fail to render and the
browser's broken-image glyph appears instead (see pinned + open-tab rows in the
reported screenshot).

### Root cause

The overlay renders inside a Shadow DOM that is attached to the **host page's
document** (`src/entrypoints/content/index.tsx:51`). Every favicon is an `<img>`
rendered by the single `Favicon` component
(`src/components/CommandBar/Favicon.tsx`), consumed by both `ResultItem.tsx:54`
and `TreeItem.tsx:74`. Because the `<img>` lives in the host document, its
resource load is governed by **that page's Content-Security-Policy `img-src`**.

Consequences:

1. **Host-page CSP (`img-src`)** — a strict page (`img-src 'self'`) blocks
   favicons served from other origins. This is why icons appear on some pages and
   not others: the outcome depends on whichever page the palette was opened on.
   This is the user's reported "sometimes".
2. **`no-referrer` + hotlink protection** — `Favicon.tsx:31` forces
   `referrerPolicy="no-referrer"` (privacy). Some favicon hosts return 403 when no
   referrer is present.
3. **Cross-origin / CORS** — favicon hosts do not send CORS headers.
4. **No `onError` fallback** — a failed load falls through to the browser's
   default broken-image glyph (the ugly icon seen in the screenshot) rather than a
   clean placeholder.

Only tabs currently carry an icon: `TabCache` sets `icon = tab.favIconUrl`
(`src/entrypoints/background/tabs.ts:17`). Bookmarks/history items have no icon
and already render nothing (the security gate returns `null`).

## Goals

- Palette favicons render reliably across pages.
- The browser broken-image glyph never appears — failures degrade to a clean,
  CSP-immune placeholder.
- Cross-browser (Chrome + Firefox).
- No new disk storage; minimal new permission surface.

## Non-goals (YAGNI)

- No disk/IndexedDB favicon cache — in-memory LRU only.
- No prefetch or warmup.
- No favicon size negotiation.
- No Chrome `_favicon` API path (rejected — see Alternatives).
- No iframe overlay (Layer 2) — deferred; not needed for real-world pages.

## Approach

A three-stage progressive fallback on the single favicon `<img>`, backed by a
background proxy that re-fetches favicon bytes (bypassing referrer/hotlink/CORS)
and returns them as `data:` URLs. `data:` is the most widely-allowed `img-src`
scheme, so it recovers icons on the large majority of strict-CSP pages. Anything
still blocked falls to an inline SVG globe, which is not subject to `img-src`.

### Fallback chain (client)

```
stage 0: <img src={originalIcon}>          // try direct load, zero messages
  onError ─▶ stage 1
stage 1: sendMessage GET_FAVICON → data:   // swap src to proxied data: URL
  onError, or null response ─▶ stage 2
stage 2: inline <svg> globe                // CSP-immune, no network
```

Rationale for **lazy on-error** (rather than always proxying): pages that already
allow the direct load send zero messages, and `onError` swaps the source before a
broken glyph settles, so there is no visible broken flash. On a strict-CSP page
that also forbids `data:`, stage 1's `data:` URL is blocked by the same CSP and
the row falls to the globe — the expected and acceptable floor.

## Components

### 1. `src/components/CommandBar/Favicon.tsx` — progressive fallback (modified)

- Introduce `useState` for the current stage (`0 | 1 | 2`) and the resolved `src`.
- Reset stage to `0` whenever the `src` prop changes (rows are recycled during
  navigation; a stale failed stage must not stick).
- Keep the existing `isSafeFaviconUrl(src)` security gate at entry — if the
  incoming icon is unsafe or absent, render **nothing** (`null`), unchanged from
  today. The globe appears only after a *valid* icon fails to load, so
  bookmark/history rows (which never carry an icon) stay blank rather than gaining
  a globe on every row.
- Stage 0 `<img onError>` advances to stage 1 and dispatches `GET_FAVICON`.
- Stage 1 renders `<img src={dataUrl} onError>`; failure (or a `null` response)
  advances to stage 2.
- Stage 2 renders an inline `<svg>` globe — an SVG **element**, not an `<img>`,
  so the page `img-src` cannot block it.
- Preserve current attributes: `referrerPolicy="no-referrer"`, `loading="lazy"`,
  `decoding="async"`, `width`/`height`, `alt=""`, className default.

### 2. `src/entrypoints/background/favicon.ts` — proxy + cache (new file)

- Export a handler for `GET_FAVICON { url }` returning `{ dataUrl: string | null }`.
- If `url` is already a `data:` URL, return it unchanged (no fetch).
- Reject anything not http(s)/data via `isSafeFaviconUrl` (reuse
  `src/lib/url-safety.ts`).
- Fetch: `fetch(url)`, verify response `content-type` starts with `image/`,
  enforce a byte cap (~256 KB), convert the blob to a base64 `data:` URL.
- **LRU cache**: `Map<string, string>` keyed by the request URL, capped at 256
  entries, evicting the oldest on overflow (Map insertion order). The MV3 service
  worker may be torn down; the cache simply rewarms on next use.
- Any failure (network, non-image content-type, oversize, parse) resolves to
  `{ dataUrl: null }`. The handler never throws/rejects.

### 3. `src/lib/messaging.ts` — message contract (modified)

- Add `GetFaviconRequest { type: 'GET_FAVICON'; payload: { url: string } }`.
- Add `GetFaviconResponse { dataUrl: string | null }`.
- Add `isGetFaviconRequest` type guard: `type === 'GET_FAVICON'`, `payload.url`
  is a string, scheme is http/https/data, length ≤ 4096.
- Add `GetFaviconRequest` to the `Message` union.

### 4. `src/entrypoints/background/index.ts` — router wiring (modified)

- Import `isGetFaviconRequest` and the new handler; add a branch in the router
  that delegates to `favicon.ts` when the guard matches.

### 5. `wxt.config.ts` — manifest (modified)

- Add `host_permissions: ['<all_urls>']` (required so the background `fetch` can
  read cross-origin favicon bytes rather than an opaque response).
- Rationale for acceptable cost: the extension already declares a content script
  matching `<all_urls>` and the `tabs` permission, so the install prompt already
  warns about access to all sites; this addition does not materially change it.

## Data flow

```
Favicon <img> load fails
  → content: chrome.runtime.sendMessage({ type: 'GET_FAVICON', payload: { url } })
  → background router: isGetFaviconRequest → favicon.ts handler
      → cache hit? return data: URL
      → else fetch → validate → blob → data: URL → cache → return
  → content: <img src = data: URL>   (or globe if dataUrl === null / still blocked)
```

## Error handling

- Every failure path terminates at the inline SVG globe.
- The background handler always resolves; it never rejects. A `null` `dataUrl` is
  a normal, expected result.
- Security gates are preserved: `isSafeFaviconUrl` at the client entry and again
  in the background handler; only http/https/data schemes are ever fetched or
  rendered.

## Testing (TDD — write failing test first)

- `src/__tests__/components/Favicon.test.tsx`
  - renders `<img>` for a valid src (stage 0);
  - advances to the proxied `data:` src on stage-0 `onError`;
  - renders the globe when both stages fail;
  - resets to stage 0 when the `src` prop changes.
- `src/__tests__/lib/messaging.test.ts`
  - `isGetFaviconRequest` accepts a valid request; rejects wrong type, missing
    url, non-string url, disallowed scheme, and over-length url.
- `src/__tests__/background/favicon.test.ts` (new)
  - `data:` passthrough (no fetch);
  - http URL → `data:` URL (mocked `fetch`);
  - `null` on non-image content-type, oversize body, and fetch rejection;
  - LRU eviction past the cap.
- E2E (Playwright)
  - open the palette on a strict-CSP fixture page; assert every favicon slot
    contains either a `data:` `<img>` or the globe SVG — never a broken image.

## Coverage after implementation

| Failure cause | Recovered by |
| --- | --- |
| Broken-glyph cosmetics | Stage 2 globe |
| `no-referrer` hotlink 403 | Stage 1 proxy |
| Cross-origin / CORS | Stage 1 proxy |
| Host CSP (page allows `data:`) | Stage 1 proxy |
| Host CSP (blocks `data:` too) | Stage 2 globe |
| Missing `favIconUrl` | Renders nothing (blank slot), unchanged |

## Alternatives considered

- **Chrome `_favicon` API** (`favicon` permission, no host permissions):
  rejected. Chrome-only (Firefox has no equivalent), and the resulting
  `chrome-extension://` image is still subject to the host page's `img-src`, so it
  does not fix the core "sometimes" symptom.
- **Iframe overlay** (extension-origin document with its own CSP): the only 100%
  CSP escape, but a large architectural change away from the project's Shadow-DOM
  isolation. Deferred; stages 0–1 cover effectively all real pages, with the globe
  as the floor.
