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
