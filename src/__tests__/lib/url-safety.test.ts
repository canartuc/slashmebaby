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
});
