import { describe, it, expect } from 'vitest';
import { guessNavigableUrl } from '../../lib/url-guess';

describe('guessNavigableUrl', () => {
  describe('bare domains (default scheme https)', () => {
    it('recognizes a bare domain', () => {
      expect(guessNavigableUrl('example.com')).toBe('https://example.com');
    });

    it('recognizes a domain with a path', () => {
      expect(guessNavigableUrl('x.dev/path')).toBe('https://x.dev/path');
    });

    it('recognizes a www-prefixed domain with a query string', () => {
      expect(guessNavigableUrl('www.foo.com?q=1')).toBe('https://www.foo.com?q=1');
    });

    it('recognizes a subdomain', () => {
      expect(guessNavigableUrl('mail.google.com')).toBe('https://mail.google.com');
    });

    it('recognizes a domain with a port', () => {
      expect(guessNavigableUrl('example.com:8080/admin')).toBe(
        'https://example.com:8080/admin'
      );
    });

    it('trims surrounding whitespace', () => {
      expect(guessNavigableUrl('  example.com  ')).toBe('https://example.com');
    });
  });

  describe('explicit schemes', () => {
    it('keeps an https URL as-is', () => {
      expect(guessNavigableUrl('https://x.dev/path')).toBe('https://x.dev/path');
    });

    it('keeps an http URL as-is', () => {
      expect(guessNavigableUrl('http://foo.com')).toBe('http://foo.com');
    });

    it('rejects javascript: URLs', () => {
      expect(guessNavigableUrl('javascript:alert(1)')).toBeNull();
    });

    it('rejects data: URLs', () => {
      expect(guessNavigableUrl('data:text/html,<b>x</b>')).toBeNull();
    });

    it('rejects file: URLs', () => {
      expect(guessNavigableUrl('file:///etc/passwd')).toBeNull();
    });

    it('rejects chrome-extension: URLs', () => {
      expect(guessNavigableUrl('chrome-extension://abc/evil.html')).toBeNull();
    });
  });

  describe('non-URL queries', () => {
    it('rejects plain words', () => {
      expect(guessNavigableUrl('github')).toBeNull();
    });

    it('rejects multi-word queries', () => {
      expect(guessNavigableUrl('hello world')).toBeNull();
    });

    it('rejects queries with a space after a domain', () => {
      expect(guessNavigableUrl('example.com extra')).toBeNull();
    });

    it('rejects single-letter TLDs', () => {
      expect(guessNavigableUrl('foo.c')).toBeNull();
    });

    it('rejects numeric-looking version strings', () => {
      expect(guessNavigableUrl('1.2')).toBeNull();
    });

    it('rejects the action prefix', () => {
      expect(guessNavigableUrl('>close tab')).toBeNull();
    });

    it('rejects the empty string', () => {
      expect(guessNavigableUrl('')).toBeNull();
    });

    it('rejects whitespace-only input', () => {
      expect(guessNavigableUrl('   ')).toBeNull();
    });

    it('rejects bare localhost (no dot, no TLD)', () => {
      expect(guessNavigableUrl('localhost:3000')).toBeNull();
    });

    it('rejects a trailing-dot fragment', () => {
      expect(guessNavigableUrl('example.')).toBeNull();
    });
  });
});
