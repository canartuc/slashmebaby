import { describe, it, expect } from 'vitest';
import {
  isNavigableUrl,
  validateNavigationUrl,
  isSafeFaviconUrl,
} from '../../lib/url-safety';

describe('validateNavigationUrl', () => {
  it('accepts http and https URLs', () => {
    expect(validateNavigationUrl('https://example.com').ok).toBe(true);
    expect(validateNavigationUrl('http://example.com/a?b=1#x').ok).toBe(true);
    expect(validateNavigationUrl('https://example.com:8443/path').ok).toBe(true);
  });

  it('accepts ftp and mailto URLs', () => {
    expect(validateNavigationUrl('ftp://files.example.com/a').ok).toBe(true);
    expect(validateNavigationUrl('mailto:user@example.com').ok).toBe(true);
  });

  it('rejects javascript: URIs', () => {
    const r = validateNavigationUrl('javascript:alert(1)');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('javascript');
  });

  it('rejects data: URIs', () => {
    expect(validateNavigationUrl('data:text/html,<script>alert(1)</script>').ok).toBe(false);
  });

  it('rejects file:, chrome:, chrome-extension:, about:', () => {
    expect(validateNavigationUrl('file:///etc/passwd').ok).toBe(false);
    expect(validateNavigationUrl('chrome://settings').ok).toBe(false);
    expect(validateNavigationUrl('chrome-extension://abc/x.html').ok).toBe(false);
    expect(validateNavigationUrl('about:blank').ok).toBe(false);
  });

  it('rejects view-source:', () => {
    expect(validateNavigationUrl('view-source:https://example.com').ok).toBe(false);
  });

  it('rejects non-string, empty, and oversized values', () => {
    expect(validateNavigationUrl(undefined).ok).toBe(false);
    expect(validateNavigationUrl(null).ok).toBe(false);
    expect(validateNavigationUrl({ url: 'https://example.com' }).ok).toBe(false);
    expect(validateNavigationUrl('').ok).toBe(false);
    expect(validateNavigationUrl('a'.repeat(9000)).ok).toBe(false);
  });

  it('rejects unparseable strings', () => {
    expect(validateNavigationUrl('not a url').ok).toBe(false);
    expect(validateNavigationUrl('://bogus').ok).toBe(false);
  });

  it('is case-insensitive for the scheme guard', () => {
    expect(validateNavigationUrl('JavaScript:alert(1)').ok).toBe(false);
    expect(validateNavigationUrl('HTTPS://example.com').ok).toBe(true);
  });

  it('isNavigableUrl mirrors validateNavigationUrl', () => {
    expect(isNavigableUrl('https://example.com')).toBe(true);
    expect(isNavigableUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('isSafeFaviconUrl', () => {
  it('accepts http(s) and data: icons', () => {
    expect(isSafeFaviconUrl('https://icons.example.com/f.ico')).toBe(true);
    expect(isSafeFaviconUrl('http://icons.example.com/f.ico')).toBe(true);
    expect(isSafeFaviconUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });

  it('rejects javascript: and chrome-extension: and file: favicons', () => {
    expect(isSafeFaviconUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeFaviconUrl('chrome-extension://abc/f.png')).toBe(false);
    expect(isSafeFaviconUrl('file:///x.png')).toBe(false);
  });

  it('rejects empty/undefined/oversized', () => {
    expect(isSafeFaviconUrl(undefined)).toBe(false);
    expect(isSafeFaviconUrl('')).toBe(false);
    expect(isSafeFaviconUrl('a'.repeat(5000))).toBe(false);
  });

  it('rejects unparseable favicon strings', () => {
    expect(isSafeFaviconUrl('not a url')).toBe(false);
    expect(isSafeFaviconUrl('://bogus')).toBe(false);
  });

  describe('SSRF hardening — private / loopback / link-local hosts', () => {
    const rejected: Array<[string, string]> = [
      ['localhost hostname', 'http://localhost/favicon.ico'],
      ['localhost with port', 'https://localhost:3000/favicon.ico'],
      ['uppercase localhost', 'http://LOCALHOST/favicon.ico'],
      ['IPv4 loopback', 'http://127.0.0.1/favicon.ico'],
      ['IPv4 loopback /8 upper bound', 'http://127.255.255.255/favicon.ico'],
      ['hex-encoded loopback (URL-normalized)', 'http://0x7f.0.0.1/favicon.ico'],
      ['10.0.0.0/8 private', 'http://10.0.0.5/favicon.ico'],
      ['172.16.0.0/12 lower bound', 'http://172.16.0.1/favicon.ico'],
      ['172.16.0.0/12 upper bound', 'http://172.31.255.255/favicon.ico'],
      ['192.168.0.0/16 private', 'https://192.168.1.1/favicon.ico'],
      ['169.254.0.0/16 link-local (cloud metadata)', 'http://169.254.169.254/latest/meta-data'],
      ['IPv6 loopback', 'http://[::1]/favicon.ico'],
      ['IPv6 loopback long form (URL-normalized)', 'http://[0:0:0:0:0:0:0:1]/favicon.ico'],
      ['IPv6 unique-local fc00::/7 (fc)', 'http://[fc00::1]/favicon.ico'],
      ['IPv6 unique-local fc00::/7 (fd)', 'http://[fd12:3456::1]/favicon.ico'],
      ['IPv6 link-local fe80::/10', 'http://[fe80::1]/favicon.ico'],
      ['IPv6 link-local fe80::/10 upper range', 'http://[febf::1]/favicon.ico'],
      ['IPv4-mapped IPv6 loopback', 'http://[::ffff:127.0.0.1]/favicon.ico'],
      ['IPv4-mapped IPv6 private', 'http://[::ffff:192.168.1.1]/favicon.ico'],
      ['0.0.0.0 unspecified', 'http://0.0.0.0/favicon.ico'],
      ['0.0.0.0/8 member', 'http://0.255.0.1/favicon.ico'],
      ['IPv4-mapped IPv6 unspecified', 'http://[::ffff:0.0.0.0]/favicon.ico'],
      ['IPv6 unspecified [::]', 'http://[::]/favicon.ico'],
      ['IPv6 unspecified long form (URL-normalized)', 'http://[0:0:0:0:0:0:0:0]/favicon.ico'],
      ['localhost with trailing dot', 'http://localhost./favicon.ico'],
      ['uppercase localhost with trailing dot', 'http://LOCALHOST./favicon.ico'],
      ['localhost with trailing dot and port', 'https://localhost.:8443/favicon.ico'],
    ];

    it.each(rejected)('rejects %s', (_label, url) => {
      expect(isSafeFaviconUrl(url)).toBe(false);
    });

    const accepted: Array<[string, string]> = [
      ['public IPv4', 'http://8.8.8.8/favicon.ico'],
      ['public IPv4 just below 172.16/12', 'http://172.15.255.255/favicon.ico'],
      ['public IPv4 just above 172.16/12', 'http://172.32.0.1/favicon.ico'],
      ['public 192.x outside 192.168/16', 'http://192.169.0.1/favicon.ico'],
      ['public 169.x outside 169.254/16', 'http://169.253.0.1/favicon.ico'],
      ['public hostname', 'https://icons.example.com/f.ico'],
      ['hostname containing "localhost"', 'https://localhost.example.com/f.ico'],
      ['hostname containing "localhost" with trailing dot', 'https://localhost.example.com./f.ico'],
      ['hostname starting with "localhost."', 'https://localhost.dev/f.ico'],
      ['public IPv6', 'http://[2606:4700::1111]/favicon.ico'],
      ['data: URI (no host)', 'data:image/png;base64,iVBORw0KGgo='],
    ];

    it.each(accepted)('accepts %s', (_label, url) => {
      expect(isSafeFaviconUrl(url)).toBe(true);
    });
  });
});

describe('validateNavigationUrl — disallowed-but-not-blocked schemes', () => {
  it('rejects schemes that are neither allowed nor explicitly blocked', () => {
    // gopher, irc, sftp etc. are not in the blocked set but also not in
    // the allowlist, so they should fall through with "disallowed scheme".
    const r = validateNavigationUrl('gopher://example.com/');
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('disallowed');
  });
});
