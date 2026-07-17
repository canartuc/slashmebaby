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

// ─── Content-script injectability ──────────────────────────────────────────
// Where the palette overlay can exist. The content script matches <all_urls>
// but self-excludes everything except these schemes; the background's per-tab
// action routing and the e2e helpers must agree with it, so all three share
// this predicate.

const INJECTABLE_SCHEMES = new Set(['http:', 'https:', 'file:']);

// Hosts where browsers block content scripts by policy even though the
// scheme is https. Compared by exact hostname, never by suffix.
const CONTENT_SCRIPT_BLOCKED_HOSTS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'addons.mozilla.org',
  'accounts.firefox.com',
]);

export function isInjectableUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return INJECTABLE_SCHEMES.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}

export function isContentScriptBlockedUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  try {
    const parsed = new URL(value);
    return CONTENT_SCRIPT_BLOCKED_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

// ─── SSRF guard for favicon fetches ────────────────────────────────────────
// The background worker fetches favicon URLs supplied by page-controlled data,
// so literal-IP hosts in loopback/private/link-local ranges (and "localhost")
// must be rejected to keep it from probing the local network.

function isPrivateIpv4(a: number, b: number): boolean {
  if (a === 0) return true; // 0.0.0.0/8 "this network" (0.0.0.0 routes to loopback)
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const bare = ip.split('%')[0]; // strip any zone id
  if (bare === '::') return true; // unspecified (binds/routes like loopback)
  if (bare === '::1') return true; // loopback
  if (/^f[cd]/.test(bare)) return true; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(bare)) return true; // fe80::/10 link-local
  // IPv4-mapped (::ffff:a.b.c.d). The URL parser serializes the mapped
  // address as two hex groups, e.g. ::ffff:7f00:1 for 127.0.0.1.
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(bare);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    return isPrivateIpv4(hi >> 8, hi & 0xff);
  }
  return false;
}

function isPrivateHostname(rawHostname: string): boolean {
  const host = rawHostname.toLowerCase();
  // A single trailing dot ("localhost.") is a fully-qualified spelling of the
  // same name — strip it before comparing so it can't bypass the check.
  const bareHost = host.endsWith('.') ? host.slice(0, -1) : host;
  if (bareHost === 'localhost') return true;
  // WHATWG URL keeps brackets around IPv6 hostnames.
  if (host.startsWith('[') && host.endsWith(']')) {
    return isPrivateIpv6(host.slice(1, -1));
  }
  // Literal IPv4. The URL parser canonicalizes hex/octal/short forms
  // (e.g. 0x7f.0.0.1) into dotted-decimal before we see them.
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    return isPrivateIpv4(Number(m[1]), Number(m[2]));
  }
  return false;
}

export function isSafeFaviconUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.length > 4096) return false;
  try {
    const u = new URL(value);
    const scheme = u.protocol.toLowerCase();
    if (scheme === 'data:') return true; // inline, no network request
    if (scheme !== 'http:' && scheme !== 'https:') return false;
    return !isPrivateHostname(u.hostname);
  } catch {
    return false;
  }
}
