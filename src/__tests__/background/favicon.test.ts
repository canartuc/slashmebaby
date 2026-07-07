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

  it('rejects an oversize favicon by declared content-length without buffering', async () => {
    const arrayBufferSpy = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (k: string) => {
            const key = k.toLowerCase();
            if (key === 'content-type') return 'image/png';
            if (key === 'content-length') return String(256 * 1024 + 1);
            return null;
          },
        },
        arrayBuffer: arrayBufferSpy,
      })
    );
    expect(await getFaviconDataUrl('https://a.com/big.png', new Map())).toBeNull();
    expect(arrayBufferSpy).not.toHaveBeenCalled();
  });

  it('accepts an uppercase image content-type', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ contentType: 'IMAGE/PNG', bytes: new Uint8Array([0, 255]) }));
    const result = await getFaviconDataUrl('https://a.com/f.png', new Map());
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

  it('fetches with redirect: "error" so a public URL cannot 302 into a private host (SSRF)', async () => {
    // isSafeFaviconUrl only vets the *initial* URL string. If fetch followed
    // redirects, a page-controlled favicon on a public host could 302 to
    // http://127.0.0.1/... or http://169.254.169.254/... and the background
    // worker (with <all_urls>) would probe it. redirect: 'error' makes any
    // redirect reject the fetch outright.
    const fetchSpy = mockFetchOnce({ contentType: 'image/png', bytes: new Uint8Array([1]) });
    vi.stubGlobal('fetch', fetchSpy);
    await getFaviconDataUrl('https://a.com/f.png', new Map());
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://a.com/f.png',
      expect.objectContaining({ credentials: 'omit', redirect: 'error' })
    );
  });

  it('returns null when the server redirects (redirect: "error" rejects)', async () => {
    // Native fetch with redirect: 'error' rejects with a TypeError on any
    // 3xx response — simulate that contract here.
    const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.redirect === 'error') {
        return Promise.reject(new TypeError('Failed to fetch: redirected'));
      }
      // A permissive fetch (the vulnerable behavior) would happily follow the
      // redirect to a private host and return an image from it.
      return Promise.resolve({
        ok: true,
        url: 'http://127.0.0.1/steal.png',
        headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'image/png' : null) },
        arrayBuffer: async () => new Uint8Array([1]).buffer,
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
    expect(await getFaviconDataUrl('https://a.com/redirects.png', new Map())).toBeNull();
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
