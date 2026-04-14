const ALLOWED_NAVIGATION_SCHEMES = new Set([
  'http:',
  'https:',
  'ftp:',
  'ftps:',
  'mailto:',
]);

const BLOCKED_NAVIGATION_SCHEMES = new Set([
  'javascript:',
  'data:',
  'vbscript:',
  'file:',
  'blob:',
  'about:',
  'chrome:',
  'chrome-extension:',
  'moz-extension:',
  'edge:',
  'brave:',
  'opera:',
  'view-source:',
  'ws:',
  'wss:',
]);

export interface UrlValidationResult {
  ok: boolean;
  reason?: string;
}

export function isNavigableUrl(value: unknown): value is string {
  return validateNavigationUrl(value).ok;
}

export function validateNavigationUrl(value: unknown): UrlValidationResult {
  if (typeof value !== 'string') return { ok: false, reason: 'not a string' };
  if (value.length === 0) return { ok: false, reason: 'empty' };
  if (value.length > 8192) return { ok: false, reason: 'too long' };

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'unparseable' };
  }

  const scheme = parsed.protocol.toLowerCase();
  if (BLOCKED_NAVIGATION_SCHEMES.has(scheme)) {
    return { ok: false, reason: `blocked scheme: ${scheme}` };
  }
  if (!ALLOWED_NAVIGATION_SCHEMES.has(scheme)) {
    return { ok: false, reason: `disallowed scheme: ${scheme}` };
  }
  return { ok: true };
}

export function isSafeFaviconUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.length > 4096) return false;
  try {
    const u = new URL(value);
    const scheme = u.protocol.toLowerCase();
    return scheme === 'http:' || scheme === 'https:' || scheme === 'data:';
  } catch {
    return false;
  }
}
